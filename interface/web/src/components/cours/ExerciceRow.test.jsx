import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExerciceRow from './ExerciceRow';
import { ToastProvider } from '../../ToastProvider';

describe('ExerciceRow', () => {
  const defaultProps = {
    exercice: { titre: 'Exo 1', difficulteInitiale: 2 },
    type: 'TD',
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onUploadPdf: vi.fn(),
    onEditNotes: vi.fn()
  };

  it('renders correctly', () => {
    render(<ToastProvider><ExerciceRow {...defaultProps} /></ToastProvider>);
    expect(screen.getByText('Exo 1')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ToastProvider><ExerciceRow {...defaultProps} /></ToastProvider>);
    fireEvent.click(screen.getByTitle('Supprimer'));
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('calls onUploadPdf when pdf button is clicked', () => {
    render(<ToastProvider><ExerciceRow {...defaultProps} /></ToastProvider>);
    fireEvent.click(screen.getByText('📄'));
    expect(defaultProps.onUploadPdf).toHaveBeenCalled();
  });

  it('renders date picker for TP', () => {
    render(<ToastProvider><ExerciceRow {...defaultProps} type="TP" exercice={{ ...defaultProps.exercice, dateTP: '2023-01-01' }} /></ToastProvider>);
    expect(screen.getByText('📅 Date du TP :')).toBeInTheDocument();
    
    // Check if input is rendered and works
    const dateInput = screen.getByDisplayValue('2023-01-01');
    fireEvent.change(dateInput, { target: { value: '2023-01-02' } });
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('dateTP', '2023-01-02');
  });

  it('handles difficulty changes', () => {
    render(<ToastProvider><ExerciceRow {...defaultProps} /></ToastProvider>);
    const stars = screen.getAllByText('★');
    fireEvent.click(stars[3]); // 4th star
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('difficulteInitiale', 4);
  });
});
