import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GraphPage from './GraphPage';

let storeState;
let dernierGraphe;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

// Le moteur 3D exige WebGL, absent sous jsdom : on capture ce qu'il reçoit.
vi.mock('react-force-graph-3d', async () => {
  const { createElement } = await import('react');
  return {
    default: (props) => {
      dernierGraphe = props.graphData;
      return createElement('div', { 'data-testid': 'graphe-3d' });
    },
  };
});

const matiere = (nom, extra = {}) => ({ nom, evaluations: [], coefficient: 1, ...extra });

const cursusAvec = (matieres, deuxiemeUE = null) => ({
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [
        { nom: 'UE Maths', matieres },
        ...(deuxiemeUE ? [{ nom: 'UE Info', matieres: deuxiemeUE }] : []),
      ],
    }],
  }],
});

const lienEntre = (a, b) =>
  (dernierGraphe?.links || []).find(l =>
    (l.source === a && l.target === b) || (l.source === b && l.target === a)
  );

beforeEach(() => {
  vi.clearAllMocks();
  dernierGraphe = null;
  storeState = { coursConfig: cursusAvec([matiere('Algèbre'), matiere('Analyse')]), setActiveTab: vi.fn() };
});

describe('GraphPage — construction du graphe', () => {
  it('crée un nœud par matière', () => {
    render(<GraphPage />);
    expect(dernierGraphe.nodes.map(n => n.name).sort()).toEqual(['Algèbre', 'Analyse']);
  });

  it('relie les matières d\'une même UE', () => {
    render(<GraphPage />);
    expect(lienEntre('Algèbre', 'Analyse')).toBeDefined();
  });

  it('ne relie pas deux UE distinctes sans raison', () => {
    storeState.coursConfig = cursusAvec([matiere('Algèbre')], [matiere('Programmation')]);
    render(<GraphPage />);
    expect(lienEntre('Algèbre', 'Programmation')).toBeUndefined();
  });

  it('trace les synergies déclarées', () => {
    // Régression : la page annonçait « leurs synergies » mais ne traçait que
    // les liens d'UE — les ponts configurés dans la Bibliothèque étaient ignorés.
    storeState.coursConfig = cursusAvec(
      [matiere('Algèbre', { synergies: ['Programmation'] })],
      [matiere('Programmation')]
    );
    render(<GraphPage />);

    const lien = lienEntre('Algèbre', 'Programmation');
    expect(lien).toBeDefined();
    expect(lien.type).toBe('synergie');
  });

  it('fait primer une synergie sur un simple voisinage d\'UE', () => {
    storeState.coursConfig = cursusAvec([
      matiere('Algèbre', { synergies: ['Analyse'] }),
      matiere('Analyse'),
    ]);
    render(<GraphPage />);
    expect(lienEntre('Algèbre', 'Analyse').type).toBe('synergie');
  });

  it('ignore une synergie vers une matière inexistante', () => {
    // Un lien vers un nœud absent ferait planter le moteur de rendu.
    storeState.coursConfig = cursusAvec([matiere('Algèbre', { synergies: ['Matière fantôme'] })]);
    render(<GraphPage />);

    const noms = dernierGraphe.nodes.map(n => n.id);
    dernierGraphe.links.forEach(l => {
      expect(noms).toContain(l.source);
      expect(noms).toContain(l.target);
    });
  });

  it('ne crée qu\'un lien par paire', () => {
    render(<GraphPage />);
    expect(dernierGraphe.links).toHaveLength(1);
  });
});

describe('GraphPage — maîtrise', () => {
  it('reflète la moyenne des évaluations', () => {
    storeState.coursConfig = cursusAvec([
      matiere('Algèbre', { evaluations: [{ note: 15, coefficient: 1 }] }),
    ]);
    render(<GraphPage />);
    expect(dernierGraphe.nodes[0].mastery).toBe(75);
  });

  it('distingue l\'absence de note d\'une maîtrise moyenne', () => {
    // Régression : une évaluation sans note comptait pour 10/20, si bien qu'une
    // matière jamais évaluée s'affichait « maîtrise 50 % », en jaune.
    render(<GraphPage />);
    expect(dernierGraphe.nodes[0].mastery).toBeNull();
    expect(dernierGraphe.nodes[0].color).toContain('hsl(220');
  });

  it('pondère par les coefficients d\'évaluation', () => {
    storeState.coursConfig = cursusAvec([
      matiere('Algèbre', { evaluations: [{ note: 10, coefficient: 1 }, { note: 16, coefficient: 3 }] }),
    ]);
    render(<GraphPage />);
    expect(dernierGraphe.nodes[0].mastery).toBeCloseTo(72.5);
  });

  it('dimensionne le nœud selon le coefficient de la matière', () => {
    storeState.coursConfig = cursusAvec([matiere('Algèbre', { coefficient: 4 })]);
    render(<GraphPage />);
    expect(dernierGraphe.nodes[0].val).toBe(8);
  });
});

describe('GraphPage — cursus vide', () => {
  it('explique ce que le graphe montrera', () => {
    storeState.coursConfig = { licences: [] };
    render(<GraphPage />);
    expect(screen.getByText(/graphe est encore vide/i)).toBeInTheDocument();
    expect(screen.queryByTestId('graphe-3d')).not.toBeInTheDocument();
  });

  it('ne plante pas sans configuration', () => {
    storeState.coursConfig = null;
    expect(() => render(<GraphPage />)).not.toThrow();
  });
});
