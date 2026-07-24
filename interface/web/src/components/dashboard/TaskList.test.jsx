import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskList from './TaskList';

vi.mock('framer-motion', () => ({ default: vi.fn() }));
vi.mock('@hello-pangea/dnd', () => ({ default: vi.fn() }));

describe('TaskList', () => {
  it('should render without crashing', () => {
    render(<TaskList />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
