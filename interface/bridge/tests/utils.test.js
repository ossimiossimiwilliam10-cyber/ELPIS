import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeDateStr, parseDateLocal } = require('../moteur/utils');

describe('normalizeDateStr', () => {
  test('conserve une date déjà au format ISO', () => {
    expect(normalizeDateStr('2026-09-07')).toBe('2026-09-07');
  });

  test('complète les mois et jours sur deux chiffres', () => {
    expect(normalizeDateStr('2026-9-7')).toBe('2026-09-07');
  });

  test('bascule le format jour-mois-année vers ISO', () => {
    // La configuration stocke `studyStartDate` sous la forme « 07-09-2026 ».
    expect(normalizeDateStr('07-09-2026')).toBe('2026-09-07');
    expect(normalizeDateStr('7-9-2026')).toBe('2026-09-07');
  });

  test('renvoie null pour une valeur inexploitable', () => {
    expect(normalizeDateStr('')).toBeNull();
    expect(normalizeDateStr(null)).toBeNull();
    expect(normalizeDateStr('2026/09/07')).toBeNull();
    expect(normalizeDateStr('2026-09')).toBeNull();
  });
});

describe('parseDateLocal', () => {
  const composantes = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

  test('lit une date ISO dans le fuseau local', () => {
    // `new Date('2026-09-07')` serait interprété en UTC et pourrait reculer
    // d'un jour selon le fuseau : toute la planification s'en trouverait décalée.
    expect(composantes(parseDateLocal('2026-09-07'))).toEqual([2026, 9, 7]);
  });

  test('ignore la partie horaire d\'un horodatage', () => {
    expect(composantes(parseDateLocal('2026-09-07T23:45:00'))).toEqual([2026, 9, 7]);
  });

  test('lit le format hérité jour-mois-année', () => {
    expect(composantes(parseDateLocal('07-09-2026'))).toEqual([2026, 9, 7]);
  });

  test('place la date à minuit', () => {
    const d = parseDateLocal('2026-09-07T18:30:00');
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  test('renvoie une date invalide plutôt que de deviner', () => {
    expect(Number.isNaN(parseDateLocal('').getTime())).toBe(true);
    expect(Number.isNaN(parseDateLocal(null).getTime())).toBe(true);
    expect(Number.isNaN(parseDateLocal('pas une date').getTime())).toBe(true);
    expect(Number.isNaN(parseDateLocal(20260907).getTime())).toBe(true);
  });

  test('tolère les espaces autour', () => {
    expect(composantes(parseDateLocal('  2026-09-07  '))).toEqual([2026, 9, 7]);
  });

  test('traverse un changement d\'heure sans décalage', () => {
    // Fin octobre, passage à l'heure d'hiver en Europe.
    expect(composantes(parseDateLocal('2026-10-25'))).toEqual([2026, 10, 25]);
    expect(composantes(parseDateLocal('2026-03-29'))).toEqual([2026, 3, 29]);
  });
});
