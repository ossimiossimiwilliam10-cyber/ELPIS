import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditableNote from './EditableNote';

describe('EditableNote', () => {
  it('affiche la note existante', () => {
    render(<EditableNote value="Revoir le théorème 3" onClick={vi.fn()} placeholder="+ Ajouter" />);
    expect(screen.getByText('Revoir le théorème 3')).toBeInTheDocument();
  });

  it('invite à écrire quand la note est vide', () => {
    render(<EditableNote value="" onClick={vi.fn()} placeholder="+ Ajouter une note" />);
    expect(screen.getByText('+ Ajouter une note')).toBeInTheDocument();
  });

  it('est actionnable au clavier', () => {
    // Régression : un <div onClick> n'était ni focusable ni annoncé comme tel.
    const onClick = vi.fn();
    render(<EditableNote value="Note" onClick={onClick} placeholder="+ Ajouter" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('ouvre l\'éditeur au clic', () => {
    const onClick = vi.fn();
    render(<EditableNote value="Note" onClick={onClick} placeholder="+ Ajouter" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
