import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsSection from './StatsSection';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('StatsSection', () => {
  it('should render without crashing', () => {
    render(<StatsSection />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
