import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore from '../store';

// Mock fetch globally
globalThis.fetch = vi.fn();

describe('useStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useStore.setState({
      config: {},
      coursConfig: { licences: [] },
      historique: [],
      loading: true,
      error: null,
      activeTab: 'dashboard',
      pendingTasksCount: 0,
      dailyFillGap: false,
      orchestratorData: null,
      intelligence: null,
      globalChrono: {
        exoId: null,
        titre: null,
        matiereNom: null,
        isRunning: false,
        elapsedSeconds: 0,
        lastTickDate: null
      }
    });
    vi.clearAllMocks();
  });

  it('sets active tab correctly', () => {
    const store = useStore.getState();
    expect(store.activeTab).toBe('dashboard');
    store.setActiveTab('config');
    expect(useStore.getState().activeTab).toBe('config');
  });

  it('handles global chrono start and toggle', () => {
    const store = useStore.getState();
    store.startGlobalChrono({ titre: 'Exo Test', matiereNom: 'Maths' });
    
    let currentState = useStore.getState();
    expect(currentState.globalChrono.isRunning).toBe(true);
    expect(currentState.globalChrono.titre).toBe('Exo Test');
    expect(currentState.globalChrono.matiereNom).toBe('Maths');

    // Toggle pause
    currentState.toggleGlobalChrono();
    expect(useStore.getState().globalChrono.isRunning).toBe(false);

    // Toggle resume
    useStore.getState().toggleGlobalChrono();
    expect(useStore.getState().globalChrono.isRunning).toBe(true);
  });

  it('fetches initial data successfully', async () => {
    // Setup mock responses
    fetch.mockImplementation((url) => {
      if (url.endsWith('/config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ targetGrade: 15 }) });
      }
      if (url.endsWith('/cours')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ licences: [{ nom: 'L1' }] }) });
      }
      if (url.endsWith('/historique')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ type: 'CM' }]) });
      }
      if (url.includes('/orchestrateur')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ intelligence: {}, tachesDuJour: [] }) });
      }
      return Promise.reject(new Error('not found'));
    });

    const store = useStore.getState();
    await store.initData();

    const finalState = useStore.getState();
    expect(finalState.loading).toBe(false);
    expect(finalState.config.targetGrade).toBe(15);
    expect(finalState.coursConfig.licences[0].nom).toBe('L1');
    expect(finalState.historique.length).toBe(1);
    expect(finalState.error).toBeNull();
  });

  it('handles fetch errors during initData', async () => {
    fetch.mockRejectedValue(new Error('Network error'));
    const store = useStore.getState();
    await store.initData();
    const finalState = useStore.getState();
    expect(finalState.loading).toBe(false);
    expect(finalState.error).toBe('Network error');
  });

  it('checks streak correctly and saves config', () => {
    // Mock the date to a fixed value
    const dateMock = new Date('2023-10-10T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(dateMock);

    // Start with a config where lastActiveDate is yesterday
    useStore.setState({
      config: {
        lastActiveDate: '2023-10-09',
        currentStreak: 5,
        bestStreak: 10
      }
    });

    useStore.getState().checkStreak();

    // The date logic in store.js uses the local timezone and subtracts 4 hours.
    // For predictability in the test, we'll just check if currentStreak increased.
    const finalState = useStore.getState();
    // In our test, yesterday was 2023-10-09 and today is 2023-10-10. So streak should be 6.
    expect(finalState.config.currentStreak).toBe(6);
    expect(finalState.config.lastActiveDate).toBe('2023-10-10');

    vi.useRealTimers();
  });
});
