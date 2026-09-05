import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculerRapportLocal } from './rapportLocal';
import { brancherMoteurLocal, debrancherMoteurLocal, sourceLocale } from './sourceLocale';
import useStore from '../store';

/**
 * Le moteur tourne sur l'appareil.
 *
 * Jusqu'ici le téléphone demandait son programme du jour au PC : PC éteint, ou
 * câble débranché, et l'écran d'accueil restait vide — la limite la plus gênante
 * pour une application qu'on consulte entre deux cours.
 *
 * Le moteur embarqué est le même que celui du PC, aux mêmes fichiers ; seule la
 * source de données diffère. La parité des deux est prouvée côté moteur
 * (`interface/bridge/tests/stockage.parite.test.js`). Ce fichier-ci vérifie
 * l'autre moitié : que le branchement tient, qu'il refuse de calculer sans
 * source plutôt que d'inventer, et qu'il annonce ce qu'il ne peut pas savoir.
 */

const AUJOURDHUI = new Date();
const formater = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ilYA = (n) => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - n);
  return formater(d);
};
const dans = (n) => ilYA(-n);

const CURSUS = {
  licences: [{
    nom: 'L2 Physique',
    semestres: [{
      nom: 'Semestre 3', dateFin: dans(120),
      ues: [{
        nom: 'UE 1', ects: 12,
        matieres: [{
          nom: 'Mécanique 3', coefficient: 2,
          evaluations: [],
          listeCM: [
            { titre: 'Ch1', jActuel: 5, derniereRevision: ilYA(9), prochaineRevisionDate: ilYA(4) },
            { titre: 'Ch2', jActuel: 0 },
          ],
          listeTD: [], listeTP: [], listeAnnales: [],
        }],
      }],
    }],
  }],
};

const CONFIG = {
  maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 3,
  bedtime: '23:00', wakeUpTime: '07:00',
  restDays: [], skippedRestDays: [], studyStartDate: ilYA(30),
  fixedCommitments: [], langues: [], absences: [],
};

/** Le store est la projection synchrone de RxDB : on l'imite. */
function garnirStore({ config = CONFIG, cours = CURSUS, historique = [], projets = [] } = {}) {
  useStore.setState({ config, coursConfig: cours, historique, projets });
}

beforeEach(() => {
  debrancherMoteurLocal();
  garnirStore();
});

afterEach(() => {
  debrancherMoteurLocal();
  vi.restoreAllMocks();
});

describe('Le moteur embarqué', () => {
  it('refuse de calculer tant qu’il n’est pas branché', () => {
    // Sans source, il chercherait SQLite — absent du téléphone. Un rapport
    // bâti sur rien serait pire qu'un refus.
    const r = calculerRapportLocal();
    expect(r.error).toBe('MOTEUR_NON_BRANCHE');
    expect(r.tachesDuJour).toBeUndefined();
  });

  it('produit un vrai programme une fois branché', () => {
    brancherMoteurLocal();
    const r = calculerRapportLocal();

    expect(r.error).toBeUndefined();
    expect(r.calculeLocalement).toBe(true);
    expect(Array.isArray(r.tachesDuJour)).toBe(true);
    expect(r.statut).toBeTruthy();
  });

  it('lit les documents de l’appareil, pas ceux d’ailleurs', () => {
    brancherMoteurLocal();
    expect(sourceLocale.lireCours().licences[0].nom).toBe('L2 Physique');

    garnirStore({ cours: { licences: [{ nom: 'Autre licence', semestres: [] }] } });
    expect(sourceLocale.lireCours().licences[0].nom).toBe('Autre licence');
  });

  it('annonce qu’il n’a pas pu consulter Anki', () => {
    // AnkiConnect écoute sur le PC. Taire cette limite laisserait croire que la
    // routine de cartes a été prise en compte dans le programme.
    brancherMoteurLocal();
    expect(calculerRapportLocal().ankiIndisponible).toBe(true);
  });

  it('rend une erreur nommée plutôt que de laisser remonter une exception', () => {
    brancherMoteurLocal();
    // Un document impossible : le moteur ne doit pas faire tomber l'application.
    useStore.setState({ coursConfig: { licences: [{ semestres: [{ ues: [{ matieres: null }] }] }] } });

    const r = calculerRapportLocal();
    expect(r).toBeTypeOf('object');
    if (r.error) expect(typeof r.error).toBe('string');
  });

  it('ne se branche qu’une fois', () => {
    brancherMoteurLocal();
    const premier = calculerRapportLocal();
    brancherMoteurLocal();
    const second = calculerRapportLocal();
    expect(second.error).toBeUndefined();
    expect(premier.error).toBeUndefined();
  });

  it('travaille sur des copies, jamais sur l’état gelé du store', () => {
    /*
     * Le premier essai sur l'appareil est tombé sur exactement cela. Le store
     * est gelé par Immer, et l'orchestrateur annote les matières qu'il parcourt
     * pour retrouver leur UE. L'écriture échouait — « Cannot add property
     * _ueMatieres, object is not extensible » — et l'écran d'accueil affichait
     * un cursus vide, indiscernable d'un cursus réellement absent.
     */
    const gele = { licences: Object.freeze([Object.freeze({ nom: 'Figée', semestres: [] })]) };
    Object.freeze(gele);
    useStore.setState({ coursConfig: gele });

    const lu = sourceLocale.lireCours();
    expect(lu).toEqual(gele);
    expect(Object.isFrozen(lu)).toBe(false);
    expect(() => { lu.licences[0]._marque = 1; }).not.toThrow();
    // Et la copie ne contamine pas le store.
    expect(useStore.getState().coursConfig.licences[0]._marque).toBeUndefined();
  });

  it('produit un rapport même quand le store est gelé', () => {
    brancherMoteurLocal();
    const fige = JSON.parse(JSON.stringify(CURSUS));
    const geler = (o) => {
      if (o && typeof o === 'object') { Object.values(o).forEach(geler); Object.freeze(o); }
      return o;
    };
    useStore.setState({ coursConfig: geler(fige) });

    const r = calculerRapportLocal();
    expect(r.error).toBeUndefined();
    expect(r.statut).toBeTruthy();
  });

  it('un cursus vide donne un programme vide, pas une panne', () => {
    brancherMoteurLocal();
    garnirStore({ cours: { licences: [] } });

    const r = calculerRapportLocal();
    expect(r.error).toBeUndefined();
    expect(r.tachesDuJour || []).toHaveLength(0);
  });
});
