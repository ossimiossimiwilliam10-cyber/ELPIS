import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditableLabel from './EditableLabel';

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../ToastProvider', () => ({ useToast: () => ({ toast }) }));

beforeEach(() => vi.clearAllMocks());

/** Ouvre la modale de renommage et saisit une valeur. */
const renommer = async (valeur) => {
  fireEvent.click(screen.getByRole('button', { name: /Renommer/i }));
  const champ = await screen.findByRole('textbox');
  fireEvent.change(champ, { target: { value: valeur } });
  fireEvent.click(screen.getByRole('button', { name: /Confirmer|Valider|OK/i }));
};

describe('EditableLabel', () => {
  it('affiche la valeur courante', () => {
    render(<EditableLabel value="Algèbre" onRename={vi.fn()} placeholder="Nom" />);
    expect(screen.getByText('Algèbre')).toBeInTheDocument();
  });

  it('affiche l\'invite quand la valeur est vide', () => {
    render(<EditableLabel value="" onRename={vi.fn()} placeholder="Nom de la matière" />);
    expect(screen.getByText('Nom de la matière')).toBeInTheDocument();
  });

  it('remonte le nouveau nom', async () => {
    const onRename = vi.fn();
    render(<EditableLabel value="Algèbre" onRename={onRename} placeholder="Nom" />);
    await renommer('Analyse');
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('Analyse'));
  });

  it('supprime les espaces superflus', async () => {
    const onRename = vi.fn();
    render(<EditableLabel value="Algèbre" onRename={onRename} placeholder="Nom" />);
    await renommer('  Analyse  ');
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('Analyse'));
  });

  it('refuse un nom vide', async () => {
    const onRename = vi.fn();
    render(<EditableLabel value="Algèbre" onRename={onRename} placeholder="Nom" />);
    await renommer('   ');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onRename).not.toHaveBeenCalled();
  });
});
