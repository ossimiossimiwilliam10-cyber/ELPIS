import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import RevisionsAvanceesPage from './RevisionsAvanceesPage';
import useStore, { useChronoStore } from './store';

// Mock du store
vi.mock('./store', () => {
  return {
    __esModule: true,
    default: vi.fn(),
    useChronoStore: vi.fn()
  };
});

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } })
}));

// Mock de canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

const mockConfig = {
  licences: [
    {
      id: 'L1',
      active: true,
      semestres: [
        {
          id: 'S1',
          active: true,
          matieres: [
            { id: 'math', nom: 'Mathématiques' },
            { id: 'phys', nom: 'Physique' }
          ]
        }
      ]
    }
  ]
};

const mockSyllabus = {
  L1: {
    S1: {
      math: {
        CM: [{ id: 'cm1', titre: 'Chapitre 1 - Algèbre', derniereRevision: null }, { id: 'cm2', titre: 'Chapitre 2 - Géométrie', derniereRevision: '2023-01-01' }],
        TD: [],
        TP: []
      },
      phys: {
        CM: [],
        TD: [{ id: 'td1', titre: 'Exercices Mouvement', derniereRevision: null }],
        TP: [{ id: 'tp1', titre: 'Mécanique - TP1', derniereRevision: null }]
      }
    }
  }
};

describe.skip('RevisionsAvanceesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    useStore.mockReturnValue({
      coursConfig: mockConfig,
      config: { syllabus: mockSyllabus },
      intelligence: { burnoutRisk: { riskLevel: 'none' } },
      pendingTasksCount: 0,
      setCoursConfig: vi.fn(),
      addHistoriqueEntry: vi.fn()
    });
    
    useChronoStore.mockReturnValue({
      globalChrono: { isRunning: false },
      setActiveChronoTask: vi.fn()
    });
  });

  it('affiche les matières dans le menu déroulant', () => {
    render(<RevisionsAvanceesPage />);
    const selects = screen.getAllByRole('combobox');
    const options = selects[0].querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[1].textContent).toBe('Mathématiques');
    expect(options[2].textContent).toBe('Physique');
  });

  it('change de matière sans crasher', () => {
    render(<RevisionsAvanceesPage />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Physique' } });
    expect(selects[0].value).toBe('Physique');
  });

  it('change de type sans crasher', () => {
    render(<RevisionsAvanceesPage />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Physique' } });
    fireEvent.change(selects[1], { target: { value: 'TD' } });
    expect(selects[1].value).toBe('TD');
  });

  it('affiche un écran verrouillé si pendingTasksCount > 0', () => {
    useStore.mockReturnValueOnce({
      coursConfig: mockConfig,
      config: { syllabus: mockSyllabus },
      intelligence: {},
      pendingTasksCount: 2,
      setCoursConfig: vi.fn(),
      addHistoriqueEntry: vi.fn()
    });

    render(<RevisionsAvanceesPage />);
    expect(screen.getByText('Section Verrouillée')).toBeDefined();
    expect(screen.queryByText('Choix de la matière')).toBeNull();
  });
});
