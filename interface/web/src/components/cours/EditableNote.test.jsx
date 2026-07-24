import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditableNote from './EditableNote';


describe('EditableNote', () => {
  it('should render without crashing', () => {
    render(<EditableNote />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
