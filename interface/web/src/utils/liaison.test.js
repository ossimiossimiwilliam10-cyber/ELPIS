import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sonderLiaison, ETATS } from './liaison';

/**
 * La sonde de liaison.
 *
 * Une page web ne voit pas le câble USB : elle n'a aucun accès au bus. Elle
 * n'en a pas besoin, parce que la question utile n'est pas « le câble est-il
 * branché ? » mais « le moteur du PC répond-il ? ». Les deux coïncident dans le
 * montage retenu — la redirection USB n'existe que câble en place — et la
 * seconde question a l'avantage d'englober les deux autres pannes possibles :
 * serveur éteint, base fermée.
 *
 * Ces tests portent donc sur la seule chose qui compte : que chaque état soit
 * distingué des autres, et qu'aucun ne soit présenté comme joignable à tort.
 */

const reponse = (corps, { ok = true, status = 200 } = {}) => ({
  ok, status, json: async () => corps,
});

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('sonderLiaison', () => {
  it('reconnaît un moteur en marche, base ouverte', async () => {
    globalThis.fetch = vi.fn(async () => reponse({ status: 'ok', db: 'connected', version: '2.0.0' }));

    const r = await sonderLiaison();
    expect(r.etat).toBe(ETATS.JOIGNABLE);
    expect(r.versionMoteur).toBe('2.0.0');
    expect(r.raison).toBe('');
  });

  it('interroge bien le point de santé', async () => {
    const espion = vi.fn(async () => reponse({ status: 'ok', db: 'connected' }));
    globalThis.fetch = espion;

    await sonderLiaison();
    expect(espion.mock.calls[0][0]).toMatch(/\/health$/);
  });

  it('refuse de dire « joignable » quand la base n’est pas ouverte', async () => {
    // Le serveur répond, mais son moteur ne peut rien lire : synchroniser
    // maintenant ne produirait qu'une erreur plus loin.
    globalThis.fetch = vi.fn(async () => reponse({ status: 'ok', db: 'unavailable' }));

    const r = await sonderLiaison();
    expect(r.etat).toBe(ETATS.ABSENT);
    expect(r.raison).toMatch(/base/i);
  });

  it('traite une réponse en erreur comme une absence', async () => {
    globalThis.fetch = vi.fn(async () => reponse({}, { ok: false, status: 503 }));

    const r = await sonderLiaison();
    expect(r.etat).toBe(ETATS.ABSENT);
    expect(r.raison).toContain('503');
  });

  it('traite un serveur injoignable comme une absence, sans jeter', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

    const r = await sonderLiaison();
    expect(r.etat).toBe(ETATS.ABSENT);
    expect(r.raison).toBeTruthy();
  });

  it('distingue « pas d’adresse renseignée » d’un serveur absent', async () => {
    // Sur téléphone, sans adresse, il n'y a rien à joindre : le dire évite de
    // faire chercher un câble alors que c'est un réglage qui manque.
    globalThis.Capacitor = { isNativePlatform: () => true };
    globalThis.fetch = vi.fn();

    const r = await sonderLiaison();
    expect(r.etat).toBe(ETATS.NON_CONFIGURE);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    delete globalThis.Capacitor;
  });

  it('parle du câble sur téléphone, du serveur sur PC', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('coupé'); });

    const surPC = await sonderLiaison();
    expect(surPC.raison).not.toMatch(/câble/i);

    globalThis.Capacitor = { isNativePlatform: () => true };
    localStorage.setItem('serverIp', 'localhost');
    const surTelephone = await sonderLiaison();
    expect(surTelephone.raison).toMatch(/câble USB/i);

    delete globalThis.Capacitor;
  });
});
