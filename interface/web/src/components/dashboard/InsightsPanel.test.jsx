import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightsPanel from './InsightsPanel';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('InsightsPanel', () => {
  it('should render without crashing', () => {
    render(<InsightsPanel />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
