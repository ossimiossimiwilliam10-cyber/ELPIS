import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BulletinPage from './BulletinPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

const ev = (nom, note, coefficient = 1, statut) => ({ nom, note, coefficient, statut, type: 'SC' });

const matiere = (nom, evaluations, extra = {}) => ({ nom, evaluations, coefficient: 1, ...extra });

/*
 * `dateFin` décide désormais du verrouillage : une UE n'est capitalisée que
 * lorsque son semestre est terminé, le jury statuant en fin d'année.
 */
const cursus = (ues, { termine = false } = {}) => ({
  licences: [{
    nom: 'Licence Physique',
    semestres: [{ nom: 'Semestre 3', dateFin: termine ? '2020-01-15' : '2099-01-15', ues }],
  }],
});

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    coursConfig: cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 12), ev('Examen', 14, 2)])] },
    ]),
    setCoursConfig: vi.fn(),
    intelligence: null,
    setActiveTab: vi.fn(),
  };
});

describe('BulletinPage — premier lancement', () => {
  it('guide vers la Bibliothèque quand aucun cursus n\'existe', () => {
    storeState.coursConfig = { licences: [] };
    render(<BulletinPage />);
    expect(screen.getByText(/Aucune note à afficher/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });
});

describe('BulletinPage — moyenne provisoire', () => {
  /*
   * Le règlement attend au moins trois notes par UE, dont aucune ne pèse plus
   * de la moitié. ELPIS ne repondère rien : la moyenne officielle reste celle
   * du jury. Il prévient seulement que le chiffre affiché n'est pas encore un
   * résultat — ce qui est le cas de toute UE en début de semestre.
   */

  it('prévient quand une UE a moins de trois notes', () => {
    render(<BulletinPage />);
    expect(screen.getByText(/Moyenne provisoire/i)).toBeInTheDocument();
    expect(screen.getByText(/ne compte que 2 notes sur les 3 attendues/i)).toBeInTheDocument();
  });

  it('se tait quand l’UE a trois notes équilibrées', () => {
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 12), ev('DS2', 14), ev('DS3', 10)])] },
    ]);
    render(<BulletinPage />);
    expect(screen.queryByText(/Moyenne provisoire/i)).not.toBeInTheDocument();
  });

  it('signale une épreuve qui pèse plus de la moitié malgré trois notes', () => {
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 12), ev('DS2', 14), ev('Examen', 10, 6)])] },
    ]);
    render(<BulletinPage />);
    expect(screen.getByText(/Une seule épreuve pèse 75 % de cette moyenne/i)).toBeInTheDocument();
  });
});

describe('BulletinPage — moyennes', () => {
  it('affiche la moyenne pondérée de l\'UE', () => {
    render(<BulletinPage />);
    // (12×1 + 14×2) / 3 = 13.33 — la valeur figure sur l'UE et sur la matière.
    const entete = screen.getByRole('button', { name: /UE Maths/ });
    expect(within(entete).getByText('13.33 / 20')).toBeInTheDocument();
  });

  it('signale une UE défaillante au lieu d\'un NaN', () => {
    // Régression : `'DEF' × coefficient` valait NaN et l'en-tête affichait
    // « Moyenne : NaN / 20 ».
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('Examen', null, 1, 'defaillant')])] },
    ]);
    render(<BulletinPage />);
    expect(screen.getByText(/⚠️ Défaillant/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('n\'affiche jamais NaN, même en mélangeant notes et défaillance', () => {
    storeState.coursConfig = cursus([
      { nom: 'UE A', ects: 6, matieres: [matiere('Algèbre', [ev('DS', 15)])] },
      { nom: 'UE B', ects: 6, matieres: [matiere('Analyse', [ev('Examen', null, 1, 'defaillant')])] },
    ]);
    const { container } = render(<BulletinPage />);
    expect(container.textContent).not.toMatch(/NaN/);
  });

  it('annonce l\'absence de note', () => {
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [])] },
    ]);
    render(<BulletinPage />);
    expect(screen.getByText(/Pas de note/i)).toBeInTheDocument();
  });

  it('exclut une matière dispensée du calcul', () => {
    storeState.coursConfig = cursus([
      {
        nom: 'UE Maths', ects: 6,
        matieres: [matiere('Algèbre', [ev('DS', 10)]), matiere('Anglais', [ev('DS', 2)], { dispense: true })],
      },
    ]);
    render(<BulletinPage />);
    const entete = screen.getByRole('button', { name: /UE Maths/ });
    expect(within(entete).getByText('10.00 / 20')).toBeInTheDocument();
  });
});

