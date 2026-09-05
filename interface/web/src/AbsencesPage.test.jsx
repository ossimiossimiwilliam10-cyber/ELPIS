import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AbsencesPage from './AbsencesPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const addToast = vi.fn();
vi.mock('./ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const absence = (extra = {}) => ({
  id: 'a1',
  date: '2026-09-14',
  matiere: 'Programmation',
  type: 'TP',
  statut: 'Non Justifié',
  notes: '',
  ...extra,
});

const CURSUS = {
  licences: [{ semestres: [{ ues: [{ matieres: [{ nom: 'Programmation' }, { nom: 'Algèbre' }] }] }] }],
};

const absencesEnregistrees = () => storeState.setConfig.mock.calls[0][0].absences;

beforeEach(() => {
  vi.clearAllMocks();
  // 15 septembre 2026 : une absence du 14 est encore dans les délais.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 10, 0));
  storeState = { config: { absences: [absence()] }, coursConfig: CURSUS, setConfig: vi.fn() };
});

afterEach(() => vi.useRealTimers());

describe('AbsencesPage — synthèse', () => {
  it('félicite quand aucune absence n\'est déclarée', () => {
    storeState.config = { absences: [] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Aucune absence déclarée/i)).toBeInTheDocument();
  });

  it('ventile les absences par état', () => {
    // L'information la plus utile de la page manquait : il fallait parcourir
    // toutes les cartes pour savoir ce qui restait à régulariser.
    storeState.config = { absences: [
      absence({ id: 'a1', date: '2026-09-14', type: 'TP', statut: 'Non Justifié' }),
      absence({ id: 'a2', date: '2026-09-01', type: 'TP', statut: 'Non Justifié' }),
      absence({ id: 'a3', date: '2026-09-05', type: 'CM', statut: 'Justifié' }),
    ] };
    render(<AbsencesPage />);

    const trouver = (libelle) => screen.getByText(libelle).previousSibling.textContent;
    expect(trouver('Absences')).toBe('3');
    expect(trouver('À justifier')).toBe('1');
    expect(trouver('Hors délai')).toBe('1');
    expect(trouver('Régularisées')).toBe('1');
  });

  it('classe les absences de la plus récente à la plus ancienne', () => {
    storeState.config = { absences: [
      absence({ id: 'a1', date: '2026-09-01', matiere: 'Ancienne' }),
      absence({ id: 'a2', date: '2026-09-14', matiere: 'Récente' }),
    ] };
    render(<AbsencesPage />);

    const titres = screen.getAllByText(/Ancienne|Récente/).map(n => n.textContent.trim());
    expect(titres[0]).toContain('Récente');
  });
});

describe('AbsencesPage — délai de justification', () => {
  it('accorde le délai entier le jour même', () => {
    // Régression : le calcul mélangeait une date lue en UTC et l'heure locale.
    storeState.config = { absences: [absence({ date: '2026-09-15' })] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Encore 7 jours pour justifier/i)).toBeInTheDocument();
  });

  it('signale le dernier jour', () => {
    storeState.config = { absences: [absence({ date: '2026-09-08' })] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Dernier jour pour justifier/i)).toBeInTheDocument();
  });

  it('chiffre le dépassement', () => {
    storeState.config = { absences: [absence({ date: '2026-09-01' })] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Délai dépassé de 7 jours/i)).toBeInTheDocument();
  });

  it('n\'exige rien pour un TD', () => {
    storeState.config = { absences: [absence({ type: 'TD', date: '2026-09-01' })] };
    render(<AbsencesPage />);
    expect(screen.queryByText(/pour justifier/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Justificatif non requis/i)).toBeInTheDocument();
  });

  it('rappelle la conséquence propre à chaque type', () => {
    storeState.config = { absences: [absence({ type: 'Langue' })] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Présence stricte au CRL/i)).toBeInTheDocument();
  });

  it('explique aussi le cas du CM', () => {
    // Le CM exigeait un justificatif sans qu'aucun message ne l'indique.
    storeState.config = { absences: [absence({ type: 'CM' })] };
    render(<AbsencesPage />);
    expect(screen.getByText(/Justificatif attendu pour les CM/i)).toBeInTheDocument();
  });
});

describe('AbsencesPage — motif', () => {
  it('affiche le motif saisi', () => {
    // Régression : le motif était enregistré puis n'apparaissait nulle part.
    storeState.config = { absences: [absence({ notes: 'Grève des transports' })] };
    render(<AbsencesPage />);
    expect(screen.getByText('Grève des transports')).toBeInTheDocument();
  });
});

