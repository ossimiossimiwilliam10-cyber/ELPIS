import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import EditableLabel from './EditableLabel';
import { ToastProvider } from '../../ToastProvider';

// Mock useInputModal
const mockPrompt = vi.fn();
vi.mock('../../hooks/useInputModal', () => ({
  default: () => ({
    prompt: mockPrompt,
    isOpen: false,
    config: { title: '', defaultValue: '', placeholder: '' },
    handleConfirm: vi.fn(),
    handleCancel: vi.fn()
  })
}));

// Mock InputModal
vi.mock('../InputModal', () => ({
  default: () => null
}));

describe('EditableLabel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the provided value correctly', () => {
    render(<ToastProvider><EditableLabel value="Examen Final" onRename={() => {}} /></ToastProvider>);
    expect(screen.getByText('Examen Final')).toBeDefined();
  });

  it('renders the placeholder when value is empty', () => {
    render(<ToastProvider><EditableLabel value="" placeholder="Nouveau Nom" onRename={() => {}} /></ToastProvider>);
    expect(screen.getByText('Nouveau Nom')).toBeDefined();
  });

  it('calls onRename with the new text when prompt is confirmed', async () => {
    const mockOnRename = vi.fn();
    mockPrompt.mockResolvedValue('Nouveau Titre');

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);

    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    expect(mockPrompt).toHaveBeenCalledWith("Nouveau nom :", "Ancien Titre");

    // Wait for the async prompt to resolve
    await vi.waitFor(() => {
      expect(mockOnRename).toHaveBeenCalledWith('Nouveau Titre');
    });
  });

  it('does not call onRename if the prompt is cancelled (returns null)', async () => {
    const mockOnRename = vi.fn();
    mockPrompt.mockResolvedValue(null);

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);

    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    await vi.waitFor(() => {
      expect(mockOnRename).not.toHaveBeenCalled();
    });
  });

  it('does not call onRename if the text is entirely whitespace', async () => {
    const mockOnRename = vi.fn();
    mockPrompt.mockResolvedValue('    ');

    render(<ToastProvider><EditableLabel value="Ancien Titre" onRename={mockOnRename} /></ToastProvider>);

    const editButton = screen.getByTitle('Renommer');
    fireEvent.click(editButton);

    await vi.waitFor(() => {
      expect(mockOnRename).not.toHaveBeenCalled();
    });
  });
});
