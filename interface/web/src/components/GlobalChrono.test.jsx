import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GlobalChrono from './GlobalChrono';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('GlobalChrono', () => {
  it('should render without crashing', () => {
    render(<GlobalChrono />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
