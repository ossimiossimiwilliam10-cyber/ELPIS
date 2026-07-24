import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GraphPage from './GraphPage';

vi.mock('react-force-graph-3d', () => ({ default: vi.fn() }));
vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('GraphPage', () => {
  it('should render without crashing', () => {
    render(<GraphPage />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
