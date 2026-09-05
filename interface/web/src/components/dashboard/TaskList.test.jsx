import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskList from './TaskList';

const TACHES = [
  { id: 'cm::algèbre::cm1', titre: 'CM1', matiere: 'Algèbre', type: 'CM', dureeMinutes: 60, moment: 'matin' },
  { id: 'cm::analyse::cm1', titre: 'CM1', matiere: 'Analyse', type: 'CM', dureeMinutes: 30, moment: 'soir' },
  { id: 'td::algèbre::td3', titre: 'TD3', matiere: 'Algèbre', type: 'TD', dureeMinutes: 20 },
];

const renderList = (props = {}) => {
  const handlers = {
    onDragEnd: vi.fn(),
    onTaskComplete: vi.fn(),
    onSuspendCM: vi.fn(),
    ...props,
  };
  render(<TaskList orderedTaches={TACHES} {...handlers} />);
  return handlers;
};

describe('TaskList', () => {
  it('affiche chaque tâche avec sa matière et sa durée', () => {
    renderList();
    expect(screen.getAllByText('CM1')).toHaveLength(2);
    expect(screen.getByText('TD3')).toBeInTheDocument();
    expect(screen.getByText(/~60 min/)).toBeInTheDocument();
  });

  it('numérote les tâches dans l\'ordre affiché', () => {
    renderList();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('affiche les motifs de priorité quand le planificateur en fournit', () => {
    render(<TaskList
      orderedTaches={[{
        id: 'cm1', titre: 'Groupes', matiere: 'Algèbre', type: 'CM', dureeMinutes: 60,
        priorite: 76,
        explication: { raisons: ['Examen dans 2 jours', 'Jamais travaillé'] },
      }]}
      onDragEnd={vi.fn()} onTaskComplete={vi.fn()} onSuspendCM={vi.fn()}
    />);
    expect(screen.getByText(/Examen dans 2 jours/)).toBeInTheDocument();
    expect(screen.getByTitle(/76 sur 100/)).toBeInTheDocument();
  });

  it('porte la couleur du type d\'activité', () => {
    const { container } = render(<TaskList
      orderedTaches={[{ id: 'td1', titre: 'TD1', matiere: 'Algèbre', type: 'TD' }]}
      onDragEnd={vi.fn()} onTaskComplete={vi.fn()} onSuspendCM={vi.fn()}
    />);
    expect(container.querySelector('.tache').style.getPropertyValue('--liseré')).toContain('type-td');
  });

  it('signale le moment conseillé de la journée', () => {
    renderList();
    expect(screen.getByText(/Matin/)).toBeInTheDocument();
    expect(screen.getByText(/Soir/)).toBeInTheDocument();
  });

  it('remonte la tâche exacte validée, homonymes compris', () => {
    // Régression : deux CM1 de matières différentes étaient confondus.
    const { onTaskComplete } = renderList();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fait' })[1]);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete.mock.calls[0][0]).toMatchObject({ matiere: 'Analyse', titre: 'CM1' });
  });

  it('ne propose la suspension que pour les CM', () => {
    renderList();
    expect(screen.getAllByRole('button', { name: /Suspendre/ })).toHaveLength(2);
  });

  it('ne rend rien sans tâche, sans planter', () => {
    const { container } = render(
      <TaskList orderedTaches={[]} onDragEnd={vi.fn()} onTaskComplete={vi.fn()} onSuspendCM={vi.fn()} />
    );
    expect(container.querySelectorAll('.todo-item')).toHaveLength(0);
  });
});
