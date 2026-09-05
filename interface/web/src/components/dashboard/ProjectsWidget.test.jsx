import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectsWidget from './ProjectsWidget';

const setActiveTab = vi.fn();

vi.mock('../../store', () => ({
  default: Object.assign(() => ({}), { getState: () => ({ setActiveTab }) }),
}));

describe('ProjectsWidget', () => {
  it('propose de créer un projet quand il n\'y en a aucun', () => {
    render(<ProjectsWidget projets={[]} pendingTasksCount={0} />);
    expect(screen.getByText(/Aucun projet en cours/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer un projet/i })).toBeInTheDocument();
  });

  it('tolère une liste de projets absente (base vierge)', () => {
    const { container } = render(<ProjectsWidget projets={undefined} pendingTasksCount={0} />);
    expect(screen.getByText(/Aucun projet en cours/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('renvoie vers l\'onglet Projets au clic', () => {
    render(<ProjectsWidget projets={[]} pendingTasksCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Créer un projet/i }));
    expect(setActiveTab).toHaveBeenCalledWith('projets');
  });

  it('verrouille les projets tant que des tâches du jour restent à faire', () => {
    render(<ProjectsWidget projets={[]} pendingTasksCount={3} />);
    expect(screen.getByText(/Termine d'abord tes 3 tâches/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer un projet/i })).not.toBeInTheDocument();
  });

  it('affiche l\'avancement en phases de chaque projet', () => {
    render(
      <ProjectsWidget
        pendingTasksCount={0}
        projets={[{
          id: 'p1',
          titre: 'Portfolio',
          phases: [{ complete: true }, { complete: false }, { complete: true }],
        }]}
      />
    );
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 3 phases complétées/)).toBeInTheDocument();
  });
});
