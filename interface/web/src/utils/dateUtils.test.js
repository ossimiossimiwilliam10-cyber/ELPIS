import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTodayStr, toLogicalDateStr, isFromToday, dateCalendaire } from './dateUtils';

afterEach(() => {
  vi.useRealTimers();
});

/** Fige l'horloge locale à la date/heure donnée. */
const freeze = (iso) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};

describe('getTodayStr — période de grâce Night Owl', () => {
  it('rend la date du jour en pleine journée', () => {
    freeze('2026-09-07T14:00:00');
    expect(getTodayStr()).toBe('2026-09-07');
  });

  it('rattache le travail de 2h du matin à la veille', () => {
    freeze('2026-09-08T02:00:00');
    expect(getTodayStr()).toBe('2026-09-07');
  });

  it('bascule au nouveau jour à partir de 4h', () => {
    freeze('2026-09-08T04:30:00');
    expect(getTodayStr()).toBe('2026-09-08');
  });
});

describe('toLogicalDateStr', () => {
  it('convertit un horodatage en jour logique', () => {
    expect(toLogicalDateStr('2026-09-07T14:00:00')).toBe('2026-09-07');
  });

  it('applique la même grâce de 4h qu\'au jour courant', () => {
    expect(toLogicalDateStr('2026-09-08T01:30:00')).toBe('2026-09-07');
  });

  it('renvoie null sur une entrée absente ou invalide', () => {
    expect(toLogicalDateStr(null)).toBeNull();
    expect(toLogicalDateStr('')).toBeNull();
    expect(toLogicalDateStr('pas une date')).toBeNull();
  });
});

describe('isFromToday', () => {
  it('reconnaît une session enregistrée le jour même', () => {
    freeze('2026-09-07T20:00:00');
    expect(isFromToday({ timestamp: '2026-09-07T09:15:00' })).toBe(true);
  });

  it('écarte une session de la veille', () => {
    freeze('2026-09-07T20:00:00');
    expect(isFromToday({ timestamp: '2026-09-06T09:15:00' })).toBe(false);
  });

  it('écarte une entrée sans horodatage', () => {
    // Régression : le code filtrait sur `h.date`, un champ que l'historique ne porte
    // pas — le temps travaillé du jour affichait donc toujours 0h.
    freeze('2026-09-07T20:00:00');
    expect(isFromToday({})).toBe(false);
    expect(isFromToday({ date: '2026-09-07' })).toBe(false);
  });
});

describe('dateCalendaire', () => {
  /*
   * Le Planning Annuel affichait « Invalid Date » sur ses sept en-têtes de jour.
   * La conversion découpait sur les tirets en supposant un `AAAA-MM-JJ` nu,
   * quand le simulateur renvoie des instants complets : le troisième morceau
   * valait `23T22:00:00.000Z`, donc NaN. Le repli ne rattrapait rien, puisque
   * `toLocaleDateString` rend la chaîne « Invalid Date », qui est vraie.
   */
  it('lit une date nue', () => {
    const d = dateCalendaire('2026-08-23');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(23);
  });

  it('lit un instant complet, comme en renvoie le simulateur', () => {
    const d = dateCalendaire('2026-08-23T22:00:00.000Z');
    expect(d).not.toBeNull();
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getDate()).toBe(23);
  });

  it('se place à midi pour survivre aux décalages horaires', () => {
    // À minuit, un fuseau négatif ferait basculer l'affichage sur la veille.
    expect(dateCalendaire('2026-08-23').getHours()).toBe(12);
  });

  it('rend null plutôt qu’une date invalide', () => {
    expect(dateCalendaire('')).toBeNull();
    expect(dateCalendaire(null)).toBeNull();
    expect(dateCalendaire(undefined)).toBeNull();
    expect(dateCalendaire('pas une date')).toBeNull();
    expect(dateCalendaire('2026-08')).toBeNull();
  });

  it('accepte une Date déjà construite', () => {
    const d = new Date(2026, 7, 23);
    expect(dateCalendaire(d)).toBe(d);
    expect(dateCalendaire(new Date('nawak'))).toBeNull();
  });
});
