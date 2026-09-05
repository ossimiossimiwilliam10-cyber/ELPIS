import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import cursusReel from '../../../backups/espoir_cours_2026-07-15.json';

/**
 * Test de fumée : chaque page se monte-t-elle sans casser ?
 *
 * Les tests existants couvrent le comportement page par page, avec des
 * données taillées pour l'assertion visée. Aucun ne vérifiait qu'une page
 * survit à un cursus *réel* — 36 matières, 78 cours, 122 exercices, avec ses
 * champs manquants, ses dates absentes et ses listes vides.
 *
 * C'est pourtant là que se logent les plantages qu'on ne découvre qu'en
 * ouvrant l'onglet un mardi soir : un `.length` sur un tableau absent, une
 * division par le nombre de séances quand il n'y en a aucune, une date jamais
 * renseignée passée à `toLocaleDateString`.
 *
 * Le test ne juge pas l'apparence. Il vérifie trois choses : la page se monte,
 * elle n'écrit ni « NaN » ni « undefined » à l'écran, et elle affiche quelque
 * chose.
 */

let etatStore;
let etatChrono;

vi.mock('./store', () => {
  const useStore = (selecteur) => (selecteur ? selecteur(etatStore) : etatStore);
  useStore.getState = () => etatStore;
  useStore.setState = vi.fn();
  const useChronoStore = (selecteur) => (selecteur ? selecteur(etatChrono) : etatChrono);
  useChronoStore.getState = () => etatChrono;
  useChronoStore.subscribe = vi.fn(() => vi.fn());
  return { default: useStore, useChronoStore };
});

/*
 * Le graphe 3D exige un contexte WebGL, que jsdom n'a pas. On simule le rendu :
 * ce test vérifie qu'une page se monte et ne laisse fuir aucun calcul raté, pas
 * que Three.js sait dessiner.
 */
vi.mock('react-force-graph-3d', () => ({
  default: ({ graphData }) => (
    <div data-testid="graphe-3d">{(graphData?.nodes || []).length} noeuds</div>
  ),
}));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('./ToastProvider', () => ({
  useToast: () => ({ toast, addToast: vi.fn(), removeToast: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));

/** Historique plausible : quelques séances réparties sur le mois écoulé. */
const historiqueReel = Array.from({ length: 24 }, (_, i) => ({
  id: `h${i}`,
  type: ['CM', 'TD', 'ANKI', 'ANNALE'][i % 4],
  titre: `Séance ${i}`,
  matiere: ['Programmation', 'Algèbre', 'Analyse', 'Électromagnétisme'][i % 4],
  action: 'Terminé',
  dureeMinutes: 20 + (i % 4) * 15,
  timestamp: new Date(2026, 7, 1 + (i % 26), 10).toISOString(),
}));

const PAGES = [
  ['Dashboard', () => import('./Dashboard')],
  ['EntrainementPage', () => import('./EntrainementPage')],
  ['RevisionsAvanceesPage', () => import('./RevisionsAvanceesPage')],
  ['CoursPage', () => import('./CoursPage')],
  ['MesVideosPage', () => import('./MesVideosPage')],
  ['PreparationHebdoPage', () => import('./PreparationHebdoPage')],
  ['BulletinPage', () => import('./BulletinPage')],
  ['ProjetsPage', () => import('./ProjetsPage')],
  ['LanguesPage', () => import('./LanguesPage')],
  ['StagesPage', () => import('./StagesPage')],
  ['AbsencesPage', () => import('./AbsencesPage')],
  ['PlanningPage', () => import('./PlanningPage')],
  ['StatistiquesPage', () => import('./StatistiquesPage')],
  ['ClassementPage', () => import('./ClassementPage')],
  ['ConfigPage', () => import('./ConfigPage')],
  // Ces deux pages n'étaient couvertes par aucun test : le graphe 3D et la
  // bibliothèque musicale sont pourtant deux onglets à part entière.
  ['GraphPage', () => import('./GraphPage')],
  ['MusicSettingsModal', () => import('./components/MusicSettingsModal')],
];

/** Traces d'un calcul qui a mal tourné, visibles par l'utilisateur. */
const TRACES = /\bNaN\b|\bundefined\b|\bInfinity\b|Invalid Date|\[object Object\]/;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, decks: [], livres: [], langues: [], versions: {} }),
    headers: { get: () => null },
  }));

  etatChrono = {
    globalChrono: { active: false, taskId: null, seconds: 0, isPaused: false },
    startGlobalChrono: vi.fn(), stopGlobalChrono: vi.fn(),
    resetGlobalChrono: vi.fn(), pauseGlobalChrono: vi.fn(),
  };

  etatStore = {
    config: {
      studyStartDate: '07-09-2026', maxStudyHoursPerDay: 6,
      maxSubjectsPerDay: 3, currentStreak: 3, bestStreak: 9,
      restDays: [], skippedRestDays: [], subjects: [], fixedCommitments: [],
      absences: [], stages: [], langues: [], mesVideos: [],
      enableTD: true, enableAnnales: true,
    },
    coursConfig: cursusReel,
    historique: historiqueReel,
    projets: [],
    loading: false,
    error: null,
    activeTab: 'dashboard',
    pendingTasksCount: 3,
    dailyFillGap: false,
    orchestratorData: {
      statut: 'OK', tempsDispoMin: 360, tempsRequisMin: 180,
      tempsDejaTravailleMin: 0, tachesDuJour: [], intelligence: {},
    },
    intelligence: {},
    rankingBaseline: { globalMean: 50, globalSD: 15, metrics: {}, subjects: {} },
    forcedTask: null,
    dernierBilanSync: null,
    pileAnnulation: { passe: [], futur: [] },
    setActiveTab: vi.fn(), setConfig: vi.fn(), setCoursConfig: vi.fn(),
    setProjets: vi.fn(), setHistorique: vi.fn(), addHistoriqueEntry: vi.fn(),
    fetchOrchestrator: vi.fn(), notifyTaskCompleted: vi.fn(),
    setDailyFillGap: vi.fn(), setForcedTask: vi.fn(), resynchroniser: vi.fn(),
    annulerDernierGeste: vi.fn(), retablirDernierGeste: vi.fn(),
    updatePendingTasksCount: vi.fn(), activateRestDay: vi.fn(),
  };
});

