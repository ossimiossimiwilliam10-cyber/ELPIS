import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VitesseExamen from './VitesseExamen';

const matiere = (nom, extra) => ({
  nom, duree: 90, besoin: 90, ratio: 1, source: 'annales', mesures: 2,
  fiable: true, etat: 'juste', message: '', ...extra,
});

const vitesse = (matieres, extra = {}) => ({
  matieres,
  mesurees: matieres.filter(m => m.ratio !== null).length,
  critiques: matieres.filter(m => m.etat === 'critique').length,
  justes: matieres.filter(m => m.etat === 'juste').length,
  laPlusTendue: matieres.find(m => m.etat !== 'confortable') || null,
  ...extra,
});

describe('VitesseExamen', () => {
  it('reste absente sans aucune matière à épreuve chronométrée', () => {
    const { container } = render(<VitesseExamen vitesse={vitesse([])} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<VitesseExamen vitesse={null} />).container).toBeEmptyDOMElement();
  });

  it('explique ce qu\'il faut faire quand rien n\'est encore mesuré', () => {
    render(<VitesseExamen vitesse={vitesse([
      matiere('Mécanique 3', { ratio: null, etat: 'inconnu' }),
    ])} />);
    expect(screen.getByText(/Chronomètre tes annales/)).toBeInTheDocument();
  });

  it('confronte le temps nécessaire à la durée accordée', () => {
    render(<VitesseExamen vitesse={vitesse([
      matiere('Électromagnétisme 3', {
        besoin: 115, duree: 90, ratio: 1.28, etat: 'critique',
        message: '25 min de trop.',
      }),
    ])} />);

    expect(screen.getByText('115 min')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
    expect(screen.getByText('Trop lent')).toBeInTheDocument();
  });

  it('distingue les trois états', () => {
    render(<VitesseExamen vitesse={vitesse([
      matiere('A', { etat: 'critique' }),
      matiere('B', { etat: 'juste' }),
      matiere('C', { etat: 'confortable' }),
    ])} />);
    expect(screen.getByText('Trop lent')).toBeInTheDocument();
    expect(screen.getByText('Sans marge')).toBeInTheDocument();
    expect(screen.getByText('Dans les temps')).toBeInTheDocument();
  });

  it('signale un diagnostic tiré d\'une seule mesure', () => {
    // Une annale unique ne suffit pas à conclure ; le dire évite de prendre
    // une mauvaise journée pour une tendance.
    render(<VitesseExamen vitesse={vitesse([matiere('A', { fiable: false, mesures: 1 })])} />);
    expect(screen.getByText(/une seule mesure/)).toBeInTheDocument();
  });

  it('signale une estimation faite sur les TD', () => {
    render(<VitesseExamen vitesse={vitesse([matiere('A', { source: 'td' })])} />);
    expect(screen.getByText(/estimé sur tes TD/)).toBeInTheDocument();
  });

  it('met en avant la matière la plus tendue', () => {
    render(<VitesseExamen vitesse={vitesse([
      matiere('Électromagnétisme 3', { etat: 'critique', message: 'Il te faudrait 25 min de plus.' }),
    ])} />);
    expect(screen.getByText('Il te faudrait 25 min de plus.')).toBeInTheDocument();
  });

  it('ne conclut rien quand tout est dans les temps', () => {
    render(<VitesseExamen vitesse={vitesse([matiere('A', { etat: 'confortable', ratio: 0.5 })])} />);
    expect(document.querySelector('.vitesse-verdict')).toBeNull();
  });

  it('écarte les matières non mesurées de la liste', () => {
    render(<VitesseExamen vitesse={vitesse([
      matiere('Mesurée', { etat: 'juste' }),
      matiere('Inconnue', { ratio: null, etat: 'inconnu' }),
    ])} />);
    expect(screen.getByText('Mesurée')).toBeInTheDocument();
    expect(screen.queryByText('Inconnue')).not.toBeInTheDocument();
  });
});
