import { describe, it, expect } from 'vitest';
import { buildTaskKey, isSameTask } from './taskKey';

describe('buildTaskKey', () => {
  it('produit la même clé que l\'orchestrateur (type::matiere::titre)', () => {
    expect(buildTaskKey({ type: 'CM', matiere: 'Algèbre', titre: 'CM1' }))
      .toBe('cm::algèbre::cm1');
  });

  it('normalise la casse et les espaces superflus', () => {
    expect(buildTaskKey({ type: ' cm ', matiere: 'ALGÈBRE', titre: '  CM1  ' }))
      .toBe('cm::algèbre::cm1');
  });

  it('tolère les champs manquants sans lever', () => {
    expect(buildTaskKey({})).toBe('::::');
    expect(buildTaskKey(null)).toBe('::::');
  });

  it('distingue deux cours homonymes de matières différentes', () => {
    const a = buildTaskKey({ type: 'CM', matiere: 'Algèbre', titre: 'CM1' });
    const b = buildTaskKey({ type: 'CM', matiere: 'Analyse', titre: 'CM1' });
    expect(a).not.toBe(b);
  });
});

describe('isSameTask', () => {
  it('compare les identifiants quand ils existent', () => {
    expect(isSameTask({ id: 'cm::x::y' }, { id: 'cm::x::y' })).toBe(true);
    expect(isSameTask({ id: 'cm::x::y' }, { id: 'cm::x::z' })).toBe(false);
  });

  it('retombe sur la clé composite en l\'absence d\'identifiant', () => {
    const a = { type: 'CM', matiere: 'Algèbre', titre: 'CM1' };
    const b = { type: 'CM', matiere: 'Algèbre', titre: 'CM1' };
    expect(isSameTask(a, b)).toBe(true);
  });

  it('ne confond pas deux CM homonymes de matières différentes', () => {
    // Régression : le filtre `t.titre !== tache.titre` retirait les deux à la fois.
    const algebre = { type: 'CM', matiere: 'Algèbre', titre: 'CM1' };
    const analyse = { type: 'CM', matiere: 'Analyse', titre: 'CM1' };
    expect(isSameTask(algebre, analyse)).toBe(false);
  });

  it('ne considère pas deux tâches sans identifiant comme identiques par défaut', () => {
    expect(isSameTask(null, { id: 'a' })).toBe(false);
    expect(isSameTask({ id: 'a' }, null)).toBe(false);
  });
});
