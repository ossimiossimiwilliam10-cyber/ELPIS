import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciceRow from './ExerciceRow';


describe('ExerciceRow', () => {
  it('should render without crashing', () => {
    render(<ExerciceRow />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
