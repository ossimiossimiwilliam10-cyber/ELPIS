import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciceCard from './ExerciceCard';

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../ToastProvider', () => ({ useToast: () => ({ toast }) }));

let chronoState;
vi.mock('../../store', () => {
  const useStore = (selector) => (selector ? selector({}) : {});
  useStore.getState = () => ({});
  const useChronoStore = (selector) => (selector ? selector(chronoState) : chronoState);
  useChronoStore.getState = () => chronoState;
  return { default: useStore, useChronoStore };
});

const afficher = (exo) =>
  render(<ExerciceCard exo={exo} onMarkAsDone={vi.fn()} onEvaluateCM={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  chronoState = {
    globalChrono: { exoId: null, isRunning: false, elapsedSeconds: 0 },
    startGlobalChrono: vi.fn(), toggleGlobalChrono: vi.fn(), resetGlobalChrono: vi.fn(),
  };
});

describe('ExerciceCard — motifs de planification', () => {
  it('affiche les motifs en clair issus du calcul de priorité', () => {
    // Le score était auparavant un produit d'une douzaine de facteurs :
    // rien ne pouvait en être expliqué à l'écran.
    afficher({
      id: 'cm1', titre: 'Groupes', matiereNom: 'Algèbre', type: 'CM',
      priorite: 76,
      explication: { raisons: ['Examen dans 2 jours', 'Moyenne critique (6.0/20)'], composantes: [], modificateurs: [] },
    });

    expect(screen.getByText('Examen dans 2 jours')).toBeInTheDocument();
    expect(screen.getByText('Moyenne critique (6.0/20)')).toBeInTheDocument();
  });

  it('rapporte le score de priorité en infobulle', () => {
    afficher({
      id: 'cm1', titre: 'Groupes', matiereNom: 'Algèbre', type: 'CM',
      priorite: 76,
      explication: { raisons: ['Jamais travaillé'], composantes: [], modificateurs: [] },
    });

    expect(screen.getByTitle(/76 sur 100/)).toBeInTheDocument();
  });

  it('se rabat sur les anciens codes de motif', () => {
    // Les rapports produits avant l'ajout du moteur explicable n'ont que ces codes.
    afficher({
      id: 'td1', titre: 'TD1', matiereNom: 'Algèbre', type: 'TD',
      raisons: ['EXAMEN_PROCHE'],
    });

    expect(screen.getByText(/Examen Proche/i)).toBeInTheDocument();
  });

  it('ne double pas l\'affichage quand les deux formes coexistent', () => {
    afficher({
      id: 'td1', titre: 'TD1', matiereNom: 'Algèbre', type: 'TD',
      raisons: ['EXAMEN_PROCHE'],
      explication: { raisons: ['Examen cette semaine'], composantes: [], modificateurs: [] },
    });

    expect(screen.getByText('Examen cette semaine')).toBeInTheDocument();
    expect(screen.queryByText(/Examen Proche/i)).not.toBeInTheDocument();
  });

  it('reste sobre quand rien ne justifie la tâche', () => {
    afficher({ id: 'td1', titre: 'TD1', matiereNom: 'Algèbre', type: 'TD' });
    expect(screen.getByText('TD1')).toBeInTheDocument();
  });
});
