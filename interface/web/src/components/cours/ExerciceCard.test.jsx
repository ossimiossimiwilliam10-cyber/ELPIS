import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciceCard from './ExerciceCard';
import useStore, { useChronoStore } from '../../store';

// Mock the store
vi.mock('../../store', () => {
  return {
    __esModule: true,
    default: vi.fn(),
    useChronoStore: vi.fn()
  };
});

// Mock ToastProvider
vi.mock('../../ToastProvider', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
  })
}));

// Mock InfoTooltip to avoid importing framer-motion unnecessarily
vi.mock('../InfoTooltip', () => ({
  default: ({ text }) => <span data-testid="info-tooltip">{text}</span>
}));

describe('ExerciceCard Anti-regression tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.mockReturnValue({
      globalChrono: { isRunning: false, elapsedSeconds: 0, exoId: null },
      addHistoriqueEntry: vi.fn(),
      setConfig: vi.fn(),
      config: {}
    });
    useChronoStore.mockReturnValue({
      globalChrono: { isRunning: false, elapsedSeconds: 0, exoId: null },
      startGlobalChrono: vi.fn(),
      toggleGlobalChrono: vi.fn(),
      resetGlobalChrono: vi.fn()
    });
    
    // Mock window.prompt
    vi.spyOn(window, 'prompt').mockImplementation(() => '15');
  });

  it('Anti-regression: shows a prompt for time when completing an ANKI task', () => {
    const ankiTask = { id: 'anki-1', titre: 'Anki quotidien', type: 'ANKI', matiere: 'Toutes' };
    const onMarkAsDone = vi.fn();
    
    render(<ExerciceCard exo={ankiTask} onMarkAsDone={onMarkAsDone} onEvaluateCM={vi.fn()} />);
    
    // The button for ANKI defaults to "Fait"
    const completeButton = screen.getByText('Fait');
    fireEvent.click(completeButton);
    
    expect(window.prompt).toHaveBeenCalledWith(expect.stringContaining('Temps passé sur Anki'), "");
    
    // Check that onMarkAsDone was called with the task and the inputted time (15)
    // The arguments for onMarkAsDone in handleValidation are (exo, difficulte, finalMinutes)
    // For the "Fait" button, difficulte is ""
    expect(onMarkAsDone).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANKI' }), "", 15);
  });
});
