import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChargeDuJour from './ChargeDuJour';

describe('ChargeDuJour', () => {
  it('compare le prévu au tenable en heures lisibles', () => {
    render(<ChargeDuJour tempsRequisMin={95} tempsDispoMin={180} surcharge={false} />);
    expect(screen.getByText('1h35')).toBeInTheDocument();
    expect(screen.getByText('3h00')).toBeInTheDocument();
  });

  it('énonce le verdict au lieu de laisser lire un pourcentage', () => {
    render(<ChargeDuJour tempsRequisMin={95} tempsDispoMin={180} surcharge={false} />);
    expect(screen.getByText(/Charge équilibrée/)).toBeInTheDocument();
    expect(screen.queryByText(/Retard accumulé/)).not.toBeInTheDocument();
  });

  it('signale les révisions décrochées et ce qui est fait pour elles', () => {
    render(<ChargeDuJour tempsRequisMin={400} tempsDispoMin={180} surcharge />);
    expect(screen.getByText('Révisions décrochées')).toBeInTheDocument();
    expect(screen.getByText(/repris chaque jour en priorité/)).toBeInTheDocument();
  });

  it("chiffre ce qui a décroché plutôt que de rester abstrait", () => {
    /*
     * Le voyant annonçait « du retard s'est accumulé » tous les jours, en se
     * fondant sur le volume de révisions dues — un stock qui, avec 78 chapitres,
     * ne redescend jamais. Il compte désormais les cours dont l'attente dépasse
     * le double du délai prévu : un ensemble qui se vide quand on le traite.
     */
    render(
      <ChargeDuJour
        tempsRequisMin={300} tempsDispoMin={480} surcharge
        arriereMin={150} nbEnSouffrance={5} retardMaxJours={40}
      />
    );
    expect(screen.getByText(/5 cours attendent/)).toBeInTheDocument();
    expect(screen.getByText(/40 jours/)).toBeInTheDocument();
    expect(screen.getByText(/2h30 à reprendre/)).toBeInTheDocument();
  });

  it("accorde le verbe au nombre de cours concernés", () => {
    render(
      <ChargeDuJour
        tempsRequisMin={300} tempsDispoMin={480} surcharge
        arriereMin={30} nbEnSouffrance={1} retardMaxJours={12}
      />
    );
    expect(screen.getByText(/1 cours attend depuis/)).toBeInTheDocument();
  });

  it('reste sobre quand le détail du retard est inconnu', () => {
    render(<ChargeDuJour tempsRequisMin={300} tempsDispoMin={480} surcharge />);
    expect(screen.queryByText(/à reprendre/)).not.toBeInTheDocument();
    expect(screen.getByText(/révisions ont décroché/i)).toBeInTheDocument();
  });

  it('plafonne la jauge à 100 % au lieu de déborder', () => {
    render(<ChargeDuJour tempsRequisMin={400} tempsDispoMin={180} surcharge />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('n\'affiche ni NaN ni Infinity sans temps disponible', () => {
    // Régression : `tempsRequisMin / 0` produisait Infinity dans la jauge.
    const { container } = render(<ChargeDuJour tempsRequisMin={60} tempsDispoMin={0} surcharge={false} />);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.getByText('0h00')).toBeInTheDocument();
  });
});
