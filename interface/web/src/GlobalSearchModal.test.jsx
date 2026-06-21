import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GlobalSearchModal from './GlobalSearchModal';
import useStore from './store';

vi.mock('./store', () => ({
  default: vi.fn(),
}));

const getMockConfig = () => ({
  licences: [
    {
      semestres: [
        {
          ues: [
            {
              matieres: [
                {
                  nom: "Mathématiques",
                  listeCM: [{ titre: "Algèbre" }],
                  listeTD: [{ titre: "Géométrie", notes: "Difficile" }],
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

describe('GlobalSearchModal', () => {
  let setActiveTabMock;

  beforeEach(() => {
    setActiveTabMock = vi.fn();
    useStore.mockReturnValue({
      coursConfig: getMockConfig(),
      setActiveTab: setActiveTabMock,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<GlobalSearchModal />);
    expect(screen.queryByPlaceholderText('Rechercher un cours, une note (Ctrl+K)...')).toBeNull();
  });

  it('opens on Ctrl+K', () => {
    render(<GlobalSearchModal />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText('Rechercher un cours, une note (Ctrl+K)...')).toBeDefined();
  });

  it('searches and finds results', () => {
    render(<GlobalSearchModal />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Rechercher un cours, une note (Ctrl+K)...');
    
    // Search for "Algèbre"
    fireEvent.change(input, { target: { value: 'Algèbre' } });
    expect(screen.getByText('Algèbre')).toBeDefined();
    expect(screen.getByText('Mathématiques')).toBeDefined();
    
    // Search for "Difficile" (in notes)
    fireEvent.change(input, { target: { value: 'Difficile' } });
    expect(screen.getByText('Géométrie')).toBeDefined();
  });

  it('calls setActiveTab and dispatches event on select', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    
    render(<GlobalSearchModal />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Rechercher un cours, une note (Ctrl+K)...');
    
    fireEvent.change(input, { target: { value: 'Algèbre' } });
    const resultItem = screen.getByText('Algèbre');
    
    fireEvent.click(resultItem);
    expect(setActiveTabMock).toHaveBeenCalledWith('cours');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(dispatchSpy).toHaveBeenCalled();
    const searchEventCall = dispatchSpy.mock.calls.find(call => call[0].type === 'elpisSearchSelect');
    expect(searchEventCall).toBeDefined();
    act(() => {
      vi.runAllTimers();
    });
  });
});
