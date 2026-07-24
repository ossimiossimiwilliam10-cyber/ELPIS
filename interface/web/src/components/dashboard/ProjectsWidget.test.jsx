import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsWidget from './ProjectsWidget';

vi.mock('framer-motion', () => ({ default: vi.fn() }));

describe('ProjectsWidget', () => {
  it('should render without crashing', () => {
    render(<ProjectsWidget />);
    // TODO: Ajouter des assertions significatives
    expect(document.body).toBeDefined();
  });
});
