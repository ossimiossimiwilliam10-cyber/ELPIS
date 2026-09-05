import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Progression from './Progression';

const objectifs = (extra = {}) => ({
  cap: { cle: 'progresser', libelle: 'Progresser', intention: 'Gagner des points régulièrement.' },
  capacite: 2.5,
  budget: { total: 150, decouverte: 53, entretien: 53, entrainement: 45 },
  engagements: { joursVises: 5, joursTenus: 3, joursAtteints: false, reussie: false },
  progression: {
    franchis: 2,
    total: 8,
    enCours: {
      cle: 'reserve', titre: 'Réserve constituée',
      critere: 'Au moins une matière dispose de sept exercices jamais travaillés.',
      valeur: 4, cible: 7, franchi: false, progression: 4 / 7,
    },
    paliers: [],
  },
  ...extra,
});

describe('Progression', () => {
  it('reste absente tant que le rapport ne la contient pas', () => {
    const { container } = render(<Progression objectifs={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce le régime de travail et son intention', () => {
    render(<Progression objectifs={objectifs()} />);
    expect(screen.getByText('Progresser')).toBeInTheDocument();
    expect(screen.getByText(/Gagner des points/)).toBeInTheDocument();
  });

  it('mesure la semaine par rapport à l\'engagement', () => {
    render(<Progression objectifs={objectifs()} />);
    expect(screen.getByText('3 / 5 jours')).toBeInTheDocument();
    expect(screen.getByText(/Encore 2 jours/)).toBeInTheDocument();
  });

  it('salue une semaine tenue', () => {
    render(<Progression objectifs={objectifs({
      engagements: { joursVises: 5, joursTenus: 5, joursAtteints: true, reussie: true },
    })} />);
    expect(screen.getByText(/Engagement tenu/)).toBeInTheDocument();
  });

  it('n\'affiche qu\'un seul palier à la fois', () => {
    // Huit objectifs simultanés dispersent au lieu d'orienter.
    render(<Progression objectifs={objectifs()} />);
    expect(screen.getByText('Réserve constituée')).toBeInTheDocument();
    expect(screen.getByText('Palier 3 sur 8')).toBeInTheDocument();
    expect(screen.getByText('4 / 7')).toBeInTheDocument();
  });

  it('ne présente jamais de note ni de rang visés', () => {
    // C'est tout l'objet de la refonte : une cible lointaine place l'étudiant
    // en échec tant qu'elle n'est pas atteinte, c'est-à-dire presque toujours.
    const { container } = render(<Progression objectifs={objectifs()} />);
    expect(container.textContent).not.toMatch(/\/ 20|Top \d|rang/i);
  });

  it('détaille la journée type issue du régime', () => {
    const { container } = render(<Progression objectifs={objectifs()} />);
    const budget = container.querySelector('.prog-budget').textContent;
    expect(budget).toMatch(/53 min/);
    expect(budget).toMatch(/45 min/);
  });

  it('signale quand tous les paliers sont franchis', () => {
    render(<Progression objectifs={objectifs({
      progression: { franchis: 8, total: 8, enCours: null, paliers: [] },
    })} />);
    expect(screen.getByText(/Tous les paliers sont franchis/)).toBeInTheDocument();
  });
});
