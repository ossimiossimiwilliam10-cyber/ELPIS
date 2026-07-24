import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Component from './ProjetsPage';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('Component', () => {
  it('should render without crashing', () => {
    render(<Component />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
