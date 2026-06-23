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
    }
  };
  const useStoreMock = (selector) => {
    if (selector) return selector(state);
    return state;
  };
  useStoreMock.getState = () => state;
  useStoreMock.setState = (newState) => { state = { ...state, ...newState }; };

  let chronoState = {
    globalChrono: {
      isRunning: false
    }
  };
  const useChronoStoreMock = (selector) => {
    if (selector) return selector(chronoState);
    return chronoState;
  };
  useChronoStoreMock.getState = () => chronoState;
  useChronoStoreMock.setState = (newState) => { chronoState = { ...chronoState, ...newState }; };

  return {
    __esModule: true,
    default: useStoreMock,
    useChronoStore: useChronoStoreMock
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
