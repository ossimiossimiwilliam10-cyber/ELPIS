import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AICoachSidebar from './AICoachSidebar';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('AICoachSidebar', () => {
  it('should render without crashing', () => {
    render(<AICoachSidebar />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
