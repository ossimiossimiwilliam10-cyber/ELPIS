import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import EditableLabel from './EditableLabel';
import { ToastProvider } from '../../ToastProvider';

describe('EditableLabel Component', () => {
  let promptSpy;

  beforeEach(() => {
    // On mock window.prompt pour pouvoir simuler la saisie de l'utilisateur
    promptSpy = vi.spyOn(window, 'prompt');
  });

  it('renders the provided value correctly', () => {
    render(<ToastProvider><EditableLabel value="Examen Final" onRename={() => {}} /></ToastProvider>);
    expect(screen.getByText('Examen Final')).toBeDefined();
  });

  it('renders the placeholder when value is empty', () => {
    render(<ToastProvider><EditableLabel value="" placeholder="Nouveau Nom" onRename={() => {}} /></ToastProvider>);
    expect(screen.getByText('Nouveau Nom')).toBeDefined();
  });

  it('calls onRename with the new text when prompt is submitted', () => {
    const mockOnRename = vi.fn();
    // Simuler que l'utilisateur tape "Nouveau Titre" dans le prompt
    promptSpy.mockReturnValue('Nouveau Titre');

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);
    
    // Trouver le bouton avec l'emoji ✏️
    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    expect(promptSpy).toHaveBeenCalledWith("Nouveau nom :", "Ancien Titre");
    expect(mockOnRename).toHaveBeenCalledWith('Nouveau Titre');
  });

  it('does not call onRename if the prompt is cancelled (returns null)', () => {
    const mockOnRename = vi.fn();
    // Simuler l'annulation (Cancel) du prompt
    promptSpy.mockReturnValue(null);

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);
    
    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    expect(mockOnRename).not.toHaveBeenCalled();
  });

  it('does not call onRename if the text is entirely whitespace', () => {
    const mockOnRename = vi.fn();
    promptSpy.mockReturnValue('    '); // Seulement des espaces

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);
    
    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    expect(mockOnRename).not.toHaveBeenCalled();
  });
});
