import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import MatiereCard from './components/cours/MatiereCard';

// Mock recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: () => <div>LineChart</div>,
  Line: () => <div>Line</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  Tooltip: () => <div>Tooltip</div>
}));

describe('MatiereCard UI Component', () => {
  const uiScenarios = [];
  for (let i = 0; i < 50; i++) {
    uiScenarios.push([`Matiere ${i}`, i % 2 === 0 ? 10 : 15, i * 2]);
  }

  test.each(uiScenarios)('renders correctly for %s with score %d and %d CMs', (nom, note, nbCM) => {
    const matiere = {
      nom,
      coefficient: 2,
      evaluations: [{ note, coefficient: 1 }],
      listeCM: Array(nbCM).fill({ titre: 'CM' }),
      listeTD: [],
      listeTP: [],
      listeAnnales: []
    };

    const actions = {
      deleteMatiere: vi.fn(),
      updateField: vi.fn(),
      addCM: vi.fn(),
      deleteCM: vi.fn(),
      addTDManuel: vi.fn(),
      deleteTD: vi.fn(),
      addTPManuel: vi.fn(),
      deleteTP: vi.fn(),
      setModalConfig: vi.fn(),
      getNextReviewDate: vi.fn(),
      setConfigLocal: vi.fn(),
      setCoursConfig: vi.fn()
    };

    render(
      <MatiereCard 
        matiere={matiere} 
        allMatiereNames={[]}
        lIndex={0} sIndex={0} uIndex={0} mIndex={0}
        actions={actions}
      />
    );

    // It should render the name
    expect(screen.getByText(nom)).toBeDefined();
    // Verify it rendered the correct number of CMs (it displays "X CM")
    expect(screen.getByText(new RegExp(`${nbCM}\\s*CM`))).toBeDefined();
  });
});
