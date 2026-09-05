import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Couverture from './Couverture';

const matiere = (nom, extra) => ({
  nom, total: 10, abordes: 2, restants: 8,
  echeance: '2027-01-16', sourceEcheance: 'epreuve',
  joursRestants: 40, joursNecessaires: 20, tension: 0.5,
  etat: 'tenable', message: '', ...extra,
});

const couverture = (matieres, extra = {}) => ({
  matieres,
  projetees: matieres.filter(m => m.tension !== null).length,
  horsDelai: matieres.filter(m => m.etat === 'hors-delai').length,
  tendues: matieres.filter(m => m.etat === 'tendu').length,
  laPlusMenacee: matieres.find(m => m.etat === 'hors-delai' || m.etat === 'tendu') || null,
  budgetDecouverteMin: 53,
  ...extra,
});

describe('Couverture', () => {
  it('reste absente tant que rien n\'est projetable', () => {
    expect(render(<Couverture couverture={null} />).container).toBeEmptyDOMElement();
    expect(render(<Couverture couverture={couverture([
      matiere('M', { tension: null, etat: 'inconnu' }),
    ])} />).container).toBeEmptyDOMElement();
  });

  it('rassure quand tout tient, sans détailler', () => {
    // Ce qui va bien n'appelle aucune décision : inutile d'encombrer.
    render(<Couverture couverture={couverture([matiere('Optique 2')])} />);
    expect(screen.getByText(/peuvent être couvertes/)).toBeInTheDocument();
    expect(screen.queryByText('Optique 2')).not.toBeInTheDocument();
  });

  it('détaille les matières sous tension', () => {
    render(<Couverture couverture={couverture([
      matiere('Électromagnétisme 3', {
        etat: 'hors-delai', restants: 30, joursNecessaires: 60, joursRestants: 20,
        tension: 3, message: '30 chapitres jamais ouverts.',
      }),
      matiere('Optique 2'),
    ])} />);

    expect(screen.getByText('Électromagnétisme 3')).toBeInTheDocument();
    expect(screen.getByText('Hors délai')).toBeInTheDocument();
    expect(screen.queryByText('Optique 2')).not.toBeInTheDocument();
  });

  it('confronte les jours nécessaires aux jours restants', () => {
    render(<Couverture couverture={couverture([
      matiere('A', { etat: 'tendu', restants: 12, joursNecessaires: 25, joursRestants: 28, tension: 0.9 }),
    ])} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('25 j')).toBeInTheDocument();
    expect(screen.getByText('28 j')).toBeInTheDocument();
  });

  it('signale une échéance tirée de la fin du semestre', () => {
    render(<Couverture couverture={couverture([
      matiere('A', { etat: 'tendu', tension: 0.9, sourceEcheance: 'semestre' }),
    ])} />);
    expect(screen.getByText(/fin du semestre/)).toBeInTheDocument();
  });

  it('met en avant la matière la plus menacée', () => {
    render(<Couverture couverture={couverture([
      matiere('A', { etat: 'hors-delai', tension: 3, message: 'Il en faudrait 60 jours, tu en as 20.' }),
    ])} />);
    expect(screen.getByText('Il en faudrait 60 jours, tu en as 20.')).toBeInTheDocument();
  });

  it('rappelle le temps quotidien alloué à la découverte', () => {
    render(<Couverture couverture={couverture([matiere('A')])} />);
    expect(screen.getByText(/53 min par jour/)).toBeInTheDocument();
  });
});
