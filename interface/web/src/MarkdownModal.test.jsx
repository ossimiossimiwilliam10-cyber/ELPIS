import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownModal from './MarkdownModal';

describe('MarkdownModal', () => {
  it('does not render when isOpen is false', () => {
    render(<MarkdownModal isOpen={false} />);
    expect(screen.queryByText('Éditer les Notes')).toBeNull();
  });

  it('renders correctly when open', () => {
    render(<MarkdownModal isOpen={true} initialValue="Test notes" />);
    expect(screen.getByText('Éditer les Notes')).toBeDefined();
    expect(screen.getByDisplayValue('Test notes')).toBeDefined();
  });

  it('switches between edit and preview modes', () => {
    render(<MarkdownModal isOpen={true} initialValue="**Gras**" />);
    
    // Default is edit mode
    expect(screen.getByDisplayValue('**Gras**')).toBeDefined();
    
    // Switch to preview
    fireEvent.click(screen.getByText('Aperçu (Markdown)'));
    // Should render markdown
    expect(screen.getByText('Gras')).toBeDefined();
    expect(screen.queryByDisplayValue('**Gras**')).toBeNull();
    
    // Switch back
    fireEvent.click(screen.getByText('Éditer'));
    expect(screen.getByDisplayValue('**Gras**')).toBeDefined();
  });

  it('calls onSave with updated value and onClose', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();
    render(<MarkdownModal isOpen={true} initialValue="Init" onSave={handleSave} onClose={handleClose} />);
    
    const textarea = screen.getByDisplayValue('Init');
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    
    fireEvent.click(screen.getByText('Enregistrer'));
    
    expect(handleSave).toHaveBeenCalledWith('Updated');
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking Annuler', () => {
    const handleClose = vi.fn();
    render(<MarkdownModal isOpen={true} onClose={handleClose} />);
    
    fireEvent.click(screen.getByText('Annuler'));
    
    expect(handleClose).toHaveBeenCalled();
  });
});
