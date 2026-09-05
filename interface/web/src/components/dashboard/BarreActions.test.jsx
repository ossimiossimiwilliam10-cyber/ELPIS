import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BarreActions from './BarreActions';

const actions = {
  onActiviteLibre: vi.fn(),
  onJourRepos: vi.fn(),
  onExportPdf: vi.fn(),
  onExportIcal: vi.fn(),
};

const afficher = (props = {}) =>
  render(<BarreActions {...actions} reposDisponible reposUtilises={0} {...props} />);

beforeEach(() => vi.clearAllMocks());

describe('BarreActions', () => {
  it('lance une activité libre', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Activité libre/i }));
    expect(actions.onActiviteLibre).toHaveBeenCalled();
  });

  it('annonce le quota de repos restant', () => {
    afficher({ reposUtilises: 0 });
    expect(screen.getByRole('button', { name: /Jour de repos \(0\/1\)/ })).toBeEnabled();
  });

  it('bloque le repos une fois le quota atteint', () => {
    afficher({ reposUtilises: 1 });
    const bouton = screen.getByRole('button', { name: /Jour de repos/ });
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveAttribute('title', expect.stringMatching(/quota/i));
  });

  it('masque le repos les jours où il ne s\'applique pas', () => {
    afficher({ reposDisponible: false });
    expect(screen.queryByRole('button', { name: /Jour de repos/ })).not.toBeInTheDocument();
  });
});

describe('BarreActions — menu d\'export', () => {
  it('reste fermé tant qu\'on ne l\'ouvre pas', () => {
    afficher();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('propose les deux formats et se referme après le choix', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);

    fireEvent.click(screen.getByRole('menuitem', { name: /iCal/ }));
    expect(actions.onExportIcal).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('se referme au clic extérieur', () => {
    // Sans cela, le menu restait ouvert par-dessus le contenu jusqu'au
    // prochain clic sur son propre bouton.
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('se referme avec Échap', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
