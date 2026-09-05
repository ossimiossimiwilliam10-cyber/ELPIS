import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeCard from './WelcomeCard';

const baseProps = {
  greeting: 'Bonjour',
  orderedTaches: [],
  recommendedDailyHours: 0,
  tempsRequisMin: 0,
  globalPercent: 0,
  config: null,
  tempsTravailleToday: 0,
};

describe('WelcomeCard', () => {
  it('affiche la salutation reçue', () => {
    render(<WelcomeCard {...baseProps} greeting="Bonsoir" />);
    expect(screen.getByText(/Bonsoir/)).toBeInTheDocument();
  });

  it('reste lisible au premier lancement, sans configuration ni tâche', () => {
    const { container } = render(<WelcomeCard {...baseProps} />);
    expect(screen.getByText(/tout terminé pour aujourd'hui/i)).toBeInTheDocument();
    // Aucune valeur calculée ne doit fuir sous forme de NaN faute de données.
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('accorde le décompte des objectifs restants', () => {
    const { rerender } = render(
      <WelcomeCard {...baseProps} orderedTaches={[{ id: 'a' }]} />
    );
    expect(screen.getByText(/1 objectif à accomplir/)).toBeInTheDocument();

    rerender(<WelcomeCard {...baseProps} orderedTaches={[{ id: 'a' }, { id: 'b' }]} />);
    expect(screen.getByText(/2 objectifs à accomplir/)).toBeInTheDocument();
  });

  it('convertit le temps travaillé du jour en heures', () => {
    const { container } = render(<WelcomeCard {...baseProps} tempsTravailleToday={90} />);
    expect(container.textContent).toContain('1.5h');
  });

  it('affiche la série en cours et le record', () => {
    render(<WelcomeCard {...baseProps} config={{ currentStreak: 4, bestStreak: 12 }} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/Record : 12/)).toBeInTheDocument();
  });
});

describe('WelcomeCard — cursus sans contenu', () => {
  /*
   * Zéro tâche recouvre deux situations opposées : tout est fait, ou rien n'a
   * encore été saisi. Le défaut existait à deux endroits de l'écran d'accueil ;
   * corriger l'état vide plus bas dans la page ne suffisait pas, la salutation
   * félicitait toujours. Découvert sur le téléphone, pas dans les tests.
   */
  it("n'annonce pas une journée accomplie quand rien n'est saisi", () => {
    render(<WelcomeCard {...baseProps} orderedTaches={[]} cursusSansContenu />);
    expect(screen.getByText(/aucun cours n’y figure encore|aucun cours n'y figure encore/i)).toBeInTheDocument();
    expect(screen.queryByText(/tout terminé/i)).not.toBeInTheDocument();
  });

  it('félicite quand le programme du jour a bien été accompli', () => {
    render(<WelcomeCard {...baseProps} orderedTaches={[]} cursusSansContenu={false} />);
    expect(screen.getByText(/tout terminé/i)).toBeInTheDocument();
  });

  it('compte les objectifs restants quand il y en a', () => {
    render(<WelcomeCard {...baseProps} orderedTaches={[{ id: 'a' }, { id: 'b' }]} cursusSansContenu />);
    expect(screen.getByText(/2 objectifs à accomplir/i)).toBeInTheDocument();
  });
});
