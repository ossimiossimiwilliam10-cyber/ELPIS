import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StarRating from './StarRating';


describe('StarRating', () => {
  it('should render without crashing', () => {
    render(<StarRating />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
