import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GlobalChrono from './GlobalChrono';
import useStore, { useChronoStore } from '../store';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ toast: { success: vi.fn() } }) }));

describe('GlobalChrono', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChronoStore.setState({
      globalChrono: {
        isRunning: false,
        elapsedSeconds: 0,
        titre: 'Test Task',
        matiereNom: 'Maths',
        exoId: '123',
        type: 'CM',
        lastTickDate: null
      }
    });
    useStore.setState({
      addHistoriqueEntry: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders correctly by default', () => {
    render(<GlobalChrono />);
    // The play button should be visible
    expect(screen.getByText('▶')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('starts the timer and updates elapsed time', () => {
    render(<GlobalChrono />);
    
    expect(screen.getByText('00:00')).toBeInTheDocument();
    
    // Simulate what the orchestrator/store does when running
    act(() => {
      useChronoStore.setState({
        globalChrono: {
          ...useChronoStore.getState().globalChrono,
          isRunning: true,
          lastTickDate: Date.now()
        }
      });
    });

    act(() => {
      vi.advanceTimersByTime(60000);
      useChronoStore.getState().tickGlobalChrono();
    });

    expect(screen.getByText('01:00')).toBeInTheDocument();
  });

  it('handles save correctly', async () => {
    const { container } = render(<GlobalChrono />);
    const addHistoriqueEntry = useStore.getState().addHistoriqueEntry;
    
    act(() => {
      useChronoStore.setState({
        globalChrono: {
          ...useChronoStore.getState().globalChrono,
          elapsedSeconds: 120, // 2 minutes
          exoId: '123'
        }
      });
    });

    // Trigger hover to reveal the save button
    const widget = container.querySelector('.global-timer-widget > div');
    if (widget) {
      fireEvent.mouseEnter(widget);
    } else {
      fireEvent.mouseEnter(container.firstChild.firstChild);
    }

    // Advance fake timers so framer-motion finishes rendering
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const saveButton = screen.getByText('✅');
    fireEvent.click(saveButton);

    // After save, the canvas-confetti is called which returns a promise.
    // Ensure that works.
    expect(addHistoriqueEntry).toHaveBeenCalledWith(expect.objectContaining({
      dureeMinutes: 2,
      matiere: 'Maths'
    }));
  });

  it('can edit time manually by clicking the time display', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('15.5');
    
    render(<GlobalChrono />);
    // The time display itself is clickable
    const timeDisplay = screen.getByText('00:00');
    fireEvent.click(timeDisplay);

    const state = useChronoStore.getState().globalChrono;
    expect(state.elapsedSeconds).toBe(15.5 * 60);
  });
});
