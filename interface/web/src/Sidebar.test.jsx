import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';
import { NAV_GROUPS, TAB_IDS } from './navigation';

const baseProps = {
  activeTab: 'dashboard',
  setActiveTab: vi.fn(),
  theme: 'dark',
  setTheme: vi.fn(),
  streak: 0,
  pendingTasksCount: 0,
  isMobileMenuOpen: false,
  onCloseMobileMenu: vi.fn(),
  onRequestShutdown: vi.fn(),
};

describe('Sidebar — navigation', () => {
  it('rend une entrée par onglet déclaré', () => {
    render(<Sidebar {...baseProps} />);
    for (const group of NAV_GROUPS) {
      for (const tab of group.tabs) {
        expect(screen.getByRole('button', { name: new RegExp(tab.label, 'i') })).toBeInTheDocument();
      }
    }
  });

  it('marque l\'onglet courant pour les lecteurs d\'écran', () => {
    render(<Sidebar {...baseProps} activeTab="bulletin" />);
    const actif = screen.getByRole('button', { name: /Bulletin & Notes/i });
    expect(actif).toHaveAttribute('aria-current', 'page');

    const inactif = screen.getByRole('button', { name: /Accueil/i });
    expect(inactif).not.toHaveAttribute('aria-current');
  });

  it('change d\'onglet au clic', () => {
    const setActiveTab = vi.fn();
    render(<Sidebar {...baseProps} setActiveTab={setActiveTab} />);
    fireEvent.click(screen.getByRole('button', { name: /Statistiques/i }));
    expect(setActiveTab).toHaveBeenCalledWith('statistiques');
  });

  it('n\'expose que des onglets connus du routage', () => {
    const idsDeclares = NAV_GROUPS.flatMap(g => g.tabs.map(t => t.id));
    expect(new Set(idsDeclares).size).toBe(idsDeclares.length); // aucun doublon
    expect(idsDeclares).toEqual(TAB_IDS);
  });
});

describe('Sidebar — état et actions', () => {
  it('affiche le badge des tâches en attente', () => {
    render(<Sidebar {...baseProps} pendingTasksCount={4} />);
    expect(screen.getByLabelText(/4 tâche\(s\) en attente/)).toBeInTheDocument();
  });

  it('masque le badge quand il n\'y a rien à faire', () => {
    render(<Sidebar {...baseProps} pendingTasksCount={0} />);
    expect(screen.queryByLabelText(/tâche\(s\) en attente/)).not.toBeInTheDocument();
  });

  it('verrouille Avance & Bonus tant que des tâches restent', () => {
    const { rerender } = render(<Sidebar {...baseProps} pendingTasksCount={2} />);
    expect(screen.getByRole('button', { name: /Avance & Bonus/i }).textContent).toContain('🔒');

    rerender(<Sidebar {...baseProps} pendingTasksCount={0} />);
    expect(screen.getByRole('button', { name: /Avance & Bonus/i }).textContent).toContain('🚀');
  });

  it('accorde le libellé de la série', () => {
    const { rerender } = render(<Sidebar {...baseProps} streak={1} />);
    expect(screen.getByText(/🔥 1 jour/)).toBeInTheDocument();

    rerender(<Sidebar {...baseProps} streak={5} />);
    expect(screen.getByText(/🔥 5 jours/)).toBeInTheDocument();
  });

  it('bascule le thème', () => {
    const setTheme = vi.fn();
    render(<Sidebar {...baseProps} setTheme={setTheme} theme="dark" />);
    fireEvent.click(screen.getByRole('button', { name: /Passer au mode clair/i }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('délègue l\'extinction à l\'application au lieu de l\'exécuter', () => {
    const onRequestShutdown = vi.fn();
    render(<Sidebar {...baseProps} onRequestShutdown={onRequestShutdown} />);
    fireEvent.click(screen.getByRole('button', { name: /Éteindre l'application/i }));
    expect(onRequestShutdown).toHaveBeenCalled();
  });

  it('ferme le menu mobile sur Échap', () => {
    const onCloseMobileMenu = vi.fn();
    render(<Sidebar {...baseProps} isMobileMenuOpen onCloseMobileMenu={onCloseMobileMenu} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMobileMenu).toHaveBeenCalled();
  });
});
