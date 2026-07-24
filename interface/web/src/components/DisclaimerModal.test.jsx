import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DisclaimerModal from './DisclaimerModal';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('DisclaimerModal', () => {
  it('should render without crashing', () => {
    render(<DisclaimerModal />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
