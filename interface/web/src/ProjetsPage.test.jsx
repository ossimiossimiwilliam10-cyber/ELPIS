import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import ProjetsPage from './ProjetsPage';

let storeState;
let chronoState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  useStore.setState = vi.fn();
  const useChronoStore = (selector) => (selector ? selector(chronoState) : chronoState);
  useChronoStore.getState = () => chronoState;
  return { default: useStore, useChronoStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

const projet = (extra = {}) => ({
  id: 'p1',
  titre: 'Portfolio',
  dateFin: '2026-12-31',
  phases: [
    { id: 'ph1', nom: 'Maquette', complete: false },
    { id: 'ph2', nom: 'Intégration', complete: false },
  ],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  chronoState = {
    globalChrono: { exoId: null, isRunning: false, elapsedSeconds: 0 },
    startGlobalChrono: vi.fn(),
    toggleGlobalChrono: vi.fn(),
    resetGlobalChrono: vi.fn(),
  };
  storeState = {
    projets: [projet()],
    setProjets: vi.fn(),
    pendingTasksCount: 0,
    historique: [],
    addHistoriqueEntry: vi.fn(),
    setActiveTab: vi.fn(),
  };
});

describe('ProjetsPage — verrou', () => {
  it('bloque tant que la session du jour n\'est pas terminée', () => {
    storeState.pendingTasksCount = 2;
    render(<ProjetsPage />);
    expect(screen.getByText(/Espace Verrouillé/i)).toBeInTheDocument();
  });

  it('offre une issue vers la session du jour', () => {
    // Régression : l'écran verrouillé était un cul-de-sac.
    storeState.pendingTasksCount = 2;
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Session du Jour/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('entrainement');
  });
});

describe('ProjetsPage — projets', () => {
  it('annonce une liste vide', () => {
    storeState.projets = [];
    render(<ProjetsPage />);
    expect(screen.getByText(/Aucun projet pour le moment/i)).toBeInTheDocument();
  });

  it('crée un projet', () => {
    storeState.projets = [];
    render(<ProjetsPage />);
    fireEvent.change(screen.getByPlaceholderText(/Nom du projet/i), { target: { value: 'Robot' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer/i }));

    const enregistres = storeState.setProjets.mock.calls[0][0];
    expect(enregistres).toHaveLength(1);
    expect(enregistres[0]).toMatchObject({ titre: 'Robot', phases: [] });
    expect(enregistres[0].id).toBeTruthy();
  });

  it('ignore un titre vide', () => {
    storeState.projets = [];
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Créer/i }));
    expect(storeState.setProjets).not.toHaveBeenCalled();
  });

  it('affiche la progression des phases', () => {
    storeState.projets = [projet({ phases: [
      { id: 'ph1', nom: 'A', complete: true },
      { id: 'ph2', nom: 'B', complete: false },
    ] })];
    render(<ProjetsPage />);
    expect(screen.getByText('50 %')).toBeInTheDocument();
  });

  it('nomme le projet avant de le supprimer', () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer le projet/i }));

    const dialogue = screen.getByRole('alertdialog');
    expect(within(dialogue).getByText(/Portfolio/)).toBeInTheDocument();
    expect(within(dialogue).getByText(/2 phases/)).toBeInTheDocument();
  });
});

describe('ProjetsPage — phases séquentielles', () => {
  it('refuse de cocher une phase avant la précédente', () => {
    render(<ProjetsPage />);
    const cases = screen.getAllByRole('checkbox');
    fireEvent.click(cases[1]);

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/phase précédente/i));
    expect(storeState.setProjets).not.toHaveBeenCalled();
  });

  it('coche la première phase', () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(storeState.setProjets.mock.calls[0][0][0].phases[0].complete).toBe(true);
  });

  it('décoche les phases suivantes en cascade', () => {
    // Régression : décocher la phase 1 laissait la phase 2 terminée, un état
    // que la règle séquentielle interdit pourtant.
    storeState.projets = [projet({ phases: [
      { id: 'ph1', nom: 'A', complete: true },
      { id: 'ph2', nom: 'B', complete: true },
    ] })];
    render(<ProjetsPage />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    const phases = storeState.setProjets.mock.calls[0][0][0].phases;
    expect(phases.map(p => p.complete)).toEqual([false, false]);
  });

  it('ajoute une phase', () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une phase/i }));
    fireEvent.change(screen.getByPlaceholderText(/Nom de la phase/i), { target: { value: 'Tests' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ajouter$/ }));

    const phases = storeState.setProjets.mock.calls[0][0][0].phases;
    expect(phases).toHaveLength(3);
    expect(phases[2].nom).toBe('Tests');
  });

  it('nomme la phase avant de la supprimer', () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer la phase « Maquette »/i }));
    expect(within(screen.getByRole('alertdialog')).getByText(/Maquette/)).toBeInTheDocument();
  });
});

