import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulletinPage from './BulletinPage';
import useStore from './store';

vi.mock('./store', () => ({
  default: vi.fn(),
}));

// Mock EditableLabel component as it has its own logic that might be complex to test here
vi.mock('./components/cours/EditableLabel', () => ({
  default: ({ value, onRename }) => (
    <div data-testid="editable-label" onClick={() => onRename(value + ' updated')}>
      {value}
    </div>
  )
}));

const getMockConfig = () => ({
  licences: [
    {
      nom: "L1 Droit",
      semestres: [
        {
          nom: "Semestre 1",
          ues: [
            {
              nom: "UE1 Droit Privé",
              ects: 10,
              matieres: [
                {
                  nom: "Droit Civil",
                  coefficient: 2,
                  evaluations: [
                    { nom: "Partiel", note: 14, coefficient: 1 }
                  ]
                },
                {
                  nom: "Droit Constitutionnel",
                  coefficient: 1,
                  evaluations: [
                    { nom: "Examen", note: 8, coefficient: 1 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
});

describe('BulletinPage', () => {
  let setCoursConfigMock;

  beforeEach(() => {
    setCoursConfigMock = vi.fn();
    useStore.mockReturnValue({
      coursConfig: getMockConfig(),
      setCoursConfig: setCoursConfigMock,
      intelligence: {}
    });
  });

  it('renders "Aucun cours configuré" when config is empty', () => {
    useStore.mockReturnValue({ coursConfig: null });
    render(<BulletinPage />);
    expect(screen.getByText('Aucun cours configuré.')).toBeDefined();
  });

  it('renders the licence name and semester averages', () => {
    render(<BulletinPage />);
    expect(screen.getByText('L1 Droit')).toBeDefined();
    
    // Average calculation: 
    // Droit Civil: 14 * 2 = 28
    // Droit Const: 8 * 1 = 8
    // Total = 36 / 3 = 12.00
    expect(screen.getByText('12.00')).toBeDefined();
  });

  it('renders compensable badge if UE average is < 10 but semester average is >= 10', () => {
    const config = getMockConfig();
    // UE1 < 10
    config.licences[0].semestres[0].ues[0].matieres[0].evaluations[0].note = 5; // Droit civil (coef 2) gets 5 => 10
    config.licences[0].semestres[0].ues[0].matieres[1].evaluations[0].note = 5; // Droit const (coef 1) gets 5 => 5
    // UE1 Avg = 15/3 = 5.0
    
    // Add UE2 to make semester avg >= 10
    config.licences[0].semestres[0].ues.push({
      nom: "UE2 Bonus",
      ects: 10,
      matieres: [{
        nom: "Sport",
        coefficient: 1,
        evaluations: [{ nom: "Note", note: 18, coefficient: 1 }]
      }]
    });
    // SemAvg = (5*10 + 18*10) / 20 = 230 / 20 = 11.5 >= 10
    
    useStore.mockReturnValue({
      coursConfig: config,
      setCoursConfig: setCoursConfigMock,
      intelligence: {}
    });
    render(<BulletinPage />);
    expect(screen.getByText('✅ Compensable')).toBeDefined();
  });

  it('renders non-compensable badge if average is < 10', () => {
    const config = getMockConfig();
    config.licences[0].semestres[0].ues[0].matieres[0].evaluations[0].note = 5; // Droit civil gets a 5
    // 5*2 + 8*1 = 18 / 3 = 6.00
    useStore.mockReturnValue({
      coursConfig: config,
      setCoursConfig: setCoursConfigMock,
      intelligence: {}
    });
    render(<BulletinPage />);
    expect(screen.getByText('⚠️ Non compensable')).toBeDefined();
  });

  it('toggles simulation mode', () => {
    render(<BulletinPage />);
    const simuBtn = screen.getByText('🧪 Mode Simulation (What-If)');
    fireEvent.click(simuBtn);
    expect(screen.getByText('🔮 Quitter le Mode Simulation')).toBeDefined();
    expect(screen.getByText('Mode Simulation (What-If) Actif')).toBeDefined();
  });

  it('adds a new evaluation when clicking + Épreuve', () => {
    render(<BulletinPage />);
    const addBtns = screen.getAllByText('+ Épreuve');
    fireEvent.click(addBtns[0]); // Adds for Droit Civil

    // Should call setCoursConfig with new eval
    expect(setCoursConfigMock).toHaveBeenCalled();
    const updatedConfig = setCoursConfigMock.mock.calls[0][0];
    const firstMatiere = updatedConfig.licences[0].semestres[0].ues[0].matieres[0];
    expect(firstMatiere.evaluations.length).toBe(2);
    expect(firstMatiere.evaluations[1].nom).toBe("Nouvelle Éval");
  });

  it('updates a note when changing input', () => {
    render(<BulletinPage />);
    // Find the input for "Partiel" (note = 14)
    const inputs = screen.getAllByPlaceholderText('-- / 20');
    fireEvent.blur(inputs[0], { target: { value: '16.5' } });

    expect(setCoursConfigMock).toHaveBeenCalled();
    const updatedConfig = setCoursConfigMock.mock.calls[0][0];
    const firstMatiere = updatedConfig.licences[0].semestres[0].ues[0].matieres[0];
    expect(firstMatiere.evaluations[0].note).toBe(16.5);
  });
  
  it('toggles UE visibility', () => {
    render(<BulletinPage />);
    expect(screen.getByText('Droit Civil')).toBeDefined();
    
    // Find the UE header to click
    const ueHeader = screen.getByText('UE1 Droit Privé');
    fireEvent.click(ueHeader);
    
    // Now Droit Civil should not be in the document
    expect(screen.queryByText('Droit Civil')).toBeNull();
  });
});
