import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DisclaimerModal from './DisclaimerModal';

describe('DisclaimerModal', () => {
  it('accueille plutôt qu\'il n\'avertit', () => {
    // L'écran s'ouvrait sur « Protocole d'Utilisation » et un panneau
    // d'avertissement, avant d'avoir rien montré de l'application.
    render(<DisclaimerModal onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Bienvenue dans ELPIS/i })).toBeInTheDocument();
  });

  it('explique pourquoi l\'auto-évaluation doit être sincère', () => {
    // C'est la seule chose qu'un nouvel arrivant doit comprendre au premier
    // écran ; le reste s'apprend en s'en servant.
    render(<DisclaimerModal onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /sincère/i })).toBeInTheDocument();
  });

  it('ne décrit plus une architecture qui n\'existe plus', () => {
    // Il parlait d'un cloud Render, d'un iPhone, et d'un « Commit & Push » à
    // demander à l'IA après chaque ajout de PDF.
    const { container } = render(<DisclaimerModal onClose={vi.fn()} />);
    expect(container.textContent).not.toMatch(/Render|iPhone|Commit/i);
  });

  it('propose une seule action de sortie', () => {
    render(<DisclaimerModal onClose={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('se referme au bouton de validation', () => {
    const onClose = vi.fn();
    render(<DisclaimerModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('s\'affiche sans rappel de fermeture', () => {
    // La modale est parfois montée sans gestionnaire : elle ne doit pas tomber.
    expect(() => render(<DisclaimerModal />)).not.toThrow();
  });
});
