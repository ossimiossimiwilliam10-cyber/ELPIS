import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EntrainementPage, { cleExercice } from './EntrainementPage';
import { dureeValidation } from './utils/completion';

let storeState;
let chronoState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  const useChronoStore = (selector) => (selector ? selector(chronoState) : chronoState);
  useChronoStore.getState = () => chronoState;
  return { default: useStore, useChronoStore };
});

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

// Carte allégée : on teste ici la logique de la page (appariement, durées,
// garde-fous), pas le rendu détaillé de la carte, couvert par ses propres tests.
vi.mock('./components/cours/ExerciceCard', () => ({
  default: ({ exo, onMarkAsDone, onEvaluateCM, onSuspendCM }) => (
    <div data-testid="exercice-card">
      <span>{exo.titre}</span>
      <span data-testid="raisons">{(exo.raisons || []).join(',')}</span>
      <button onClick={() => onMarkAsDone(exo, '', 0)}>Fait {exo.titre}</button>
      <button onClick={() => onEvaluateCM(exo, 3, 0)}>Évaluer {exo.titre}</button>
      {onSuspendCM && <button onClick={() => onSuspendCM(exo, 0)}>Suspendre {exo.titre}</button>}
    </div>
  ),
}));

const CURSUS = {
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [{
        nom: 'UE1',
        matieres: [{
          nom: 'Algèbre',
          listeCM: [{ id: 'cm1', titre: 'Groupes' }],
          listeTD: [{ id: 'td1', titre: 'TD1' }],
          // Une étape déjà franchie : la validation suivante est l'étape 2.
          listeTP: [{ id: 'tp1', titre: 'TP1', nombrePratiques: 1 }],
          listeAnnales: [],
        }],
      }],
    }],
  }],
};

const rapport = (overrides = {}) => ({
  statut: 'OK',
  tachesDuJour: [],
  tempsDispoMin: 240,
  tempsDejaTravailleMin: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  chronoState = {
    globalChrono: { exoId: null, isRunning: false, elapsedSeconds: 0 },
    resetGlobalChrono: vi.fn(),
    startGlobalChrono: vi.fn(),
    toggleGlobalChrono: vi.fn(),
  };
  storeState = {
    coursConfig: CURSUS,
    setCoursConfig: vi.fn(),
    addHistoriqueEntry: vi.fn(),
    config: {},
    setConfig: vi.fn(),
    dailyFillGap: false,
    setDailyFillGap: vi.fn(),
    intelligence: null,
    orchestratorData: rapport(),
    fetchOrchestrator: vi.fn(),
    forcedTask: null,
    setForcedTask: vi.fn(),
    setActiveTab: vi.fn(),
  };
});

describe('dureeValidation', () => {
  it('retient le temps mesuré quand il existe', () => {
    expect(dureeValidation({ type: 'TD' }, 42, {})).toBe(42);
  });

  it('distingue un cours neuf d\'une révision', () => {
    // Régression : `jActuel` était lu après réécriture par FSRS, si bien qu'un
    // cours neuf était toujours compté comme une simple révision.
    expect(dureeValidation({ type: 'CM' }, 0, {}, { estNouveauCM: true })).toBe(120);
    expect(dureeValidation({ type: 'CM' }, 0, {}, { estNouveauCM: false })).toBe(30);
  });

  it('applique la durée propre à chaque étape de TP', () => {
    // Régression : l'historique retenait 30 min pour une étape qui en pesait 180.
    expect(dureeValidation({ type: 'TP' }, 0, {}, { etapeIndex: 0 })).toBe(45);
    expect(dureeValidation({ type: 'TP' }, 0, {}, { etapeIndex: 1 })).toBe(180);
    expect(dureeValidation({ type: 'TP' }, 0, {}, { etapeIndex: 2 })).toBe(90);
    expect(dureeValidation({ type: 'TP' }, 0, {}, { etapeIndex: 3 })).toBe(30);
  });

  it('couvre les autres types planifiables', () => {
    expect(dureeValidation({ type: 'TD' }, 0, {})).toBe(20);
    expect(dureeValidation({ type: 'ANNALE' }, 0, {})).toBe(60);
    expect(dureeValidation({ type: 'ANKI' }, 0, {})).toBe(30);
  });

  it('respecte les durées configurées par l\'utilisateur', () => {
    expect(dureeValidation({ type: 'TD' }, 0, { defaultDurationTD: 35 })).toBe(35);
  });

  it('se rabat sur la durée annoncée pour un type inconnu', () => {
    expect(dureeValidation({ type: 'PROJET', dureeMinutes: 120 }, 0, {})).toBe(120);
  });

  it('ne renvoie jamais NaN sans configuration', () => {
    for (const type of ['CM', 'TD', 'TP', 'ANNALE', 'ANKI', 'PROJET']) {
      expect(Number.isFinite(dureeValidation({ type }, 0, null))).toBe(true);
    }
  });
});

