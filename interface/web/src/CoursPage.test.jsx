import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CoursPage from './CoursPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

// La fiche détaillée a ses propres tests ; on l'allège pour observer la page.
vi.mock('./components/cours/MatiereCard', () => ({
  default: ({ matiere }) => <div data-testid="fiche-matiere">{matiere.nom}</div>,
}));

const matiere = (nom, extra = {}) => ({
  nom, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [], evaluations: [], ...extra,
});

const cursus = () => ({
  licences: [
    {
      nom: 'Licence Physique',
      semestres: [{
        nom: 'S3',
        ues: [
          { nom: 'UE Maths', ects: 6, matieres: [
            matiere('Algèbre', { listeCM: [{ titre: 'Groupes', derniereRevision: '2026-09-01' }], listeTD: [{ titre: 'TD1' }] }),
            matiere('Analyse'),
          ] },
          { nom: 'UE Info', ects: 3, matieres: [matiere('Programmation')] },
        ],
      }],
    },
    {
      nom: 'Licence Santé',
      semestres: [{ nom: 'S1', ues: [{ nom: 'UE Bio', ects: 6, matieres: [matiere('Biochimie')] }] }],
    },
  ],
});

const chercher = (terme) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: terme } });

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true, decks: [] }) });
  storeState = { coursConfig: cursus(), setCoursConfig: vi.fn() };
});

describe('Bibliothèque — vue d\'ensemble', () => {
  it('résume le cursus en tête de page', () => {
    render(<CoursPage />);
    expect(screen.getByText(/4 matières/)).toBeInTheDocument();
    expect(screen.getByText(/1 cours/)).toBeInTheDocument();
  });

  it('guide vers la création d\'une licence quand tout est vide', () => {
    storeState.coursConfig = { licences: [] };
    render(<CoursPage />);
    expect(screen.getByText(/Ta bibliothèque est vide/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Créer ma première licence/i }));
    expect(storeState.setCoursConfig.mock.calls[0][0].licences).toHaveLength(1);
  });
});

describe('Bibliothèque — arborescence', () => {
  it('liste les licences et leurs semestres', () => {
    render(<CoursPage />);
    const arbre = screen.getByRole('navigation', { name: /cursus/i });
    expect(within(arbre).getByText('Licence Physique')).toBeInTheDocument();
    expect(within(arbre).getByText('Licence Santé')).toBeInTheDocument();
    expect(within(arbre).getByText('S3')).toBeInTheDocument();
  });

  it('déplie les UE du semestre sélectionné', () => {
    render(<CoursPage />);
    const arbre = screen.getByRole('navigation', { name: /cursus/i });
    expect(within(arbre).getByText('UE Maths')).toBeInTheDocument();
    expect(within(arbre).getByText('UE Info')).toBeInTheDocument();
  });

  it('affiche les matières de l\'UE choisie', () => {
    render(<CoursPage />);
    expect(screen.getByRole('button', { name: /Ouvrir Algèbre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ouvrir Analyse/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ouvrir Programmation/i })).not.toBeInTheDocument();
  });

  it('change d\'UE au clic', () => {
    render(<CoursPage />);
    const arbre = screen.getByRole('navigation', { name: /cursus/i });
    fireEvent.click(within(arbre).getByText('UE Info'));
    expect(screen.getByRole('button', { name: /Ouvrir Programmation/i })).toBeInTheDocument();
  });

  it('change de licence au clic', () => {
    render(<CoursPage />);
    const arbre = screen.getByRole('navigation', { name: /cursus/i });
    fireEvent.click(within(arbre).getByText('Licence Santé'));
    expect(screen.getByRole('button', { name: /Ouvrir Biochimie/i })).toBeInTheDocument();
  });

  it('signale l\'UE courante aux lecteurs d\'écran', () => {
    render(<CoursPage />);
    const arbre = screen.getByRole('navigation', { name: /cursus/i });
    expect(within(arbre).getByText('UE Maths').closest('button')).toHaveAttribute('aria-current', 'true');
  });
});

