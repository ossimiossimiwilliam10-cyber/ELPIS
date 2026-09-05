import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalSearchModal from './GlobalSearchModal';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const CURSUS = {
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [{
        nom: 'UE Maths',
        matieres: [{
          nom: 'Algèbre',
          listeCM: [{ titre: 'Théorie des groupes' }],
          listeTD: [{ titre: 'TD1' }],
          listeTP: [],
          listeAnnales: [],
        }],
      }],
    }],
  }],
};

const ouvrirRecherche = () => {
  render(<GlobalSearchModal />);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { coursConfig: CURSUS, setActiveTab: vi.fn() };
});

describe('GlobalSearchModal', () => {
  it('reste fermée au repos', () => {
    render(<GlobalSearchModal />);
    expect(screen.queryByPlaceholderText(/Rechercher/i)).not.toBeInTheDocument();
  });

  it('s\'ouvre au raccourci Ctrl+K', () => {
    ouvrirRecherche();
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('se referme sur Échap', () => {
    ouvrirRecherche();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/Rechercher/i)).not.toBeInTheDocument();
  });

  it('trouve un exercice par son titre', () => {
    ouvrirRecherche();
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'TD1' } });
    expect(screen.getByText('TD1')).toBeInTheDocument();
  });

  it('reste silencieuse sans correspondance', () => {
    ouvrirRecherche();
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'zzz-introuvable' } });
    expect(screen.queryByText('TD1')).not.toBeInTheDocument();
  });

  it('trouve un cours par son titre', () => {
    ouvrirRecherche();
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'groupes' } });
    expect(screen.getByText(/Théorie des groupes/)).toBeInTheDocument();
  });

  it('ne plante pas sans cursus', () => {
    storeState.coursConfig = { licences: [] };
    expect(() => ouvrirRecherche()).not.toThrow();
  });
});
