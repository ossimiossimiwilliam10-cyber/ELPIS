import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Le journal doit parler quand ça va mal.
 *
 * Ce fichier taisait tout en production, erreurs comprises — au motif, écrit en
 * commentaire, qu'on ne gardait « que les erreurs critiques », ce que le code
 * ne faisait pas. Le prix s'est payé sur l'appareil : le rapport du jour
 * tombait sur une exception, l'écran d'accueil montrait un cursus vide, et rien
 * nulle part ne disait pourquoi. L'exception s'annonçait pourtant elle-même ;
 * c'est le journal qui l'avalait.
 *
 * `isDev` est figé au chargement du module : chaque test recharge donc `logger`
 * après avoir posé l'environnement voulu.
 */

async function chargerLogger({ dev }) {
  vi.resetModules();
  vi.stubEnv('DEV', dev);
  return (await import('./logger')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Le journal', () => {
  it('rapporte les erreurs en production', async () => {
    const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = await chargerLogger({ dev: false });

    logger.error('rapport du jour', new Error('object is not extensible'));

    expect(espion).toHaveBeenCalledOnce();
    expect(espion.mock.calls[0][0]).toBe('rapport du jour');
  });

  it('transmet l’erreur entière, pas un résumé', async () => {
    // Un message sans sa pile ne sert à rien : c'est la pile qui désigne le
    // module fautif.
    const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = await chargerLogger({ dev: false });
    const panne = new Error('MOTEUR_NON_BRANCHE');

    logger.error('calcul local', panne);

    expect(espion).toHaveBeenCalledWith('calcul local', panne);
  });

  it('se tait sur le reste en production', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = await chargerLogger({ dev: false });

    logger.log('trace');
    logger.warn('avertissement');
    logger.info('information');

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('parle de tout en développement', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = await chargerLogger({ dev: true });

    logger.log('trace');
    logger.warn('avertissement');
    logger.info('information');
    logger.error('panne');

    expect(log).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