describe('cleExercice', () => {
  it('privilégie l\'identifiant de l\'exercice', () => {
    expect(cleExercice({ id: 'cm1', titre: 'Groupes' })).toBe('cm1');
  });

  it('distingue deux homonymes de matières différentes', () => {
    const a = cleExercice({ type: 'CM', matiereNom: 'Algèbre', titre: 'CM1' });
    const b = cleExercice({ type: 'CM', matiereNom: 'Analyse', titre: 'CM1' });
    expect(a).not.toBe(b);
  });
});

describe('EntrainementPage — états sans travail', () => {
  it('affiche un indicateur tant que le rapport n\'est pas arrivé', () => {
    storeState.orchestratorData = null;
    render(<EntrainementPage />);
    expect(screen.getByRole('status', { name: /Chargement/i })).toBeInTheDocument();
  });

  it('invite à remplir la Bibliothèque quand le cursus est vide', () => {
    // Premier lancement : annoncer « Tout est terminé » n'aurait aucun sens.
    storeState.coursConfig = { licences: [] };
    render(<EntrainementPage />);
    expect(screen.getByText(/Aucun cours enregistré/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tout est terminé/i)).not.toBeInTheDocument();
  });

  it('ouvre la Bibliothèque depuis l\'état vide', () => {
    storeState.coursConfig = { licences: [] };
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir la Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });

  it('relaie le message d\'un jour de repos', () => {
    storeState.orchestratorData = rapport({ statut: 'REPOS', message: 'Repos hebdomadaire mérité.' });
    render(<EntrainementPage />);
    expect(screen.getByText(/Journée de repos/i)).toBeInTheDocument();
    expect(screen.getByText('Repos hebdomadaire mérité.')).toBeInTheDocument();
    expect(screen.queryByText(/Tout est terminé/i)).not.toBeInTheDocument();
  });

  it('propose de réessayer quand le planificateur est injoignable', () => {
    storeState.orchestratorData = { error: 'ECONNREFUSED' };
    render(<EntrainementPage />);
    expect(screen.getByText(/Planificateur injoignable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    expect(storeState.fetchOrchestrator).toHaveBeenCalled();
  });

  it('félicite quand le programme du jour est accompli', () => {
    render(<EntrainementPage />);
    expect(screen.getByText(/Tout est terminé/i)).toBeInTheDocument();
  });
});

describe('EntrainementPage — appariement des tâches', () => {
  it('affiche les exercices planifiés', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'TD', titre: 'TD1', dureeMinutes: 20 }],
    });
    render(<EntrainementPage />);
    expect(screen.getByText('TD1')).toBeInTheDocument();
  });

  it('conserve une tâche sans exercice correspondant', () => {
    // Régression : le mémoire de substitution, marqué obligatoire et prioritaire
    // par l'orchestrateur, disparaissait sans un mot de la session du jour.
    storeState.orchestratorData = rapport({
      tachesDuJour: [{
        matiere: 'Stages & Apprentissage',
        type: 'PROJET',
        titre: 'Mémoire de substitution : Stage été',
        dureeMinutes: 120,
        raisons: ['INTERRUPTION_STAGE', 'OBLIGATOIRE'],
      }],
    });
    render(<EntrainementPage />);
    expect(screen.getByText('Mémoire de substitution : Stage été', { selector: 'span' })).toBeInTheDocument();
  });

  it('transmet les motifs de planification à la carte', () => {
    // Régression : le dictionnaire de motifs de la carte n'était jamais alimenté.
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'TD', titre: 'TD1', raisons: ['EXAMEN_PROCHE'] }],
    });
    render(<EntrainementPage />);
    expect(screen.getByTestId('raisons')).toHaveTextContent('EXAMEN_PROCHE');
  });

  it('ne propose pas de suspendre une tâche hors cursus', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Stages & Apprentissage', type: 'PROJET', titre: 'Mémoire', dureeMinutes: 120 }],
    });
    render(<EntrainementPage />);
    expect(screen.queryByRole('button', { name: /Suspendre/i })).not.toBeInTheDocument();
  });

  it('compte la progression sur la seule session du jour', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [
        { matiere: 'Algèbre', type: 'TD', titre: 'TD1' },
        { matiere: 'Algèbre', type: 'CM', titre: 'Groupes' },
      ],
    });
    render(<EntrainementPage />);
    expect(screen.getByRole('progressbar', { name: /Progression de la session/i })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/0 sur 2 tâches/i)).toBeInTheDocument();
  });
});