describe('Bibliothèque — vignettes de matière', () => {
  it('affiche les effectifs par type', () => {
    render(<CoursPage />);
    const carte = screen.getByRole('button', { name: /Ouvrir Algèbre/i });
    expect(within(carte).getByText(/CM/)).toBeInTheDocument();
    expect(within(carte).getByText(/TD/)).toBeInTheDocument();
  });

  it('montre l\'avancement de la matière', () => {
    // 1 CM révisé sur 2 éléments au total.
    render(<CoursPage />);
    const carte = screen.getByRole('button', { name: /Ouvrir Algèbre/i });
    expect(within(carte).getByText('50%')).toBeInTheDocument();
  });

  it('signale une matière sans contenu', () => {
    render(<CoursPage />);
    const carte = screen.getByRole('button', { name: /Ouvrir Analyse/i });
    expect(within(carte).getByText(/Aucun contenu/i)).toBeInTheDocument();
  });

  it('ouvre la fiche détaillée au clic', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir Algèbre/i }));
    expect(screen.getByTestId('fiche-matiere')).toHaveTextContent('Algèbre');
  });

  it('revient à la grille depuis la fiche', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir Algèbre/i }));
    fireEvent.click(screen.getByRole('button', { name: /Retour à/i }));
    expect(screen.queryByTestId('fiche-matiere')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ouvrir Algèbre/i })).toBeInTheDocument();
  });
});

describe('Bibliothèque — recherche', () => {
  it('traverse toutes les licences', () => {
    // La recherche ne balayait auparavant que la licence affichée.
    render(<CoursPage />);
    chercher('Biochimie');
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument();
  });

  it('ignore les accents', () => {
    render(<CoursPage />);
    chercher('algebre');
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument();
  });

  it('trouve un cours par son titre', () => {
    render(<CoursPage />);
    chercher('Groupes');
    expect(screen.getByText('Groupes')).toBeInTheDocument();
  });

  it('mène directement à la matière trouvée', () => {
    render(<CoursPage />);
    chercher('Biochimie');
    fireEvent.click(screen.getByText('Biochimie').closest('button'));
    expect(screen.getByTestId('fiche-matiere')).toHaveTextContent('Biochimie');
  });

  it('propose d\'effacer une recherche infructueuse', () => {
    render(<CoursPage />);
    chercher('zzz-introuvable');
    expect(screen.getByText(/Aucune correspondance/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Effacer la recherche/i }));
    expect(screen.getByRole('button', { name: /Ouvrir Algèbre/i })).toBeInTheDocument();
  });
});

describe('Bibliothèque — états intermédiaires', () => {
  it('invite à créer un semestre quand la licence est vide', () => {
    storeState.coursConfig = { licences: [{ nom: 'L1', semestres: [] }] };
    render(<CoursPage />);
    expect(screen.getByText(/Aucun semestre/i)).toBeInTheDocument();
  });

  it('invite à créer une UE quand le semestre est vide', () => {
    storeState.coursConfig = { licences: [{ nom: 'L1', semestres: [{ nom: 'S1', ues: [] }] }] };
    render(<CoursPage />);
    expect(screen.getByText(/Aucune UE/i)).toBeInTheDocument();
  });

  it('invite à créer une matière quand l\'UE est vide', () => {
    storeState.coursConfig = { licences: [{ nom: 'L1', semestres: [{ nom: 'S1', ues: [{ nom: 'UE1', matieres: [] }] }] }] };
    render(<CoursPage />);
    expect(screen.getByText(/Aucune matière dans cette UE/i)).toBeInTheDocument();
  });

  it('reste affichable après suppression de la licence courante', () => {
    // Régression : l'index actif pointait dans le vide et la page se vidait.
    render(<CoursPage />);
    storeState.coursConfig = { licences: [] };
    expect(() => render(<CoursPage />)).not.toThrow();
  });
});

describe('Bibliothèque — modifications', () => {
  it('ajoute une matière à l\'UE courante', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Matière' }));

    const enregistre = storeState.setCoursConfig.mock.calls[0][0];
    expect(enregistre.licences[0].semestres[0].ues[0].matieres).toHaveLength(3);
  });

  it('n\'enregistre qu\'une fois par ajout', () => {
    // Régression : la sauvegarde partait d'un updater d'état, rejoué par React.
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Matière' }));
    expect(storeState.setCoursConfig).toHaveBeenCalledTimes(1);
  });

  it('nomme l\'UE visée avant de la supprimer', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'UE/i }));

    const dialogue = screen.getByRole('alertdialog');
    expect(within(dialogue).getByText(/UE Maths/)).toBeInTheDocument();
    expect(within(dialogue).getByText(/2 matières/)).toBeInTheDocument();
  });

  it('supprime l\'UE confirmée', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'UE/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    const restantes = storeState.setCoursConfig.mock.calls[0][0].licences[0].semestres[0].ues;
    expect(restantes.map(u => u.nom)).toEqual(['UE Info']);
  });

  it('ne supprime rien si l\'utilisateur renonce', () => {
    render(<CoursPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'UE/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(storeState.setCoursConfig).not.toHaveBeenCalled();
  });
});
