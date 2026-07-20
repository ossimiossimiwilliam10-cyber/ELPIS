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

// Mock useInputModal
const mockPrompt = vi.fn();
vi.mock('../../hooks/useInputModal', () => ({
  default: () => ({
    prompt: mockPrompt,
    isOpen: false,
    config: { title: '', defaultValue: '', placeholder: '' },
    handleConfirm: vi.fn(),
    handleCancel: vi.fn()
  })
}));

// Mock InputModal
vi.mock('../InputModal', () => ({
  default: () => null
}));

// Mock InfoTooltip
vi.mock('../InfoTooltip', () => ({
  default: ({ children }) => <span data-testid="info-tooltip">{children}</span>
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

    // Mock the prompt to resolve with '15'
    mockPrompt.mockResolvedValue('15');
  });

  it('Anti-regression: shows a prompt for time when completing an ANKI task', async () => {
    const ankiTask = { id: 'anki-1', titre: 'Anki quotidien', type: 'ANKI', matiere: 'Toutes' };
    const onMarkAsDone = vi.fn();

    render(<ExerciceCard exo={ankiTask} onMarkAsDone={onMarkAsDone} onEvaluateCM={vi.fn()} />);

    const completeButton = screen.getByText('Fait');
    fireEvent.click(completeButton);

    expect(mockPrompt).toHaveBeenCalledWith(expect.stringContaining('Temps passé sur Anki'), '');

    // Wait for the async prompt to resolve
    await vi.waitFor(() => {
      expect(onMarkAsDone).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANKI' }), '', 15);
    });
  });
});
