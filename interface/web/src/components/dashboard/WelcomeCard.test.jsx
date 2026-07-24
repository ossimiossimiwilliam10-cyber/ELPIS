import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeCard from './WelcomeCard';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('WelcomeCard', () => {
  it('should render without crashing', () => {
    render(<WelcomeCard />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
