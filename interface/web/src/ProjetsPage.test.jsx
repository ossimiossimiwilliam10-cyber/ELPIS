import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjetsPage from './ProjetsPage';
import useStore, { useChronoStore } from './store';

// Mock du store principal
vi.mock('./store', () => {
  let state = {
    projets: [
      {
        id: 'p1',
        titre: 'Projet Test',
        dateFin: '2026-12-31',
        phases: [
          { id: 'ph1', nom: 'Phase 1', complete: false }
        ]
      }
    ],
    setProjets: vi.fn(),
    historique: [],
    pendingTasksCount: 0
  };

  const store = Object.assign(() => state, {
    getState: () => state,
    setState: (newState) => { state = { ...state, ...newState }; },
  });

  const chronoState = {
    globalChrono: {
      exoId: null,
      isRunning: false,
      elapsedSeconds: 0
    },
    startGlobalChrono: vi.fn(),
    toggleGlobalChrono: vi.fn(),
    resetGlobalChrono: vi.fn(),
  };

  return {
    default: store,
    useChronoStore: () => chronoState
  };
});

describe('ProjetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le projet existant et sa date de fin', () => {
    render(<ProjetsPage />);
    expect(screen.getByText('Projet Test')).toBeInTheDocument();
    
    // Vérifier que l'input date est présent avec la bonne valeur
    const dateInput = screen.getByTitle('Date de fin');
    expect(dateInput.value).toBe('2026-12-31');
  });

  it('permet de démarrer le chronomètre global', () => {
    const { startGlobalChrono } = useChronoStore();
    render(<ProjetsPage />);
    
    // Trouver le bouton "▶" pour démarrer le chrono
    const chronoBtn = screen.getByTitle('Démarrer chrono');
    fireEvent.click(chronoBtn);
    
    expect(startGlobalChrono).toHaveBeenCalledWith({
      id: 'p1',
      titre: 'Projet Test',
      matiereNom: 'Projet'
    });
  });

  it('permet de supprimer un projet', () => {
    const { setProjets } = useStore.getState();
    render(<ProjetsPage />);
    
    // Trouver le bouton de suppression de projet
    const deleteBtn = screen.getByTitle('Supprimer ce projet');
    
    // Simuler window.confirm
    window.confirm = vi.fn(() => true);
    
    fireEvent.click(deleteBtn);
    
    // Le store devrait être mis à jour avec un tableau vide
    expect(setProjets).toHaveBeenCalledWith([]);
  });

  it('permet de supprimer une phase', () => {
    const { setProjets, projets } = useStore.getState();
    render(<ProjetsPage />);
    
    const deletePhaseBtn = screen.getByTitle('Supprimer la phase');
    window.confirm = vi.fn(() => true);
    
    fireEvent.click(deletePhaseBtn);
    
    // setProjets doit être appelé avec le projet dont la phase est supprimée
    expect(setProjets).toHaveBeenCalled();
    const updatedProjet = setProjets.mock.calls[0][0][0];
    expect(updatedProjet.phases).toHaveLength(0);
  });
});
