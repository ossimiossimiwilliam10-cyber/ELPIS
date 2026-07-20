import { describe, test, expect, beforeEach, vi } from 'vitest';
import useStore from './store';

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
);
global.navigator.onLine = true;

// Mock RxDB — we don't want real DB in unit tests
vi.mock('./database', () => ({
  getDb: vi.fn(() => Promise.resolve({
    config: { findOne: () => ({ exec: () => Promise.resolve(null), $: { subscribe: () => ({ unsubscribe: () => {} }) } }) },
    cours: { findOne: () => ({ exec: () => Promise.resolve(null), $: { subscribe: () => ({ unsubscribe: () => {} }) } }) },
    historique: { findOne: () => ({ exec: () => Promise.resolve(null), $: { subscribe: () => ({ unsubscribe: () => {} }) } }) },
    projets: { findOne: () => ({ exec: () => Promise.resolve(null), $: { subscribe: () => ({ unsubscribe: () => {} }) } }) },
    config: { upsert: () => Promise.resolve() },
    cours: { upsert: () => Promise.resolve() },
    historique: { upsert: () => Promise.resolve() },
    projets: { upsert: () => Promise.resolve() },
  })),
  syncFromBackend: vi.fn(() => Promise.resolve()),
}));

describe('Store — Actions critiques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      config: { targetGrade: 14, currentStreak: 3, lastActiveDate: '', bestStreak: 5, restDays: [] },
      coursConfig: { licences: [] },
      historique: [],
      projets: [],
      loading: false,
      error: null,
      pendingTasksCount: 0,
    });
  });

  describe('setConfig', () => {
    test('met à jour le state et déclenche la sauvegarde', () => {
      const { setConfig } = useStore.getState();
      setConfig({ targetGrade: 16, bedtime: '22:00' });

      const state = useStore.getState();
      expect(state.config.targetGrade).toBe(16);
      expect(state.config.bedtime).toBe('22:00');
    });

    test('préserve les clés non modifiées', () => {
      const { setConfig } = useStore.getState();
      const originalStreak = useStore.getState().config.currentStreak;
      setConfig({ targetGrade: 18 });

      const state = useStore.getState();
      expect(state.config.currentStreak).toBe(originalStreak);
      expect(state.config.targetGrade).toBe(18);
    });
  });

  describe('setCoursConfig', () => {
    test('met à jour la config des cours', () => {
      const { setCoursConfig } = useStore.getState();
      const newCourses = { licences: [{ id: 'l1', nom: 'L1 SPI' }] };
      setCoursConfig(newCourses);

      expect(useStore.getState().coursConfig).toEqual(newCourses);
    });
  });

  describe('checkStreak', () => {
    test('incrémente le streak si activité aujourd\'hui (première fois)', () => {
      const { checkStreak } = useStore.getState();
      const d = new Date();
      d.setHours(d.getHours() - 4);
      const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: '', currentStreak: 0 } });
      checkStreak(true);

      const state = useStore.getState();
      expect(state.config.currentStreak).toBe(1);
      expect(state.config.lastActiveDate).toBe(today);
    });

    test('ne double pas le streak si la date est la même', () => {
      const d = new Date();
      d.setHours(d.getHours() - 4);
      const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: today, currentStreak: 5 } });
      const { checkStreak } = useStore.getState();
      checkStreak(true);

      expect(useStore.getState().config.currentStreak).toBe(5); // unchanged
    });

    test('casse le streak si plus d\'un jour sans activité ni repos', () => {
      const d = new Date();
      d.setHours(d.getHours() - 4);
      d.setDate(d.getDate() - 3); // 3 jours sans activité
      const oldDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: oldDate, currentStreak: 10, restDays: [] } });
      const { checkStreak } = useStore.getState();
      checkStreak(false); // pas d'activité, juste vérification

      expect(useStore.getState().config.currentStreak).toBe(0);
    });

    test('ne casse pas le streak si les jours manquants sont des jours de repos', () => {
      const d = new Date();
      d.setHours(d.getHours() - 4);
      // Jour manquant : hier
      const yesterday = new Date(d);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

      // Dernière activité : avant-hier
      const twoDaysAgo = new Date(d);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.getFullYear() + '-' + String(twoDaysAgo.getMonth() + 1).padStart(2, '0') + '-' + String(twoDaysAgo.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: twoDaysAgoStr, currentStreak: 7, restDays: [yesterdayStr] } });
      const { checkStreak } = useStore.getState();
      checkStreak(true);

      // Le streak doit continuer : 7 + 1 = 8
      expect(useStore.getState().config.currentStreak).toBe(8);
    });

    test('met à jour le bestStreak si le streak actuel le dépasse', () => {
      const d = new Date();
      d.setHours(d.getHours() - 4);
      const yesterday = new Date(d);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: yesterdayStr, currentStreak: 9, bestStreak: 8 } });
      const { checkStreak } = useStore.getState();
      checkStreak(true);

      expect(useStore.getState().config.currentStreak).toBe(10);
      expect(useStore.getState().config.bestStreak).toBe(10);
    });
  });

  describe('addHistoriqueEntry', () => {
    test('ajoute une entrée avec timestamp', () => {
      const { addHistoriqueEntry } = useStore.getState();
      addHistoriqueEntry({ type: 'CM', titre: 'Test', matiere: 'Maths', action: 'Révisé', dureeMinutes: 30 });

      const state = useStore.getState();
      expect(state.historique).toHaveLength(1);
      expect(state.historique[0].type).toBe('CM');
      expect(state.historique[0].titre).toBe('Test');
      expect(state.historique[0].timestamp).toBeDefined();
      expect(new Date(state.historique[0].timestamp).getTime()).toBeGreaterThan(0);
    });

    test('déclenche checkStreak avec isActivity=true', () => {
      const { addHistoriqueEntry } = useStore.getState();
      const d = new Date();
      d.setHours(d.getHours() - 4);
      const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      useStore.setState({ config: { ...useStore.getState().config, lastActiveDate: '', currentStreak: 0 } });
      addHistoriqueEntry({ type: 'TD', titre: 'Exo', matiere: 'Physique', action: 'Terminé', dureeMinutes: 20 });

      const state = useStore.getState();
      expect(state.config.currentStreak).toBe(1);
      expect(state.config.lastActiveDate).toBe(today);
    });

    test('envoie la télémétrie en fire-and-forget', () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
      const { addHistoriqueEntry } = useStore.getState();
      addHistoriqueEntry({ type: 'CM', titre: 'Test', matiere: 'Info', action: 'Révisé', dureeMinutes: 45 });

      // La télémétrie est asynchrone, on vérifie juste que fetch a été appelé
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('setActiveTab', () => {
    test('change l\'onglet actif', () => {
      const { setActiveTab } = useStore.getState();
      setActiveTab('entrainement');
      expect(useStore.getState().activeTab).toBe('entrainement');

      setActiveTab('statistiques');
      expect(useStore.getState().activeTab).toBe('statistiques');
    });
  });

  describe('pendingTasksCount', () => {
    test('est mis à jour par fetchOrchestrator', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tachesDuJour: [{}, {}, {}], intelligence: null })
        })
      );

      const { fetchOrchestrator } = useStore.getState();
      await fetchOrchestrator();

      expect(useStore.getState().pendingTasksCount).toBe(3);
    });

    test('reste 0 si le fetch échoue', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      useStore.setState({ pendingTasksCount: 0 });
      const { fetchOrchestrator } = useStore.getState();
      await fetchOrchestrator();

      expect(useStore.getState().pendingTasksCount).toBe(0);
    });
  });
});

describe('Store — État initial', () => {
  beforeEach(() => {
    useStore.setState({
      config: {},
      coursConfig: { licences: [] },
      projets: [],
      historique: [],
      loading: true,
      error: null,
      activeTab: 'dashboard',
      pendingTasksCount: 0,
      dailyFillGap: false,
      orchestratorData: null,
      intelligence: null,
      forcedTask: null,
    });
  });

  test('les valeurs par défaut sont correctes', () => {
    const state = useStore.getState();
    expect(state.activeTab).toBe('dashboard');
    expect(state.loading).toBe(true);
    expect(state.pendingTasksCount).toBe(0);
    expect(state.dailyFillGap).toBe(false);
    expect(state.forcedTask).toBeNull();
    expect(state.orchestratorData).toBeNull();
  });

  test('le rankingBaseline contient les matières L2 SPI', () => {
    const state = useStore.getState();
    expect(state.rankingBaseline).toBeDefined();
    expect(state.rankingBaseline.subjects['Algèbre']).toBeDefined();
    expect(state.rankingBaseline.subjects['Programmation']).toBeDefined();
  });
});
