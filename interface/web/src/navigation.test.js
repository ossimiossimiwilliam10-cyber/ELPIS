import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, TAB_IDS, DEFAULT_TAB, getTabLabel } from './navigation';
import { ROUTES } from './routes';

describe('Cohérence menu ↔ routage', () => {
  it('chaque entrée de menu correspond à une page rendue', () => {
    // Sans cette garantie, cliquer sur un onglet afficherait un écran vide.
    const orphelins = TAB_IDS.filter(id => !ROUTES[id]);
    expect(orphelins).toEqual([]);
  });

  it('chaque page déclarée est atteignable depuis le menu', () => {
    const inaccessibles = Object.keys(ROUTES).filter(id => !TAB_IDS.includes(id));
    expect(inaccessibles).toEqual([]);
  });

  it('l\'onglet par défaut existe', () => {
    expect(TAB_IDS).toContain(DEFAULT_TAB);
    expect(ROUTES[DEFAULT_TAB]).toBeDefined();
  });

  it('les identifiants d\'onglets sont uniques', () => {
    expect(new Set(TAB_IDS).size).toBe(TAB_IDS.length);
  });

  it('chaque onglet porte un libellé lisible', () => {
    for (const id of TAB_IDS) {
      expect(getTabLabel(id), `libellé manquant pour ${id}`).toBeTruthy();
    }
    expect(getTabLabel('inconnu')).toBeNull();
  });

  it('les groupes de menu sont nommés et non vides', () => {
    for (const group of NAV_GROUPS) {
      expect(group.title).toBeTruthy();
      expect(group.tabs.length).toBeGreaterThan(0);
    }
  });
});
