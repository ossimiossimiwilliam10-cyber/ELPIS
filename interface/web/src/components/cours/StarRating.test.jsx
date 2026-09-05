import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarRating from './StarRating';

describe('StarRating', () => {
  it('propose cinq niveaux actionnables', () => {
    // En <span> cliquables, le réglage était inatteignable au clavier.
    render(<StarRating value={3} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('nomme chaque niveau', () => {
    render(<StarRating value={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1 étoile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 étoiles' })).toBeInTheDocument();
  });

  it('remonte le niveau choisi', () => {
    const onChange = vi.fn();
    render(<StarRating value={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '4 étoiles' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('signale le niveau courant', () => {
    render(<StarRating value={2} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2 étoiles' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5 étoiles' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('retombe sur un niveau par défaut sans valeur', () => {
    render(<StarRating onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1 étoile' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('porte le libellé du groupe', () => {
    render(<StarRating value={1} onChange={vi.fn()} tooltip="Difficulté ressentie" />);
    expect(screen.getByRole('group', { name: 'Difficulté ressentie' })).toBeInTheDocument();
  });
});
