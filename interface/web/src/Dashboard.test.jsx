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

vi.mock('./hooks/useTaskCompletion', () => ({
  useTaskCompletion: () => ({
    completeTask: vi.fn(() => true),
    suspendCM: vi.fn(),
  }),
}));

vi.mock('./hooks/useDashboardStats', () => ({
  useDashboardStats: () => ({
    stats: { cmDue: 0, cmDone: 0, cmTotal: 0 },
    globalPercent: 0,
    allMatieres: ['Droit'],
    restDaysUsed: 0,
    todayStr: new Date().toISOString().split('T')[0],
    isRestDayToday: false,
  }),
}));

vi.mock('./hooks/useSoundEffects', () => ({
  useSoundEffects: () => ({ playTaskComplete: vi.fn() }),
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
      setCoursConfig: vi.fn(),
      activateRestDay: vi.fn()
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

  it('calls activateRestDay when rest day button is clicked', async () => {
    const activateRestDayMock = vi.fn();
    useStore.mockReturnValue({
      config: { restDays: [] },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tachesDuJour: [] },
      fetchOrchestrator: fetchOrchestratorMock,
      activateRestDay: activateRestDayMock,
    });
    
    // Simulate window.confirm
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    
    render(<Dashboard />);
    
    // Find and click the rest day button
    const restBtn = await screen.findByText(/Activer Jour de Repos/i);
    restBtn.click();
    
    expect(activateRestDayMock).toHaveBeenCalled();
    
    window.confirm = originalConfirm;
  });

  it('opens Custom Task (Activité Libre) modal when clicked', async () => {
    render(<Dashboard />);
    
    const customBtn = await screen.findByText('✨ Activité Libre');
    customBtn.click();
    
    await waitFor(() => {
      expect(screen.getByText('✨ Nouvelle Activité Libre')).toBeDefined();
      expect(screen.getByPlaceholderText('ex: Vidéo YouTube, Projet Perso...')).toBeDefined();
    });
  });

  // --- Extended Rest Day Modal Tests ---

  const getYesterdayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    const yesterday = new Date(d);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
  };

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  it('shows extended rest modal when yesterday was a rest day', async () => {
    const yesterdayStr = getYesterdayStr();
    useStore.mockReturnValue({
      config: { restDays: [yesterdayStr] },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tempsDispoMin: 120, tempsRequisMin: 0, tachesDuJour: [] },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
      activateExtendedRestDay: vi.fn(),
      declineExtendedRestDay: vi.fn(),
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Prolonger la récupération ?')).toBeDefined();
    });
  });

  it('does NOT show extended rest modal if declined today', async () => {
    const yesterdayStr = getYesterdayStr();
    const todayStr = getTodayStr();
    useStore.mockReturnValue({
      config: { restDays: [yesterdayStr], restDayExtensionDeclinedDate: todayStr },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tempsDispoMin: 120, tempsRequisMin: 0, tachesDuJour: [] },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
      activateExtendedRestDay: vi.fn(),
      declineExtendedRestDay: vi.fn(),
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Prolonger la récupération ?')).toBeNull();
    });
  });

  it('does NOT show extended rest modal if today is already a rest day', async () => {
    const yesterdayStr = getYesterdayStr();
    const todayStr = getTodayStr();
    useStore.mockReturnValue({
      config: { restDays: [yesterdayStr, todayStr] },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tempsDispoMin: 120, tempsRequisMin: 0, tachesDuJour: [] },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
      activateExtendedRestDay: vi.fn(),
      declineExtendedRestDay: vi.fn(),
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Prolonger la récupération ?')).toBeNull();
    });
  });

  it('calls activateExtendedRestDay when accepting the modal', async () => {
    const yesterdayStr = getYesterdayStr();
    const activateExtendedMock = vi.fn();
    useStore.mockReturnValue({
      config: { restDays: [yesterdayStr] },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tempsDispoMin: 120, tempsRequisMin: 0, tachesDuJour: [] },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
      activateExtendedRestDay: activateExtendedMock,
      declineExtendedRestDay: vi.fn(),
    });
    render(<Dashboard />);
    const acceptBtn = await screen.findByText(/Oui, je récupère/i);
    acceptBtn.click();
    expect(activateExtendedMock).toHaveBeenCalled();
  });

  it('calls declineExtendedRestDay when declining the modal', async () => {
    const yesterdayStr = getYesterdayStr();
    const declineExtendedMock = vi.fn();
    useStore.mockReturnValue({
      config: { restDays: [yesterdayStr] },
      coursConfig: { licences: [] },
      orchestratorData: { statut: "NORMAL", tempsDispoMin: 120, tempsRequisMin: 0, tachesDuJour: [] },
      intelligence: {},
      fetchOrchestrator: fetchOrchestratorMock,
      activateExtendedRestDay: vi.fn(),
      declineExtendedRestDay: declineExtendedMock,
    });
    render(<Dashboard />);
    const declineBtn = await screen.findByText(/Non, c'est parti/i);
    declineBtn.click();
    expect(declineExtendedMock).toHaveBeenCalled();
  });
});
