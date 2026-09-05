import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHashRoute } from './useHashRoute';

/** Pilote le hook comme le ferait App : un état d'onglet synchronisé avec l'URL. */
function setup(initialTab = 'dashboard') {
  const setActiveTab = vi.fn();
  const view = renderHook(
    ({ tab }) => useHashRoute(tab, setActiveTab),
    { initialProps: { tab: initialTab } }
  );
  return { ...view, setActiveTab };
}

beforeEach(() => {
  window.location.hash = '';
  document.title = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('useHashRoute — état vers URL', () => {
  it('inscrit l\'onglet courant dans le fragment', () => {
    setup('bulletin');
    expect(window.location.hash).toBe('#/bulletin');
  });

  it('met à jour le fragment au changement d\'onglet', () => {
    const { rerender } = setup('dashboard');
    expect(window.location.hash).toBe('#/dashboard');

    rerender({ tab: 'statistiques' });
    expect(window.location.hash).toBe('#/statistiques');
  });

  it('nomme l\'onglet dans le titre du document', () => {
    setup('cours');
    expect(document.title).toBe('ELPIS — Bibliothèque');
  });
});

describe('useHashRoute — URL vers état', () => {
  it('applique l\'onglet demandé dans l\'URL au chargement', () => {
    window.location.hash = '#/projets';
    const { setActiveTab } = setup('dashboard');
    expect(setActiveTab).toHaveBeenCalledWith('projets');
  });

  it('réagit au bouton Retour du navigateur', () => {
    const { setActiveTab } = setup('dashboard');
    setActiveTab.mockClear();

    act(() => {
      window.location.hash = '#/absences';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(setActiveTab).toHaveBeenCalledWith('absences');
  });

  it('retombe sur l\'accueil devant un fragment inconnu', () => {
    window.location.hash = '#/page-qui-nexiste-pas';
    const { setActiveTab } = setup('dashboard');
    expect(setActiveTab).toHaveBeenCalledWith('dashboard');
  });

  it('accepte le fragment sans barre oblique', () => {
    window.location.hash = '#stages';
    const { setActiveTab } = setup('dashboard');
    expect(setActiveTab).toHaveBeenCalledWith('stages');
  });
});