describe('EntrainementPage — validation', () => {
  it('enregistre un TD avec sa durée par défaut', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'TD', titre: 'TD1' }],
    });
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Fait TD1/i }));

    expect(storeState.addHistoriqueEntry).toHaveBeenCalledTimes(1);
    expect(storeState.addHistoriqueEntry.mock.calls[0][0]).toMatchObject({
      type: 'TD', titre: 'TD1', matiere: 'Algèbre', dureeMinutes: 20,
    });
  });

  it('facture l\'étape en cours pour un TP', () => {
    // L'exercice en est à sa deuxième étape : 180 min, pas 30.
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'TP', titre: 'TP1' }],
    });
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Fait TP1/i }));

    expect(storeState.addHistoriqueEntry.mock.calls[0][0].dureeMinutes).toBe(180);
  });

  it('crédite un cours neuf de sa durée longue', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'CM', titre: 'Groupes' }],
    });
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Évaluer Groupes/i }));

    expect(storeState.addHistoriqueEntry.mock.calls[0][0]).toMatchObject({ type: 'CM', dureeMinutes: 120 });
  });

  it('ignore un second clic sur le même exercice', () => {
    // Régression : un double-clic créait deux entrées d'historique.
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'TD', titre: 'TD1' }],
    });
    render(<EntrainementPage />);
    const bouton = screen.getByRole('button', { name: /Fait TD1/i });
    fireEvent.click(bouton);
    fireEvent.click(bouton);

    expect(storeState.addHistoriqueEntry).toHaveBeenCalledTimes(1);
  });

  it('refuse de valider un exercice absent du cursus sans faire tomber la page', () => {
    // Le cursus a changé entre l'affichage et le clic.
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'CM', titre: 'Groupes' }],
    });
    const { rerender } = render(<EntrainementPage />);
    storeState.coursConfig = { licences: [] };
    rerender(<EntrainementPage />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: /Évaluer Groupes/i }))).not.toThrow();
    expect(toast.error).toHaveBeenCalled();
    expect(storeState.addHistoriqueEntry).not.toHaveBeenCalled();
  });

  it('retire une tâche hors cursus de la liste une fois validée', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Stages & Apprentissage', type: 'PROJET', titre: 'Mémoire', dureeMinutes: 120 }],
    });
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Fait Mémoire/i }));

    expect(storeState.addHistoriqueEntry.mock.calls[0][0]).toMatchObject({ type: 'PROJET', dureeMinutes: 120 });
    expect(screen.queryByTestId('exercice-card')).not.toBeInTheDocument();
  });

  it('suspend un cours sans toucher à son état FSRS', () => {
    storeState.orchestratorData = rapport({
      tachesDuJour: [{ matiere: 'Algèbre', type: 'CM', titre: 'Groupes' }],
    });
    render(<EntrainementPage />);
    fireEvent.click(screen.getByRole('button', { name: /Suspendre Groupes/i }));

    const nouveauCursus = storeState.setCoursConfig.mock.calls[0][0];
    const cm = nouveauCursus.licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.derniereRevision).toBeUndefined();
    expect(cm.fsrsCard).toBeUndefined();
    expect(cm.prochaineRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByTestId('exercice-card')).not.toBeInTheDocument();
  });
});