describe('ProjetsPage — temps investi', () => {
  it('totalise le temps des deux formats d\'historique', () => {
    // `duree` provient des entrées écrites avant l'alignement des formats.
    storeState.historique = [
      { type: 'PROJET', duree: 30 },
      { type: 'PROJET', dureeMinutes: 45 },
      { type: 'TD', dureeMinutes: 20 },
    ];
    render(<ProjetsPage />);
    expect(screen.getByText('75 min')).toBeInTheDocument();
  });

  it('enregistre le temps par le circuit habituel de l\'historique', async () => {
    // Régression : un POST direct suivi d'un setState brut n'atteignait ni la
    // base locale ni la série, et écrivait un format que les statistiques
    // ignoraient.
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Temps/i }));

    const champ = await screen.findByRole('textbox', { name: /Combien de minutes/i });
    fireEvent.change(champ, { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(storeState.addHistoriqueEntry).toHaveBeenCalled());
    expect(storeState.addHistoriqueEntry.mock.calls[0][0]).toMatchObject({
      type: 'PROJET', titre: 'Portfolio', dureeMinutes: 40, projetId: 'p1',
    });
  });

  it('refuse une durée invalide', async () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Temps/i }));

    const champ = await screen.findByRole('textbox', { name: /Combien de minutes/i });
    fireEvent.change(champ, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(storeState.addHistoriqueEntry).not.toHaveBeenCalled();
  });

  it('démarre le chrono sur le projet', () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByTitle(/Démarrer le chronomètre/i));
    expect(chronoState.startGlobalChrono).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });
});

describe('ProjetsPage — renommage', () => {
  /** Saisit une valeur dans la fenêtre de saisie et valide. */
  const repondre = async (valeur) => {
    // La page porte d'autres champs (nouveau projet) : on se limite
    // a la fenetre de saisie.
    const fenetre = await screen.findByRole('dialog');
    const champ = within(fenetre).getByRole('textbox');
    fireEvent.change(champ, { target: { value: valeur } });
    fireEvent.keyDown(window, { key: 'Enter' });
  };

  it('renomme un projet sans toucher à ses phases', async () => {
    // Seule l'échéance pouvait être corrigée : un titre mal saisi obligeait à
    // supprimer le projet, donc son avancement.
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Renommer « Portfolio »/ }));
    await repondre('Portfolio 2027');

    await waitFor(() => expect(storeState.setProjets).toHaveBeenCalled());
    const [projets, options] = storeState.setProjets.mock.calls[0];
    expect(projets[0]).toMatchObject({ id: 'p1', titre: 'Portfolio 2027' });
    expect(projets[0].phases).toHaveLength(2);
    expect(options).toMatchObject({ libelle: expect.stringContaining('Renommage') });
  });

  it('renomme une étape', async () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Renommer la phase « Maquette »/ }));
    await repondre('Wireframes');

    await waitFor(() => expect(storeState.setProjets).toHaveBeenCalled());
    const [projets] = storeState.setProjets.mock.calls[0];
    expect(projets[0].phases[0]).toMatchObject({ id: 'ph1', nom: 'Wireframes' });
    expect(projets[0].phases[1].nom).toBe('Intégration');
  });

  it('refuse un nom vide plutôt que d’effacer le titre', async () => {
    render(<ProjetsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Renommer « Portfolio »/ }));
    await repondre('   ');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(storeState.setProjets).not.toHaveBeenCalled();
  });
});