describe('BulletinPage — points de jury', () => {
  it('borne les points ajoutés', () => {
    // Régression : une saisie de « 50 » produisait une moyenne fantaisiste.
    render(<BulletinPage />);
    fireEvent.change(screen.getByLabelText(/Points de jury/i), { target: { value: '50' } });

    const affichages = screen.getAllByText(/\d+\.\d{2}/).map(n => parseFloat(n.textContent));
    expect(Math.max(...affichages.filter(Number.isFinite))).toBeLessThanOrEqual(20);
  });
});

describe('BulletinPage — évaluations', () => {
  // UE sous la moyenne : elle n'est pas capitalisée, donc reste modifiable.
  const cursusModifiable = () => cursus([
    { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 8)])] },
  ]);

  const noteEnregistree = () => {
    const enregistre = storeState.setCoursConfig.mock.calls[0][0];
    return enregistre.licences[0].semestres[0].ues[0].matieres[0].evaluations[0].note;
  };

  beforeEach(() => { storeState.coursConfig = cursusModifiable(); });

  it('ajoute une épreuve à la matière', () => {
    render(<BulletinPage />);
    fireEvent.click(screen.getAllByRole('button', { name: '+ Épreuve' })[0]);

    const enregistre = storeState.setCoursConfig.mock.calls[0][0];
    expect(enregistre.licences[0].semestres[0].ues[0].matieres[0].evaluations).toHaveLength(2);
  });

  it('enregistre une note valide', () => {
    render(<BulletinPage />);
    const champ = screen.getByDisplayValue('8');
    fireEvent.change(champ, { target: { value: '15.5' } });
    fireEvent.blur(champ);
    expect(noteEnregistree()).toBe(15.5);
  });

  it('refuse une note hors de l\'échelle', () => {
    render(<BulletinPage />);
    const champ = screen.getByDisplayValue('8');
    fireEvent.change(champ, { target: { value: '25' } });
    fireEvent.blur(champ);
    expect(noteEnregistree()).toBeNull();
  });

  it('efface la note sur un champ vidé', () => {
    render(<BulletinPage />);
    const champ = screen.getByDisplayValue('8');
    fireEvent.change(champ, { target: { value: '' } });
    fireEvent.blur(champ);
    expect(noteEnregistree()).toBeNull();
  });

  it("verrouille les notes d'une UE une fois le semestre terminé", () => {
    // Le jury a statué : la moyenne est acquise, les notes ne se modifient plus
    // sans déverrouillage explicite.
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 15), ev('DS2', 13), ev('DS3', 14)])] },
    ], { termine: true });
    render(<BulletinPage />);
    expect(screen.getAllByRole('button', { name: '+ Épreuve' })[0]).toBeDisabled();
  });

  it("ne verrouille rien tant que le semestre est en cours", () => {
    // Trois notes excellentes, mais le semestre court encore : rien n'est acquis.
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 15), ev('DS2', 16), ev('DS3', 14)])] },
    ], { termine: false });
    render(<BulletinPage />);
    expect(screen.getAllByRole('button', { name: '+ Épreuve' })[0]).not.toBeDisabled();
    expect(screen.queryByText(/UE acquise/i)).not.toBeInTheDocument();
  });

  it("ne verrouille pas une UE sur une seule bonne note", () => {
    /*
     * Régression : une UE passait en « acquise, notes verrouillées » dès que sa
     * moyenne franchissait 10. Un 15 au premier DS suffisait donc à interdire la
     * saisie des épreuves suivantes — et, côté moteur, à retirer la matière du
     * planning de révisions pour le reste du semestre.
     */
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 15)])] },
    ]);
    render(<BulletinPage />);
    expect(screen.getAllByRole('button', { name: '+ Épreuve' })[0]).not.toBeDisabled();
    expect(screen.queryByText(/UE acquise/i)).not.toBeInTheDocument();
  });
});

describe('BulletinPage — mode simulation', () => {
  it('n\'enregistre pas les notes simulées', () => {
    storeState.coursConfig = cursus([
      { nom: 'UE Maths', ects: 6, matieres: [matiere('Algèbre', [ev('DS1', 8)])] },
    ]);
    render(<BulletinPage />);
    fireEvent.click(screen.getByRole('button', { name: /Simuler|Simulation/i }));

    const champ = screen.getByDisplayValue('8');
    fireEvent.change(champ, { target: { value: '18' } });
    fireEvent.blur(champ);

    expect(storeState.setCoursConfig).not.toHaveBeenCalled();
  });
});
