import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCompletionModal from './TaskCompletionModal';
import { DIFFICULTY_LEVELS } from '../constants';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  taskTitle: 'TD1 — Algèbre',
  defaultMinutes: 20,
  taskType: 'TD',
};

const ouvrir = (props = {}) => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<TaskCompletionModal {...baseProps} onSubmit={onSubmit} onClose={onClose} {...props} />);
  return { onSubmit, onClose };
};

const valider = () => fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

beforeEach(() => vi.clearAllMocks());

describe('TaskCompletionModal — affichage', () => {
  it('ne rend rien tant qu\'elle est fermée', () => {
    ouvrir({ isOpen: false });
    expect(screen.queryByText(/Valider l'activité/i)).not.toBeInTheDocument();
  });

  it('rappelle la tâche concernée et le temps proposé', () => {
    ouvrir();
    expect(screen.getByText('TD1 — Algèbre')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });

  it('exige un niveau de rétention pour un cours', () => {
    ouvrir({ taskType: 'CM' });
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
  });

  it('n\'affiche la note que pour une annale', () => {
    const { onSubmit } = ouvrir({ taskType: 'TD' });
    expect(screen.queryByLabelText(/Note obtenue/i)).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('TaskCompletionModal — valeurs transmises', () => {
  it('emploie les clés de difficulté reconnues par le moteur de score', () => {
    // Régression : la modale envoyait « Difficile », « Moyen »… que `scoring.js`
    // ramenait silencieusement à « moyen ». Marquer un exercice difficile depuis
    // l'accueil n'avait donc aucun effet sur la planification.
    const clesConnues = DIFFICULTY_LEVELS.map(d => d.key);
    const { onSubmit } = ouvrir();

    fireEvent.click(screen.getByRole('button', { name: 'Difficile' }));
    valider();

    expect(clesConnues).toContain(onSubmit.mock.calls[0][0].difficulte);
    expect(onSubmit.mock.calls[0][0].difficulte).toBe('difficile');
  });

  it('remonte le temps saisi', () => {
    const { onSubmit } = ouvrir();
    fireEvent.change(screen.getByDisplayValue('20'), { target: { value: '45' } });
    valider();
    expect(onSubmit.mock.calls[0][0].minutes).toBe(45);
  });

  it('ne descend jamais sous une minute', () => {
    const { onSubmit } = ouvrir();
    fireEvent.change(screen.getByDisplayValue('20'), { target: { value: '0' } });
    valider();
    expect(onSubmit.mock.calls[0][0].minutes).toBeGreaterThanOrEqual(1);
  });

  it('transmet la note d\'une annale', () => {
    // La note alimente la règle d'urgence de l'orchestrateur.
    const { onSubmit } = ouvrir({ taskType: 'ANNALE' });
    fireEvent.change(screen.getByLabelText(/Note obtenue/i), { target: { value: '7.5' } });
    valider();
    expect(onSubmit.mock.calls[0][0].note).toBe(7.5);
  });

  it('laisse la note indéfinie si elle n\'est pas renseignée', () => {
    const { onSubmit } = ouvrir({ taskType: 'ANNALE' });
    valider();
    expect(onSubmit.mock.calls[0][0].note).toBeUndefined();
  });

  it('transmet le score de rétention d\'un cours', () => {
    const { onSubmit } = ouvrir({ taskType: 'CM' });
    // Le libellé vient désormais de la constante partagée RETENTION : la
    // Session du Jour et cette modale ne peuvent plus diverger.
    fireEvent.click(screen.getByTitle(/Retenu, avec un peu de réflexion/i));
    valider();
    expect(onSubmit.mock.calls[0][0].sm2Score).toBe(3);
  });

  it('ferme sans rien remonter sur Échap', () => {
    const { onSubmit, onClose } = ouvrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
