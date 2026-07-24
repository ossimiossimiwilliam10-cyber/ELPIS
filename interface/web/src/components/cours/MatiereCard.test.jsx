import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MatiereCard from './MatiereCard';


describe('MatiereCard', () => {
  it('should render without crashing', () => {
    render(<MatiereCard />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
