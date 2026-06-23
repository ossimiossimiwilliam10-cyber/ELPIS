import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

// Mock de canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

// Mock ToastProvider
vi.mock('./ToastProvider', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

describe('RevisionsAvanceesPage', () => {
  const mockConfig = {
    licences: [
      {
        semestres: [
          {
            ues: [
              {
                matieres: [
                  {
                    nom: 'Mathématiques',
                    listeCM: [
                      { titre: 'Chapitre 1 - Algèbre', type: 'CM', derniereRevision: null },
                      { titre: 'Chapitre 2 - Géométrie', type: 'CM', derniereRevision: '2025-01-01' }
                    ]
                  },
                  {
                    nom: 'Physique',
                    listeTD: [
                      { titre: 'TD 1 - Mécanique', type: 'TD', dernierePratique: '2025-01-01' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  beforeEach(() => {
    useStore.mockReturnValue({
      coursConfig: mockConfig,
      config: {},
      intelligence: {},
      pendingTasksCount: 0,
      setCoursConfig: vi.fn(),
      addHistoriqueEntry: vi.fn()
    });
    useChronoStore.mockReturnValue({
      globalChrono: { isRunning: false, elapsedSeconds: 0, exoId: null },
      startGlobalChrono: vi.fn(),
      toggleGlobalChrono: vi.fn(),
      resetGlobalChrono: vi.fn()
    });
  });

  it('affiche le titre de la page', () => {
    render(<RevisionsAvanceesPage />);
    expect(screen.getByText('🚀 Avance & Bonus')).toBeDefined();
  });

  it('affiche les matières dans le menu déroulant', () => {
    render(<RevisionsAvanceesPage />);
    const options = screen.getAllByRole('option');
    // Mathématiques, Physique
    expect(options.length).toBe(2);
    expect(options[0].textContent).toBe('Mathématiques');
    expect(options[1].textContent).toBe('Physique');
  });

  it('affiche une seule tâche (la plus prioritaire) pour la matière sélectionnée', () => {
    render(<RevisionsAvanceesPage />);
    
    // Par défaut "Mathématiques" est sélectionné
    // "Chapitre 1 - Algèbre" a derniereRevision: null, c'est le plus prioritaire
    expect(screen.getByText('Chapitre 1 - Algèbre')).toBeDefined();
    
    // Vérifier que Chapitre 2 n'est pas affiché en même temps
    const chap2 = screen.queryByText('Chapitre 2 - Géométrie');
    expect(chap2).toBeNull();
  });

  it('change de matière affiche un exercice différent', async () => {
    render(<RevisionsAvanceesPage />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Physique' } });
    
    expect(await screen.findByText('TD 1 - Mécanique')).toBeDefined();
    // Mathématiques ne devrait plus être affiché
    expect(screen.queryByText('Chapitre 1 - Algèbre')).toBeNull();
  });

  it('affiche un écran verrouillé si pendingTasksCount > 0', () => {
    useStore.mockReturnValueOnce({
      coursConfig: mockConfig,
      config: {},
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
