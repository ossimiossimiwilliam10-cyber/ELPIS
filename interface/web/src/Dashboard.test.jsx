import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import useStore from './store';

vi.mock('./store', () => ({
  default: vi.fn(),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } })
}));

vi.mock('./useWorkloadEngine', () => ({
  useWorkloadEngine: () => 2
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div data-testid="dnd-context">{children}</div>,
  Droppable: ({ children }) => children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false })
}));

describe('Dashboard Component', () => {
  let fetchOrchestratorMock;

  beforeEach(() => {
    fetchOrchestratorMock = vi.fn().mockResolvedValue();
    useStore.mockReturnValue({
      config: { restDays: [] },
      coursConfig: {
        licences: []
      },
      orchestratorData: {
        statut: "NORMAL",
        tempsDispoMin: 120,
        tempsRequisMin: 90,
        tachesDuJour: [
          { type: 'CM', titre: 'Chapitre 1', matiere: 'Droit', dureeMinutes: 30, moment: 'matin' }
        ]
      },
      intelligence: {
        burnoutRisk: { riskLevel: 'none', daysWithoutRest: 5, avgDailyMinutes: 60 }
      },
      fetchOrchestrator: fetchOrchestratorMock,
      addHistoriqueEntry: vi.fn(),
      setCoursConfig: vi.fn()
    });
  });

  it('renders tasks correctly', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Chapitre 1')).toBeDefined();
      expect(screen.getByText('Droit • CM')).toBeDefined();
    });
  });

  it('shows empty state when no tasks are present', async () => {
    useStore.mockReturnValue({
      config: { restDays: [] },
      coursConfig: { licences: [] },
      orchestratorData: {
        statut: "NORMAL",
        tempsDispoMin: 120,
        tempsRequisMin: 0,
        tachesDuJour: []
      },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Tout est terminé !')).toBeDefined();
    });
  });

  it('shows REPOS mode correctly', async () => {
    useStore.mockReturnValue({
      config: { restDays: [] },
      coursConfig: { licences: [] },
      orchestratorData: {
        statut: "REPOS",
        tempsDispoMin: 120,
        tempsRequisMin: 0,
        tachesDuJour: [],
        message: "Repose-toi bien."
      },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Mode Repos Activé')).toBeDefined();
    });
  });
  
  it('displays burnout insights if available', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('✅ Burnout : Aucun risque détecté')).toBeDefined();
    });
  });
});
