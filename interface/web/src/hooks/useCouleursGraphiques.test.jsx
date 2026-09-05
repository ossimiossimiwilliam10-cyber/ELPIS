import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCouleursGraphiques from './useCouleursGraphiques';

// Nettoyage avant plutôt qu'après : un `afterEach` s'exécute pendant que le
// hook est encore monté, et la remise à zéro des classes réveillait
// l'observateur de thème hors de tout `act()`.
beforeEach(() => {
  document.documentElement.className = '';
  document.documentElement.style.cssText = '';
});

describe('useCouleursGraphiques', () => {
  it('rend une couleur exploitable pour chaque type d\'activité', () => {
    const { result } = renderHook(() => useCouleursGraphiques());
    for (const type of ['type-cm', 'type-td', 'type-tp', 'type-annale']) {
      expect(result.current.couleur(type)).toMatch(/^#|^rgb/);
    }
  });

  it('préfère le jeton défini au repli codé en dur', () => {
    document.documentElement.style.setProperty('--type-cm', '#123456');
    const { result } = renderHook(() => useCouleursGraphiques());
    expect(result.current.couleur('type-cm')).toBe('#123456');
  });

  it('suit le changement de thème', async () => {
    // L'application bascule de thème en posant une classe sur <html> : sans
    // écoute, les graphiques gardaient les couleurs du thème précédent.
    const { result } = renderHook(() => useCouleursGraphiques());
    const avant = result.current.couleur('accent');

    document.documentElement.style.setProperty('--accent', '#ABCDEF');
    await act(async () => {
      document.documentElement.classList.add('light');
      await Promise.resolve();
    });

    expect(result.current.couleur('accent')).toBe('#ABCDEF');
    expect(result.current.couleur('accent')).not.toBe(avant);
  });

  it('fournit un style d\'infobulle cohérent avec les surfaces', () => {
    const { result } = renderHook(() => useCouleursGraphiques());
    expect(result.current.styleInfobulle).toMatchObject({
      backgroundColor: expect.any(String),
      borderRadius: '8px',
    });
    expect(result.current.grille).toBeTruthy();
    expect(result.current.axe).toBeTruthy();
  });

  it('ne renvoie jamais une chaîne vide, qui rendrait une courbe invisible', () => {
    const { result } = renderHook(() => useCouleursGraphiques());
    expect(result.current.couleur('jeton-inexistant')).toBe('currentColor');
  });
});
