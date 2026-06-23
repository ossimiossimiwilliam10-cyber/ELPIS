import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

vi.mock('../store', () => {
  let state = {
    loading: false,
    error: null,
    activeTab: 'dashboard',
    initData: vi.fn(),
    setActiveTab: vi.fn(),
    setConfig: vi.fn(),
    fetchOrchestrator: vi.fn(),
    config: {},
    coursConfig: {},
    historique: [],
    pendingTasksCount: 0,
    orchestratorData: {
      tachesDuJour: [],
      tachesCompletes: []
    },
    globalChrono: {
      isRunning: false
    }
  };
  return {
    default: Object.assign(() => state, {
      getState: () => state,
      setState: (newState) => { state = { ...state, ...newState }; },
    })
  };
});

describe('App', () => {
  it('renders the app with sidebar', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getAllByText('ELPIS').length).toBeGreaterThan(0);
  });
});