afterEach(() => { vi.restoreAllMocks(); });

describe('Toutes les pages — montage sur un cursus réel', () => {
  for (const [nom, charger] of PAGES) {
    it(`${nom} se monte sans erreur`, async () => {
      const { default: Page } = await charger();
      expect(() => render(<Page setActiveTab={vi.fn()} onClose={vi.fn()} />)).not.toThrow();
    });

    it(`${nom} n'affiche aucune trace de calcul raté`, async () => {
      const { default: Page } = await charger();
      const { container } = render(<Page setActiveTab={vi.fn()} onClose={vi.fn()} />);
      const texte = container.textContent || '';
      const fautives = texte.split('\n').map(l => l.trim()).filter(l => l && TRACES.test(l));
      expect(fautives, `${nom} : ${fautives.slice(0, 3).join(' | ')}`).toHaveLength(0);
    });

    it(`${nom} produit un rendu`, async () => {
      // On mesure le rendu et non le texte : l'Accueil et le Planning
      // commencent par un squelette de chargement, qui n'en contient aucun.
      const { default: Page } = await charger();
      const { container } = render(<Page setActiveTab={vi.fn()} onClose={vi.fn()} />);
      expect(container.innerHTML.length).toBeGreaterThan(50);
    });
  }
});

describe('Pages sensibles — cursus vide', () => {
  /*
   * L'état d'un nouvel utilisateur, et celui de la base actuelle : des
   * matières déclarées mais aucun contenu. Les moyennes, taux et projections
   * divisent alors par zéro.
   */
  beforeEach(() => {
    etatStore.coursConfig = { licences: [] };
    etatStore.historique = [];
    etatStore.pendingTasksCount = 0;
  });

  for (const [nom, charger] of PAGES) {
    it(`${nom} survit à un cursus vide`, async () => {
      const { default: Page } = await charger();
      const { container } = render(<Page setActiveTab={vi.fn()} onClose={vi.fn()} />);
      const texte = container.textContent || '';
      const fautives = texte.split('\n').map(l => l.trim()).filter(l => l && TRACES.test(l));
      expect(fautives, `${nom} (vide) : ${fautives.slice(0, 3).join(' | ')}`).toHaveLength(0);
    });
  }
});
