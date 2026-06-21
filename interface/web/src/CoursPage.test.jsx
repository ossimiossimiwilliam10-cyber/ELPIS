import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CoursPage from './CoursPage';
import useStore from './store';

vi.mock('./store', () => ({
  default: vi.fn(),
}));

// Mock EditableLabel and MatiereCard to simplify rendering
vi.mock('./components/cours/EditableLabel', () => ({
  default: ({ value, onRename, placeholder }) => (
    <input
      data-testid="editable-label"
      value={value}
      onChange={(e) => onRename(e.target.value)}
      placeholder={placeholder}
    />
  )
}));

vi.mock('./components/cours/MatiereCard', () => ({
  default: ({ matiere, actions }) => (
    <div data-testid="matiere-card">
      {matiere.nom}
      <button onClick={() => actions.deleteMatiere(0, 0, 0, 0)}>Delete Matiere</button>
    </div>
  )
}));

const getMockConfig = () => ({
  licences: [
    {
      nom: "Licence 1",
      semestres: [
        {
          nom: "Semestre 1",
          ues: [
            {
              nom: "UE 1",
              ects: 10,
              matieres: [
                {
                  nom: "Mathématiques",
                  listeCM: [],
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
});

describe('CoursPage', () => {
  let setCoursConfigMock;

  beforeEach(() => {
    setCoursConfigMock = vi.fn();
    useStore.mockReturnValue({
      coursConfig: getMockConfig(),
      setCoursConfig: setCoursConfigMock,
    });
    // Mock confirm
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('renders the CoursPage and initial config', () => {
    render(<CoursPage />);
    expect(screen.getByText('Bibliothèque de Cours')).toBeDefined();
    
    // Using getAllByTestId because we mock EditableLabel
    const editableLabels = screen.getAllByTestId('editable-label');
    expect(editableLabels.map(el => el.value)).toContain('Licence 1');
    expect(editableLabels.map(el => el.value)).toContain('Semestre 1');
    expect(editableLabels.map(el => el.value)).toContain('UE 1');
    
    expect(screen.getByText('Mathématiques')).toBeDefined();
  });

  it('adds a new Licence', () => {
    render(<CoursPage />);
    // Find the add licence button (in the tabs)
    const addBtns = screen.getAllByText('+ Licence');
    fireEvent.click(addBtns[0]);
    
    expect(setCoursConfigMock).toHaveBeenCalled();
    const newConfig = setCoursConfigMock.mock.calls[0][0];
    expect(newConfig.licences.length).toBe(2);
    expect(newConfig.licences[1].nom).toBe('Licence 2');
  });

  it('deletes a Licence', () => {
    render(<CoursPage />);
    const deleteBtn = screen.getByTitle('Supprimer la licence');
    fireEvent.click(deleteBtn);
    
    expect(window.confirm).toHaveBeenCalled();
    expect(setCoursConfigMock).toHaveBeenCalled();
    const newConfig = setCoursConfigMock.mock.calls[0][0];
    expect(newConfig.licences.length).toBe(0);
  });

  it('adds a new Semestre', () => {
    render(<CoursPage />);
    const addSemestreBtn = screen.getByText('+ Semestre');
    fireEvent.click(addSemestreBtn);
    
    expect(setCoursConfigMock).toHaveBeenCalled();
    const newConfig = setCoursConfigMock.mock.calls[0][0];
    expect(newConfig.licences[0].semestres.length).toBe(2);
  });

  it('adds a new UE', () => {
    render(<CoursPage />);
    const addUeBtn = screen.getAllByText('+ UE');
    fireEvent.click(addUeBtn[0]); // There are multiple, first one works
    
    expect(setCoursConfigMock).toHaveBeenCalled();
    const newConfig = setCoursConfigMock.mock.calls[0][0];
    expect(newConfig.licences[0].semestres[0].ues.length).toBe(2);
  });

  it('filters based on search', () => {
    render(<CoursPage />);
    const searchInput = screen.getByPlaceholderText('🔍 Rechercher...');
    
    // Type something that matches nothing
    fireEvent.change(searchInput, { target: { value: 'Inexistant' } });
    
    // The UE 1 shouldn't be rendered anymore because nothing matches
    expect(screen.queryByText('UE 1')).toBeNull();
    
    // Type something that matches "Mathématiques"
    fireEvent.change(searchInput, { target: { value: 'math' } });
    
    // The UE 1 and Mathématiques should be rendered
    const editableLabels = screen.getAllByTestId('editable-label');
    expect(editableLabels.map(el => el.value)).toContain('UE 1');
    expect(screen.getByText('Mathématiques')).toBeDefined();
  });
  
  it('modifies an ECTS value', () => {
    render(<CoursPage />);
    const ectsInput = screen.getByTitle('Crédits ECTS (0-60)');
    fireEvent.change(ectsInput, { target: { value: '15' } });
    
    expect(setCoursConfigMock).toHaveBeenCalled();
    const newConfig = setCoursConfigMock.mock.calls[0][0];
    expect(newConfig.licences[0].semestres[0].ues[0].ects).toBe(15);
  });
});
