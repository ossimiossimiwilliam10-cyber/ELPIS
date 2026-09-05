import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  COLLECTIONS,
  versionDe,
  incrementerVersion,
  toutesLesVersions,
  controleVersion,
} from '../moteur/versions';
import { db } from '../db/setup';

/** Requête minimale, telle que la voit le middleware. */
const requete = (methode, versionAnnoncee) => ({
  method: methode,
  get: (nom) => (nom.toLowerCase() === 'x-elpis-version' ? versionAnnoncee : undefined),
});

/** Réponse minimale, qui retient ce qu'on lui a demandé d'écrire. */
const reponse = () => {
  const etat = { entetes: {}, statut: null, corps: null };
  return {
    etat,
    set(nom, valeur) { etat.entetes[nom] = valeur; return this; },
    status(code) { etat.statut = code; return this; },
    json(corps) { etat.corps = corps; return this; },
  };
};

beforeEach(() => {
  db.exec('DELETE FROM versions');
});

describe('Compteur de version', () => {
  test('une collection jamais écrite est à zéro', () => {
    expect(versionDe('config')).toBe(0);
  });

  test('chaque écriture fait avancer le compteur', () => {
    expect(incrementerVersion('config')).toBe(1);
    expect(incrementerVersion('config')).toBe(2);
    expect(versionDe('config')).toBe(2);
  });

  test('les collections avancent indépendamment', () => {
    incrementerVersion('config');
    incrementerVersion('config');
    incrementerVersion('cours');

    expect(versionDe('config')).toBe(2);
    expect(versionDe('cours')).toBe(1);
    expect(versionDe('historique')).toBe(0);
  });

  test('le relevé porte sur toutes les collections suivies', () => {
    incrementerVersion('historique');
    const versions = toutesLesVersions();

    expect(Object.keys(versions).sort()).toEqual([...COLLECTIONS].sort());
    expect(versions.historique).toBe(1);
    expect(versions.projets).toBe(0);
  });

  test('la version survit à la lecture d’une collection inconnue', () => {
    expect(versionDe('inexistante')).toBe(0);
  });
});

describe('Contrôle de version', () => {
  test('la lecture annonce la version courante', () => {
    incrementerVersion('config');
    incrementerVersion('config');

    const res = reponse();
    const suivant = vi.fn();
    controleVersion('config', () => ({}))(requete('GET'), res, suivant);

    expect(res.etat.entetes['X-Elpis-Version']).toBe('2');
    expect(suivant).toHaveBeenCalled();
  });

  test('une écriture fondée sur la version courante passe', () => {
    incrementerVersion('config');

    const suivant = vi.fn();
    controleVersion('config', () => ({}))(requete('POST', '1'), reponse(), suivant);

    expect(suivant).toHaveBeenCalled();
  });

  test('une écriture fondée sur une version périmée est refusée', () => {
    // Le scénario visé : le téléphone a lu la version 1, le PC a écrit
    // entre-temps, le téléphone écrirait par-dessus sans le savoir.
    incrementerVersion('config');
    incrementerVersion('config');

    const res = reponse();
    const suivant = vi.fn();
    controleVersion('config', () => ({ marqueur: 'état courant' }))(requete('POST', '1'), res, suivant);

    expect(suivant).not.toHaveBeenCalled();
    expect(res.etat.statut).toBe(409);
    expect(res.etat.corps).toMatchObject({
      conflitDeVersion: true,
      collection: 'config',
      versionAttendue: 2,
      versionAnnoncee: 1,
    });
  });

  test('le refus porte l’état courant, pour refusionner sans requête de plus', () => {
    incrementerVersion('cours');
    const res = reponse();
    controleVersion('cours', () => ({ licences: ['L1'] }))(requete('POST', '0'), res, vi.fn());

    expect(res.etat.corps.etat).toEqual({ licences: ['L1'] });
  });

  test('une écriture en avance sur le serveur est refusée aussi', () => {
    // Un client qui annonce une version que le serveur n'a jamais atteinte
    // s'appuie sur un état inventé : le refus vaut mieux que l'écrasement.
    const res = reponse();
    controleVersion('projets', () => [])(requete('POST', '42'), res, vi.fn());
    expect(res.etat.statut).toBe(409);
  });

  test('une écriture sans version annoncée est acceptée', () => {
    // Le navigateur du PC écrit ainsi depuis toujours : refuser casserait
    // l'application existante pour parer une course impossible à un appareil.
    incrementerVersion('config');

    const suivant = vi.fn();
    controleVersion('config', () => ({}))(requete('POST', undefined), reponse(), suivant);
    expect(suivant).toHaveBeenCalled();

    const suivantVide = vi.fn();
    controleVersion('config', () => ({}))(requete('POST', ''), reponse(), suivantVide);
    expect(suivantVide).toHaveBeenCalled();
  });

  test('l’en-tête de version est exposé au client d’une autre origine', () => {
    // Sans cela, l'application Android lit une version vide et écrit à
    // l'aveugle : le garde-fou existerait sans jamais servir.
    const res = reponse();
    controleVersion('config', () => ({}))(requete('GET'), res, vi.fn());
    expect(res.etat.entetes['Access-Control-Expose-Headers']).toContain('X-Elpis-Version');
  });

  test('un chargeur d’état absent ne fait pas tomber le refus', () => {
    incrementerVersion('config');
    const res = reponse();
    controleVersion('config', null)(requete('POST', '0'), res, vi.fn());

    expect(res.etat.statut).toBe(409);
    expect(res.etat.corps.etat).toBeUndefined();
  });
});
