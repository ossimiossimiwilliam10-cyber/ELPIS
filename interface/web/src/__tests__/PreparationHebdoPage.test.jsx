import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PreparationHebdoPage from '../PreparationHebdoPage';
import useStore from '../store';

// Mock du store
vi.mock('../store', () => {
  let state = {
    config: { fixedCommitments: [] },
    coursConfig: {
      licences: [
        {
          nom: 'L1',
          semestres: [
            {
              nom: 'S1',
              ues: [
                {
                  nom: 'UE1',
                  matieres: [
                    {
                      nom: 'Maths',
                      listeTD: [],
                      listeTP: [],
                      listeAnnales: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    setConfig: vi.fn(),
    setCoursConfig: vi.fn()
  };

  return {
    default: Object.assign(() => state, {
      getState: () => state,
      setState: (newState) => { state = { ...state, ...newState }; },
    })
  };
});

describe('PreparationHebdoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and shows missing exercises', () => {
    render(<PreparationHebdoPage />);
    
    // Le titre de la page
    expect(screen.getByText(/Préparation Hebdomadaire/i)).toBeInTheDocument();
    
    // Il manque 7 TD de Maths
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText(/\(7 manquants\)/)).toBeInTheDocument();
  });

  it('can add a new fixed commitment', () => {
    render(<PreparationHebdoPage />);
    
    const addButton = screen.getByText('+ Ajouter un Engagement');
    expect(addButton).toBeInTheDocument();
    
    // Click on add
    fireEvent.click(addButton);
    
    // The setConfig mock should be called with the new commitment
    const setConfigMock = useStore().setConfig;
    expect(setConfigMock).toHaveBeenCalled();
  });
});
