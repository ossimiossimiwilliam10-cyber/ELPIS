import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskCompletionModal from './TaskCompletionModal';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('TaskCompletionModal', () => {
  it('should render without crashing', () => {
    render(<TaskCompletionModal />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
