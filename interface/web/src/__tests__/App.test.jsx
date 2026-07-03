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

  describe('Dynamic Themes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      document.documentElement.className = '';
    });

    it('applies theme-morning between 06:00 and 12:00', async () => {
      vi.setSystemTime(new Date(2026, 6, 3, 9, 30)); // 09:30
      await act(async () => {
        render(<App />);
      });
      expect(document.documentElement.classList.contains('theme-morning')).toBe(true);
    });

    it('applies theme-afternoon between 12:00 and 18:00', async () => {
      vi.setSystemTime(new Date(2026, 6, 3, 14, 0)); // 14:00
      await act(async () => {
        render(<App />);
      });
      expect(document.documentElement.classList.contains('theme-afternoon')).toBe(true);
    });

    it('applies theme-evening between 18:00 and 22:00', async () => {
      vi.setSystemTime(new Date(2026, 6, 3, 20, 0)); // 20:00
      await act(async () => {
        render(<App />);
      });
      expect(document.documentElement.classList.contains('theme-evening')).toBe(true);
    });

    it('applies theme-night after 22:00', async () => {
      vi.setSystemTime(new Date(2026, 6, 3, 23, 0)); // 23:00
      await act(async () => {
        render(<App />);
      });
      expect(document.documentElement.classList.contains('theme-night')).toBe(true);
    });
  });
});
