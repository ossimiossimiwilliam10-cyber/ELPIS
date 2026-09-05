import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciceRow from './ExerciceRow';

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../ToastProvider', () => ({ useToast: () => ({ toast }) }));

const afficher = (exercice, type = 'TD', handlers = {}) => {
  const props = {
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onUploadPdf: vi.fn(),
    onEditNotes: vi.fn(),
    ...handlers,
  };
  render(<ExerciceRow exercice={exercice} type={type} {...props} />);
  return props;
};

beforeEach(() => vi.clearAllMocks());

describe('ExerciceRow', () => {
  it('affiche le titre de l\'exercice', () => {
    afficher({ titre: 'TD n°3' });
    expect(screen.getByText('TD n°3')).toBeInTheDocument();
  });

  it('propose une date prévue pour un TD', () => {
    afficher({ titre: 'TD1', datePrevue: '2026-09-15' });
    expect(screen.getByDisplayValue('2026-09-15')).toBeInTheDocument();
  });

  it('convertit une date au format jour/mois/année', () => {
    afficher({ titre: 'TD1', datePrevue: '15/09/2026' });
    expect(screen.getByDisplayValue('2026-09-15')).toBeInTheDocument();
  });

  it('remonte la date choisie', () => {
    const { onUpdate } = afficher({ titre: 'TD1' });
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2026-10-01' } });
    expect(onUpdate).toHaveBeenCalledWith('datePrevue', '2026-10-01');
  });

  it('utilise la date de TP pour un TP', () => {
    afficher({ titre: 'TP1', dateTP: '2026-09-20' }, 'TP');
    expect(screen.getByDisplayValue('2026-09-20')).toBeInTheDocument();
  });

  it('signale les documents liés, même sans pdfPath', () => {
    // Régression : la liste `pdfPaths` était ignorée, un exercice pourvu de
    // documents paraissait dépourvu.
    afficher({ titre: 'TD1', pdfPaths: ['/a.pdf', '/b.pdf'] });
    expect(screen.getByLabelText('2 document(s) lié(s)')).toBeInTheDocument();
  });

  it('signale l\'absence de document', () => {
    afficher({ titre: 'TD1' });
    expect(screen.getByLabelText('Lier un document')).toBeInTheDocument();
  });

  it('déclenche la suppression demandée', () => {
    const { onDelete } = afficher({ titre: 'TD1' });
    fireEvent.click(screen.getByTitle('Supprimer'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('ouvre l\'éditeur de notes', () => {
    const { onEditNotes } = afficher({ titre: 'TD1', notes: 'Ma note' });
    fireEvent.click(screen.getByText('Ma note'));
    expect(onEditNotes).toHaveBeenCalled();
  });

  it('remonte la difficulté choisie', () => {
    const { onUpdate } = afficher({ titre: 'TD1' });
    fireEvent.click(screen.getByRole('button', { name: '4 étoiles' }));
    expect(onUpdate).toHaveBeenCalledWith('difficulteInitiale', 4);
  });

  it('donne une difficulté de départ plus élevée aux annales', () => {
    afficher({ titre: 'Session 2025' }, 'Annale');
    expect(screen.getByRole('button', { name: '3 étoiles' })).toHaveAttribute('aria-pressed', 'true');
  });
});
