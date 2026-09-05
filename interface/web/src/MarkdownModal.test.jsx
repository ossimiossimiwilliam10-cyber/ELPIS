import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownModal from './MarkdownModal';

const ouvrir = (props = {}) => {
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <MarkdownModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      title="Notes CM : Groupes"
      initialValue="**Important**"
      {...props}
    />
  );
  return { onClose, onSave };
};

beforeEach(() => vi.clearAllMocks());

describe('MarkdownModal', () => {
  it('reste invisible tant qu\'elle est fermée', () => {
    render(<MarkdownModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} title="Notes" />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('affiche le titre et la note existante', () => {
    ouvrir();
    expect(screen.getByText('Notes CM : Groupes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('**Important**')).toBeInTheDocument();
  });

  it('enregistre la note modifiée', () => {
    const { onSave, onClose } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Titre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith('# Titre');
    expect(onClose).toHaveBeenCalled();
  });

  it('abandonne les modifications à l\'annulation', () => {
    const { onSave, onClose } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'perdu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('accepte une note vide au départ', () => {
    ouvrir({ initialValue: undefined });
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
