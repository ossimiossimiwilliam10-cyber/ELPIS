import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StagesPage from './StagesPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const addToast = vi.fn();
vi.mock('./ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const stage = (extra = {}) => ({
  id: 's1',
  titre: 'Ingénieur Logiciel',
  entreprise: 'Acme',
  type: 'Apprentissage',
  objectifHeures: 616,
  heuresRealisees: 100,
  interrompu: false,
  memoireRendu: false,
  ...extra,
});

/** Contrats tels qu'enregistrés après une action. */
const stagesEnregistres = () => storeState.setConfig.mock.calls[0][0].stages;

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { config: { stages: [stage()] }, setConfig: vi.fn() };
});

describe('StagesPage — création', () => {
  beforeEach(() => { storeState.config = { stages: [] }; });

  it('annonce une liste vide', () => {
    render(<StagesPage />);
    expect(screen.getByText(/Aucun contrat déclaré/i)).toBeInTheDocument();
  });

  it('crée un contrat', () => {
    render(<StagesPage />);
    fireEvent.change(screen.getByLabelText(/Titre du poste/i), { target: { value: 'Développeur' } });
    fireEvent.change(screen.getByLabelText('Entreprise'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(stagesEnregistres()[0]).toMatchObject({
      titre: 'Développeur', entreprise: 'Acme', heuresRealisees: 0, interrompu: false,
    });
  });

  it('refuse un formulaire incomplet', () => {
    render(<StagesPage />);
    fireEvent.change(screen.getByLabelText(/Titre du poste/i), { target: { value: 'Développeur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.any(String), 'warning');
  });

  it('refuse un titre fait d\'espaces', () => {
    render(<StagesPage />);
    fireEvent.change(screen.getByLabelText(/Titre du poste/i), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Entreprise'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
  });
});

describe('StagesPage — suivi des heures', () => {
  it('affiche la progression', () => {
    render(<StagesPage />);
    expect(screen.getByText('100 h / 616 h · 16 %')).toBeInTheDocument();
  });

  it('ajoute une journée de travail', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /journée/i }));
    expect(stagesEnregistres()[0].heuresRealisees).toBe(107);
  });

  it('permet de corriger une heure ajoutée par erreur', () => {
    // Régression : aucun moyen de revenir en arrière après un clic de trop.
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Retirer une heure/i }));
    expect(stagesEnregistres()[0].heuresRealisees).toBe(99);
  });

  it('ne descend jamais sous zéro', () => {
    storeState.config = { stages: [stage({ heuresRealisees: 0 })] };
    render(<StagesPage />);
    expect(screen.getByRole('button', { name: /Retirer une heure/i })).toBeDisabled();
  });

  it('accepte une correction directe du total', () => {
    render(<StagesPage />);
    fireEvent.change(screen.getByLabelText(/Total d'heures réalisées/i), { target: { value: '250' } });
    expect(stagesEnregistres()[0].heuresRealisees).toBe(250);
  });

  it('traite un contrat sans compteur d\'heures sans produire de NaN', () => {
    // Régression : `undefined + 7` donnait NaN, affiché tel quel.
    storeState.config = { stages: [stage({ heuresRealisees: undefined })] };
    render(<StagesPage />);
    expect(screen.getByText('0 h / 616 h · 0 %')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /journée/i }));
    expect(stagesEnregistres()[0].heuresRealisees).toBe(7);
  });

  it('célèbre l\'objectif atteint', () => {
    storeState.config = { stages: [stage({ heuresRealisees: 616 })] };
    render(<StagesPage />);
    expect(screen.getByText(/Objectif atteint/i)).toBeInTheDocument();
  });
});

describe('StagesPage — interruption', () => {
  it('avertit de la tâche obligatoire engendrée', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Déclarer une interruption/i }));

    const dialogue = screen.getByRole('alertdialog');
    expect(within(dialogue).getByText(/mémoire de substitution/i)).toBeInTheDocument();
    expect(within(dialogue).getByText(/Ingénieur Logiciel/)).toBeInTheDocument();
  });

  it('déclare l\'interruption après confirmation', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Déclarer une interruption/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }));

    expect(stagesEnregistres()[0].interrompu).toBe(true);
  });

  it('permet d\'annuler une interruption déclarée par erreur', () => {
    // Régression : le bouton disparaissait une fois l'interruption déclarée, et
    // la tâche obligatoire polluait durablement le planning.
    storeState.config = { stages: [stage({ interrompu: true, memoireRendu: true })] };
    render(<StagesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Annuler l'interruption/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));

    expect(stagesEnregistres()[0]).toMatchObject({ interrompu: false, memoireRendu: false });
  });

  it('bascule le statut du mémoire', () => {
    storeState.config = { stages: [stage({ interrompu: true })] };
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Rendre le mémoire/i }));
    expect(stagesEnregistres()[0].memoireRendu).toBe(true);
  });
});

describe('StagesPage — suppression', () => {
  it('nomme le contrat visé', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer le contrat/i }));

    const dialogue = screen.getByRole('alertdialog');
    expect(within(dialogue).getByText(/Ingénieur Logiciel/)).toBeInTheDocument();
    expect(within(dialogue).getByText(/Acme/)).toBeInTheDocument();
  });

  it('supprime après confirmation', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer le contrat/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(stagesEnregistres()).toEqual([]);
  });

  it('ne supprime rien si l\'utilisateur renonce', () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer le contrat/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(storeState.setConfig).not.toHaveBeenCalled();
  });
});

describe('StagesPage — correction d’un contrat', () => {
  const ouvrirCorrection = () => {
    render(<StagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier le contrat/ }));
  };

  it('offre de corriger un contrat existant', () => {
    // Un contrat était définitif : une faute dans le nom de l'entreprise
    // obligeait à tout supprimer, heures pointées comprises.
    ouvrirCorrection();
    expect(screen.getByRole('button', { name: 'Enregistrer les modifications' })).toBeInTheDocument();
  });

  it('pré-remplit le formulaire avec le contrat visé', () => {
    ouvrirCorrection();
    expect(screen.getByDisplayValue('Ingénieur Logiciel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
  });

  it('remplace le contrat au lieu d’en créer un second', () => {
    ouvrirCorrection();
    fireEvent.change(screen.getByDisplayValue('Acme'), { target: { value: 'Beta SA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    const enregistres = stagesEnregistres();
    expect(enregistres).toHaveLength(1);
    expect(enregistres[0]).toMatchObject({ id: 's1', entreprise: 'Beta SA' });
  });

  it('préserve les heures déjà pointées', () => {
    // La correction porte sur la description du contrat, pas sur son suivi.
    ouvrirCorrection();
    fireEvent.change(screen.getByDisplayValue('Ingénieur Logiciel'), { target: { value: 'Développeur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(stagesEnregistres()[0]).toMatchObject({ titre: 'Développeur', heuresRealisees: 100 });
  });

  it('permet de renoncer à la correction', () => {
    ouvrirCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
    expect(storeState.setConfig).not.toHaveBeenCalled();
  });
});
