import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClassementPage from './ClassementPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const BASELINE = {
  globalMean: 50, globalSD: 15,
  subjects: { 'Algèbre': { mean: 10, sd: 3 } },
};

const cursusAvec = (evaluations) => ({
  licences: [{
    nom: 'L2',
    semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', ects: 6, matieres: [{ nom: 'Algèbre', coefficient: 1, evaluations }] }] }],
  }],
});

/** Contenu de la carte portant un libellé de composante. */
const composante = (titre) => screen.getByText(titre).closest('.el-carte').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    config: {},
    coursConfig: cursusAvec([{ nom: 'DS', note: 12, coefficient: 1 }]),
    historique: [],
    rankingBaseline: BASELINE,
    intelligence: null,
  };
});

describe('ClassementPage — score global', () => {
  it('affiche le score et la position', () => {
    render(<ClassementPage />);
    expect(screen.getByText('Score global')).toBeInTheDocument();
    expect(document.querySelector('.rang-global__position').textContent).toMatch(/de tête/);
  });

  it('ne présente pas une position par défaut comme un résultat mesuré', () => {
    // Régression : sans moyennes de référence, la page affichait « Top 50 % ».
    storeState.rankingBaseline = null;
    render(<ClassementPage />);
    expect(screen.getByText(/ne peut être comparé à personne/i)).toBeInTheDocument();
    expect(document.querySelector('.rang-global__position').textContent).not.toMatch(/de tête/);
  });

  it('explique l\'absence de données au lieu d\'afficher un zéro', () => {
    storeState.coursConfig = { licences: [] };
    storeState.historique = [];
    render(<ClassementPage />);
    expect(screen.getByText(/Pas encore assez de données/i)).toBeInTheDocument();
  });
});

describe('ClassementPage — composantes', () => {
  it('détaille la moyenne qui alimente le score de notes', () => {
    storeState.coursConfig = cursusAvec([
      { nom: 'DS', note: 10, coefficient: 1 },
      { nom: 'Examen', note: 16, coefficient: 3 },
    ]);
    render(<ClassementPage />);
    expect(composante('Notes')).toMatch(/73\s*\/ 100/);
    expect(composante('Notes')).toMatch(/14\.50 \/ 20/);
  });

  it('distingue une composante non mesurable d\'un score nul', () => {
    storeState.historique = [];
    render(<ClassementPage />);
    expect(composante('Rétention')).toMatch(/pas encore mesurable/i);
    expect(composante('Rétention')).toMatch(/Aucune révision enregistrée/i);
  });

  it('signale que la rétention vient d\'Anki quand elle est mesurée', () => {
    storeState.intelligence = { fsrs_real_retention: 88 };
    render(<ClassementPage />);
    expect(composante('Rétention')).toMatch(/88\s*\/ 100/);
    expect(composante('Rétention')).toMatch(/mesurée par Anki/i);
  });

  it('rapporte la régularité à la fenêtre réellement écoulée', () => {
    storeState.config = { userStartDate: new Date(Date.now() - 3 * 86400000).toISOString() };
    storeState.historique = [{ type: 'CM', action: 'Révisé (J7)', timestamp: new Date().toISOString() }];
    render(<ClassementPage />);
    expect(composante('Régularité')).toMatch(/[34] derniers jours/);
  });
});

describe('ClassementPage — détail par matière', () => {
  it('compare chaque matière à sa promotion', () => {
    render(<ClassementPage />);
    expect(screen.getByText('Algèbre')).toBeInTheDocument();
    expect(screen.getByText(/12\.00 \/ 20 · promotion à 10\.0/)).toBeInTheDocument();
  });

  it('signale une note projetée plutôt que réelle', () => {
    storeState.coursConfig = cursusAvec([]);
    storeState.intelligence = { projectedScoreMap: { 'algèbre': 13 } };
    render(<ClassementPage />);
    expect(screen.getByText('note projetée')).toBeInTheDocument();
  });

  it('annonce l\'absence de comparaison possible', () => {
    storeState.rankingBaseline = { globalMean: 50, globalSD: 15, subjects: {} };
    render(<ClassementPage />);
    expect(screen.getByText(/Aucune comparaison disponible/i)).toBeInTheDocument();
  });
});

describe('ClassementPage — robustesse', () => {
  it('s\'affiche sans historique ni cursus', () => {
    storeState.coursConfig = { licences: [] };
    storeState.historique = undefined;
    expect(() => render(<ClassementPage />)).not.toThrow();
  });

  it('n\'affiche jamais NaN', () => {
    storeState.coursConfig = { licences: [] };
    storeState.historique = [];
    const { container } = render(<ClassementPage />);
    expect(container.textContent).not.toMatch(/NaN/);
  });
});
