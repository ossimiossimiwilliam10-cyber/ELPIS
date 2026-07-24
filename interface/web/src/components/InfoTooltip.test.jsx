import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InfoTooltip from './InfoTooltip';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('InfoTooltip', () => {
  it('should render without crashing', () => {
    render(<InfoTooltip />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
