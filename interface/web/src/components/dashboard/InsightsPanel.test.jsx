import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightsPanel from './InsightsPanel';

describe('InsightsPanel', () => {
  it('reste absent tant que le planificateur n\'a rien analysé', () => {
    const { container } = render(<InsightsPanel intelligence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('relaie le motif du risque de surmenage', () => {
    render(<InsightsPanel intelligence={{
      burnoutRisk: { riskLevel: 'high', reason: '11 jours de suite sans repos.' },
    }} />);
    expect(screen.getByText(/Risque de surmenage élevé/)).toBeInTheDocument();
    expect(screen.getByText('11 jours de suite sans repos.')).toBeInTheDocument();
  });

  it('affiche tous les signaux relevés, pas seulement le plus grave', () => {
    // La veille en remonte plusieurs à la fois ; le plus grave masquait les
    // autres, dont celui sur lequel il est le plus simple d'agir.
    render(<InsightsPanel intelligence={{
      burnoutRisk: {
        riskLevel: 'medium',
        signaux: [
          { cle: 'serie-longue', gravite: 'medium', texte: '12 jours consécutifs de travail.' },
          { cle: 'seances-tardives', gravite: 'low', texte: '4 séances après ton heure de coucher.' },
        ],
      },
    }} />);

    expect(screen.getByText('Série de travail continue')).toBeInTheDocument();
    expect(screen.getByText('Séances tardives')).toBeInTheDocument();
    expect(document.querySelectorAll('.constat')).toHaveLength(2);
  });

  it('nomme un signal inconnu au lieu de le taire', () => {
    render(<InsightsPanel intelligence={{
      burnoutRisk: { riskLevel: 'medium', signaux: [{ cle: 'inedit', texte: 'Quelque chose à surveiller.' }] },
    }} />);
    expect(screen.getByText('Quelque chose à surveiller.')).toBeInTheDocument();
  });

  it('confirme un rythme soutenable avec ses chiffres', () => {
    render(<InsightsPanel intelligence={{
      burnoutRisk: { riskLevel: 'none', daysWithoutRest: 2, avgDailyMinutes: 150 },
    }} />);
    expect(screen.getByText(/Rythme soutenable/)).toBeInTheDocument();
    expect(screen.getByText(/2 jours sans repos/)).toBeInTheDocument();
    expect(screen.getByText(/2\.5 h/)).toBeInTheDocument();
  });

  it('détaille les matières qui demandent plus de passages', () => {
    render(<InsightsPanel intelligence={{
      velocityMap: {
        'Analyse': { isSlowLearner: true, avgSessionsToMaster: 3.4, masteredCMs: 2, totalCMs: 10, estimatedRemainingMinutes: 360 },
        'Algèbre': { isSlowLearner: false },
      },
    }} />);
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.queryByText('Algèbre')).not.toBeInTheDocument();
    expect(screen.getByText(/6 h restantes/)).toBeInTheDocument();
  });

  it('répartit les matières entre matin et soir', () => {
    render(<InsightsPanel intelligence={{
      cognitiveLoadMap: {
        'Mécanique quantique': { cognitiveLoad: 'heavy' },
        'Anglais': { cognitiveLoad: 'light' },
      },
    }} />);
    expect(screen.getByText(/Le matin/)).toBeInTheDocument();
    expect(screen.getByText('Mécanique quantique')).toBeInTheDocument();
    expect(screen.getByText(/Le soir/)).toBeInTheDocument();
    expect(screen.getByText('Anglais')).toBeInTheDocument();
  });

  it('annonce le nombre de matières masquées au lieu de tronquer en silence', () => {
    const charge = {};
    for (let i = 1; i <= 8; i++) charge[`Matière ${i}`] = { cognitiveLoad: 'heavy' };
    render(<InsightsPanel intelligence={{ cognitiveLoadMap: charge }} />);

    expect(screen.getByText('Matière 5')).toBeInTheDocument();
    expect(screen.queryByText('Matière 6')).not.toBeInTheDocument();
    expect(screen.getByText('+ 3 autres')).toBeInTheDocument();
  });

  it('n\'affiche aucun bloc vide quand rien n\'est notable', () => {
    render(<InsightsPanel intelligence={{ velocityMap: {}, cognitiveLoadMap: {} }} />);
    expect(document.querySelectorAll('.constat')).toHaveLength(0);
  });
});