describe('AbsencesPage — déclaration', () => {
  const ouvrir = () => fireEvent.click(screen.getByRole('button', { name: /Déclarer une absence/i }));

  it('ouvre une boîte de dialogue en bonne et due forme', () => {
    render(<AbsencesPage />);
    ouvrir();
    expect(screen.getByRole('dialog', { name: /Déclarer une absence/i })).toBeInTheDocument();
  });

  it('se referme sur Échap', () => {
    render(<AbsencesPage />);
    ouvrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('propose les matières du cursus', () => {
    render(<AbsencesPage />);
    ouvrir();
    const options = Array.from(document.querySelectorAll('datalist option')).map(o => o.value);
    expect(options).toEqual(['Algèbre', 'Programmation']);
  });

  it('enregistre une absence complète', () => {
    render(<AbsencesPage />);
    ouvrir();
    fireEvent.change(screen.getByLabelText(/Date de l'absence/i), { target: { value: '2026-09-16' } });
    fireEvent.change(screen.getByLabelText(/Matière concernée/i), { target: { value: 'Algèbre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(absencesEnregistrees()).toHaveLength(2);
    expect(absencesEnregistrees()[1]).toMatchObject({ date: '2026-09-16', matiere: 'Algèbre', type: 'TP' });
  });

  it('refuse une matière faite d\'espaces', () => {
    // Le navigateur bloque déjà les champs vides ; il reste à filtrer ce qui
    // satisfait `required` sans avoir de sens.
    render(<AbsencesPage />);
    ouvrir();
    fireEvent.change(screen.getByLabelText(/Date de l'absence/i), { target: { value: '2026-09-16' } });
    fireEvent.change(screen.getByLabelText(/Matière concernée/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('élague les espaces autour de la matière', () => {
    render(<AbsencesPage />);
    ouvrir();
    fireEvent.change(screen.getByLabelText(/Date de l'absence/i), { target: { value: '2026-09-16' } });
    fireEvent.change(screen.getByLabelText(/Matière concernée/i), { target: { value: '  Algèbre  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(absencesEnregistrees()[1].matiere).toBe('Algèbre');
  });
});

describe('AbsencesPage — suivi', () => {
  it('change le statut d\'une absence', () => {
    render(<AbsencesPage />);
    fireEvent.change(screen.getByLabelText(/Statut de l'absence/i), { target: { value: 'Justifié' } });
    expect(absencesEnregistrees()[0].statut).toBe('Justifié');
  });

  it('nomme l\'absence avant de la supprimer', () => {
    render(<AbsencesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'absence en Programmation/i }));
    expect(within(screen.getByRole('alertdialog')).getByText(/Programmation/)).toBeInTheDocument();
  });

  it('supprime après confirmation', () => {
    render(<AbsencesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'absence en Programmation/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(absencesEnregistrees()).toEqual([]);
  });
});

describe('AbsencesPage — correction d’une absence', () => {
  const ouvrirCorrection = () => {
    render(<AbsencesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier l'absence en Programmation/ }));
  };

  it('offre de corriger une absence déjà déclarée', () => {
    // Seul le statut était modifiable : une date ou une matière fausse
    // obligeait à supprimer puis tout ressaisir, en comptant entre-temps dans
    // le bilan d'assiduité.
    ouvrirCorrection();
    expect(screen.getByText('Corriger une absence')).toBeInTheDocument();
  });

  it('pré-remplit le formulaire avec l’absence visée', () => {
    ouvrirCorrection();
    expect(screen.getByLabelText(/Date/i)).toHaveValue('2026-09-14');
    expect(screen.getByLabelText(/Matière/i)).toHaveValue('Programmation');
  });

  it('remplace l’absence au lieu d’en créer une seconde', () => {
    ouvrirCorrection();
    fireEvent.change(screen.getByLabelText(/Date/i), { target: { value: '2026-09-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const enregistrees = absencesEnregistrees();
    expect(enregistrees).toHaveLength(1);
    expect(enregistrees[0]).toMatchObject({ id: 'a1', date: '2026-09-12', matiere: 'Programmation' });
  });

  it('conserve le statut déjà obtenu lors d’une correction', () => {
    storeState.config = { absences: [absence({ statut: 'Justifié' })] };
    ouvrirCorrection();
    fireEvent.change(screen.getByLabelText(/Matière/i), { target: { value: 'Algèbre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(absencesEnregistrees()[0]).toMatchObject({ matiere: 'Algèbre', statut: 'Justifié' });
  });

  it('nomme le geste pour que l’annulation soit lisible', () => {
    ouvrirCorrection();
    fireEvent.change(screen.getByLabelText(/Matière/i), { target: { value: 'Algèbre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(storeState.setConfig.mock.calls[0][1]).toMatchObject({
      libelle: "Modification d'une absence",
    });
  });

  it('revient à une déclaration neuve après une correction', () => {
    ouvrirCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer une absence' }));

    expect(screen.getByText('Déclarer une absence', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toHaveValue('');
  });
});
