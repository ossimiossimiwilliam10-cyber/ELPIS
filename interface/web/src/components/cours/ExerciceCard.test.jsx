import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciceCard from './ExerciceCard';
import { ToastProvider } from '../../ToastProvider';

vi.mock('../../store', async () => {
  const reel = await vi.importActual('../../store');
  return {
    ...reel,
    useChronoStore: (selecteur) => {
      const etat = {
        globalChrono: { exoId: null, isRunning: false, elapsedSeconds: 0 },
        startGlobalChrono: vi.fn(),
        toggleGlobalChrono: vi.fn(),
        resetGlobalChrono: vi.fn(),
      };
      return selecteur ? selecteur(etat) : etat;
    },
  };
});

const rappels = {
  onEvaluateCM: vi.fn(),
  onMarkAsDone: vi.fn(),
  onSuspendCM: vi.fn(),
};

const cours = (extra = {}) => ({
  type: 'CM', titre: 'Chapitre 1 — Fondamentaux', matiereNom: 'Maths 3',
  repetitions: 0, jActuel: 0, ...extra,
});

const afficher = (exo, props = {}) => render(
  <ToastProvider>
    <ExerciceCard exo={exo} {...rappels} {...props} />
  </ToastProvider>,
);

beforeEach(() => vi.clearAllMocks());

describe('ExerciceCard — validation d\'un cours', () => {
  it('impose l\'épreuve Anki quand le cours est rattaché', () => {
    afficher(cours({ ankiDeck: 'Maths::Chapitre 1' }), { ankiDeckName: 'Maths' });

    expect(screen.getByText(/Vérifier sur Anki/)).toBeInTheDocument();
    expect(screen.queryByText('Oublié')).not.toBeInTheDocument();
  });

  it('garde l\'auto-évaluation quand aucun chapitre n\'est rattaché', () => {
    // Sans cartes, il n'y a rien à mesurer : bloquer rendrait le cours
    // impossible à terminer.
    afficher(cours());

    expect(screen.getByText('Oublié')).toBeInTheDocument();
    expect(screen.getByText('Évident')).toBeInTheDocument();
    expect(screen.getByText(/Rattache ce cours à un chapitre Anki/)).toBeInTheDocument();
  });
});

describe('ExerciceCard — suspension d\'une séance', () => {
  it('reste possible sur un cours rattaché à un chapitre Anki', () => {
    // Un chapitre dense se travaille en plusieurs séances : la suspension ne
    // dépend pas du mode de validation, et doit rester offerte dans les deux.
    afficher(cours({ ankiDeck: 'Maths::Chapitre 1' }), { ankiDeckName: 'Maths' });
    expect(screen.getByRole('button', { name: /Suspendre la séance/ })).toBeInTheDocument();
  });

  it('reste possible sur un cours non rattaché', () => {
    afficher(cours());
    expect(screen.getByRole('button', { name: /Suspendre la séance/ })).toBeInTheDocument();
  });

  it('disparaît quand la suspension n\'est pas proposée', () => {
    // Une tâche hors cursus n'a rien à reporter : elle n'existe pas dans le
    // cursus, donc aucune échéance ne lui est attachée.
    afficher(cours(), { onSuspendCM: undefined });
    expect(screen.queryByRole('button', { name: /Suspendre la séance/ })).not.toBeInTheDocument();
  });

  it('n\'apparaît pas sur un exercice', () => {
    afficher({ type: 'TD', titre: 'TD 1', matiereNom: 'Maths 3', nombrePratiques: 0 });
    expect(screen.queryByRole('button', { name: /Suspendre la séance/ })).not.toBeInTheDocument();
  });
});

describe('ExerciceCard — travaux pratiques', () => {
  it('annonce l\'étape en cours et le délai avant la séance', () => {
    afficher({
      type: 'TP', titre: 'TP 3 — Circuits RLC', matiereNom: 'Électronique',
      etape: 2, etapeIntention: 'Simuler le TP : tableaux, code, plan de route.',
      joursAvantTP: 5, nombrePratiques: 1,
    });

    expect(screen.getByText(/Étape 2 sur 5/)).toBeInTheDocument();
    expect(screen.getByText(/séance dans 5 jours/)).toBeInTheDocument();
    expect(screen.getByText(/Simuler le TP/)).toBeInTheDocument();
  });

  it('distingue la veille et le jour même', () => {
    const { rerender } = afficher({
      type: 'TP', titre: 'TP', matiereNom: 'M', etape: 4, joursAvantTP: 1, nombrePratiques: 3,
    });
    expect(screen.getByText(/séance demain/)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <ExerciceCard
          exo={{ type: 'TP', titre: 'TP', matiereNom: 'M', etape: 5, joursAvantTP: 0, nombrePratiques: 4 }}
          {...rappels}
        />
      </ToastProvider>,
    );
    expect(screen.getByText(/séance aujourd'hui/)).toBeInTheDocument();
  });
});
