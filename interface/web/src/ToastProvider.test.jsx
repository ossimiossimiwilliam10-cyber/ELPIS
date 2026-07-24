import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import useToast from './ToastProvider';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('useToast', () => {
  it('should render without crashing', () => {
    render(<useToast />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });

  it('should export ToastProvider', () => {
    expect(ToastProvider).toBeDefined();
  });
});
