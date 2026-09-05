import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { ToastProvider } from './ToastProvider';

// framer-motion : composants de présentation uniquement. On rend des éléments neutres
// et on écarte les props d'animation, qui ne sont pas des attributs DOM valides.
vi.mock('framer-motion', () => {
  const React = require('react');
  const ANIMATION_PROPS = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'layout', 'layoutId',
  ]);
  const strip = (props) => Object.fromEntries(
    Object.entries(props).filter(([k]) => !ANIMATION_PROPS.has(k))
  );
  const motion = new Proxy({}, {
    get: (_, tag) => ({ children, ...props }) =>
      React.createElement(typeof tag === 'string' ? tag : 'div', strip(props), children),
  });
  return {
    motion,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// État du store, redéfini par chaque test.
let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return {
    default: useStore,
    useChronoStore: Object.assign(() => ({}), { getState: () => ({ startGlobalChrono: vi.fn() }) }),
  };
});

const EMPTY_STORE = {
  config: null,
  coursConfig: null,
  loading: false,
  historique: [],
  projets: [],
  orchestratorData: null,
  fetchOrchestrator: vi.fn().mockResolvedValue(undefined),
  intelligence: null,
  pendingTasksCount: 0,
  dailyFillGap: false,
  setDailyFillGap: vi.fn(),
  setConfig: vi.fn(),
  addHistoriqueEntry: vi.fn(),
  activateRestDay: vi.fn(),
  activateExtendedRestDay: vi.fn(),
  declineExtendedRestDay: vi.fn(),
  setCoursConfig: vi.fn(),
};

const renderDashboard = () =>
  render(<ToastProvider><Dashboard /></ToastProvider>);

beforeEach(() => {
  storeState = { ...EMPTY_STORE };
});

describe('Dashboard — première utilisation, base vide', () => {
  it('accueille l\'utilisateur au lieu de planter quand aucune donnée n\'existe', async () => {
    renderDashboard();
    expect(await screen.findByText(/Bienvenue sur ELPIS/i)).toBeInTheDocument();
  });

  it('invite à configurer cours et objectifs', async () => {
    renderDashboard();
    expect(await screen.findByText(/Configure tes objectifs et tes cours/i)).toBeInTheDocument();
  });

  it('n\'affiche ni NaN ni Infinity avec des compteurs à zéro', async () => {
    storeState.orchestratorData = {
      statut: 'OK',
      tempsDispoMin: 0,
      tempsRequisMin: 0,
      tempsDejaTravailleMin: 0,
      tachesDuJour: [],
    };
    storeState.config = { currentStreak: 0, bestStreak: 0 };

    const { container } = renderDashboard();
    // Sans cursus saisi, l'écran d'accueil n'annonce plus une journée accomplie.
    await screen.findByText(/Ton programme attend son contenu/i);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("distingue un cursus sans contenu d'une journée terminée", async () => {
    /*
     * Zéro tâche recouvrait deux situations très différentes : tout est fait,
     * ou rien n'a encore été saisi. Le jour de la rentrée, l'application
     * félicitait donc d'avoir accompli une journée qui n'avait jamais existé.
     */
    storeState.orchestratorData = {
      statut: 'OK', tempsDispoMin: 300, tempsRequisMin: 0,
      tempsDejaTravailleMin: 0, tachesDuJour: [],
    };
    storeState.coursConfig = { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres: [
      { nom: 'Mécanique', listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] };

    renderDashboard();
    expect(await screen.findByText(/Ton programme attend son contenu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ouvrir la Bibliothèque/i })).toBeInTheDocument();
  });

  it('félicite quand le programme du jour a bien été accompli', async () => {
    storeState.orchestratorData = {
      statut: 'OK', tempsDispoMin: 300, tempsRequisMin: 0,
      tempsDejaTravailleMin: 120, tachesDuJour: [],
    };
    storeState.coursConfig = { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres: [
      { nom: 'Mécanique', listeCM: [{ titre: 'Ch1' }], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] };

    renderDashboard();
    expect(await screen.findByText(/Tout est terminé/i)).toBeInTheDocument();
  });
});

describe('Dashboard — temps travaillé du jour', () => {
  it('additionne les sessions du jour à partir de leur horodatage', async () => {
    // Régression : le filtrage se faisait sur un champ `date` inexistant, si bien que
    // le compteur affichait 0h quel que soit le travail accompli.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-07T20:00:00'));

    storeState.historique = [
      { type: 'CM', timestamp: '2026-09-07T09:00:00', dureeMinutes: 60 },
      { type: 'TD', timestamp: '2026-09-07T14:00:00', dureeMinutes: 30 },
      { type: 'CM', timestamp: '2026-09-05T14:00:00', dureeMinutes: 120 }, // autre jour
    ];
    storeState.config = { currentStreak: 3, bestStreak: 5 };
    // Un cursus doté de contenu : sans lui, l'accueil dirige vers la
    // Bibliothèque au lieu d'annoncer une journée accomplie.
    storeState.coursConfig = { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres: [
      { nom: 'Mécanique', listeCM: [{ titre: 'Ch1' }], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] };
    storeState.orchestratorData = {
      statut: 'OK',
      tempsDispoMin: 240,
      tempsRequisMin: 120,
      tempsDejaTravailleMin: 90,
      tachesDuJour: [],
    };

    const { container } = renderDashboard();
    await screen.findByText(/Tout est terminé/i);

    // 60 + 30 = 90 min = 1.5h, en excluant la session d'avant-hier.
    expect(container.textContent).toContain('1.5h');

    vi.useRealTimers();
  });
});
