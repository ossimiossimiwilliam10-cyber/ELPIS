import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

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
  const defaultMatiere = {
    nom: 'Maths',
    coefficient: 2,
    evaluations: [],
    listeCM: [{ titre: 'CM 1' }],
    listeTD: [{ titre: 'TD 1' }],
    listeTP: [{ titre: 'TP 1' }],
    listeAnnales: [{ titre: 'Annale 1' }]
  };

  const defaultActions = {
    deleteMatiere: vi.fn(),
    updateField: vi.fn(),
    addCM: vi.fn(),
    deleteCM: vi.fn(),
    addTDManuel: vi.fn(),
    deleteTD: vi.fn(),
    addTPManuel: vi.fn(),
    deleteTP: vi.fn(),
    addAnnaleManuel: vi.fn(),
    deleteAnnale: vi.fn(),
    setModalConfig: vi.fn(),
    getNextReviewDate: vi.fn(),
    setConfigLocal: vi.fn(),
    setCoursConfig: vi.fn()
  };

  test('calls addCM when button clicked', () => {
    const { getByText } = render(<MatiereCard matiere={defaultMatiere} actions={defaultActions} />);
    getByText('+ CM').click();
    expect(defaultActions.addCM).toHaveBeenCalled();
  });

  test('calls addTDManuel when button clicked', () => {
    const { getAllByText } = render(<MatiereCard matiere={defaultMatiere} actions={defaultActions} />);
    getAllByText('+ Manuel')[0].click(); // TD
    expect(defaultActions.addTDManuel).toHaveBeenCalled();
  });

  test('handles synergies logic', () => {
    const { getByText } = render(
      <MatiereCard 
        matiere={defaultMatiere} 
        allMatiereNames={['Maths', 'Physique']} 
        actions={defaultActions} 
      />
    );
    const phyBtn = getByText('Physique');
    phyBtn.click();
    expect(defaultActions.updateField).toHaveBeenCalledWith(
      ['licences', undefined, 'semestres', undefined, 'ues', undefined, 'matieres', undefined, 'synergies'],
      ['Physique']
    );
  });
});
