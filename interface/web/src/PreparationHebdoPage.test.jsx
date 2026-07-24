import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PreparationHebdoPage from './PreparationHebdoPage';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('PreparationHebdoPage', () => {
  it('should render without crashing', () => {
    render(<PreparationHebdoPage />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
