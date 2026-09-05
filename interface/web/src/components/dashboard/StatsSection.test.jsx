import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsSection from './StatsSection';

const afficher = (stats, globalPercent = 0) =>
  render(<StatsSection stats={stats} globalPercent={globalPercent} />);

describe('StatsSection', () => {
  it('supporte une base vide au premier lancement', () => {
    const { container } = afficher({ done: 0, total: 0, perMatiere: [] });
    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('résume ce qui a été réalisé', () => {
    afficher({ done: 7, total: 20, perMatiere: [] }, 35);
    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByText(/sur 20/)).toBeInTheDocument();
  });

  it('invite à remplir la bibliothèque sans données', () => {
    afficher({ done: 0, total: 0, perMatiere: [] });
    expect(screen.getByText(/Ajoute des cours/i)).toBeInTheDocument();
  });

  it('liste une jauge par matière suivie', () => {
    afficher({
      done: 3, total: 10,
      perMatiere: [
        { nom: 'Algèbre', total: 5, done: 2, percent: 40 },
        { nom: 'Analyse', total: 5, done: 1, percent: 20 },
      ],
    }, 30);

    expect(screen.getByText('Algèbre')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Avancement en Algèbre/i })).toBeInTheDocument();
  });

  it('remonte les matières en retard en tête', () => {
    // Le défilement horizontal les présentait dans l'ordre du cursus : les
    // retards restaient hors de vue derrière le bord de l'écran.
    afficher({
      done: 5, total: 20,
      perMatiere: [
        { nom: 'Bien avancée', percent: 90 },
        { nom: 'En retard', percent: 10 },
        { nom: 'Moyenne', percent: 50 },
      ],
    }, 40);

    // Restreint aux jauges de matières : l'anneau global est lui aussi une
    // barre de progression depuis qu'il s'annonce correctement.
    const noms = [...document.querySelectorAll('.progression-matiere [role="progressbar"]')]
      .map(j => j.getAttribute('aria-label'));
    expect(noms[0]).toMatch(/En retard/);
    expect(noms[2]).toMatch(/Bien avancée/);
  });

  it('signale visuellement les extrêmes', () => {
    const { container } = afficher({
      done: 5, total: 10,
      perMatiere: [{ nom: 'Acquise', percent: 95 }, { nom: 'Délaissée', percent: 5 }],
    }, 50);

    expect(container.querySelector('.el-jauge__remplissage--succes')).toBeInTheDocument();
    expect(container.querySelector('.el-jauge__remplissage--attention')).toBeInTheDocument();
  });
});
