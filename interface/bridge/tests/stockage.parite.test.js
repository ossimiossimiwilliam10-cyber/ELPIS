import { describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { definirSource, sourceCourante, sourceExterne } from '../moteur/stockage';
import { loadConfig, saveConfig } from '../moteur/config';
import { loadCours, saveCours } from '../moteur/cours';
import { loadHistorique, saveHistorique } from '../moteur/historique';
import { loadProjets, saveProjets } from '../moteur/projets';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import { getTodayString } from '../moteur/intelligence';
const { db } = require('../db/setup');

/**
 * Un moteur, deux stockages, un seul résultat.
 *
 * Le moteur tourne désormais aux deux bouts : sur le PC au-dessus de SQLite, et
 * sur le téléphone au-dessus de la copie RxDB. La tentation était d'en écrire
 * une seconde version, plus simple, côté téléphone — et c'est exactement ce
 * qu'il ne fallait pas faire. Deux moteurs finissent toujours par diverger, et
 * la divergence ne se voit pas : elle produit deux chiffres plausibles qui ne
 * s'accordent pas, sans que rien ne signale lequel est faux.
 *
 * Il n'y a donc qu'un moteur et un registre de source. Ces tests sont la preuve
 * que le registre ne change rien : mêmes données en entrée, même rapport en
 * sortie, quel que soit le stockage. Tant qu'ils passent, ce qu'affiche le
 * téléphone est ce qu'affiche le PC.
 */

const AUJOURDHUI = getTodayString();
const formater = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dans = (n) => {
  const [a, m, j] = AUJOURDHUI.split('-').map(Number);
  const d = new Date(a, m - 1, j, 12, 0, 0);
  d.setDate(d.getDate() + n);
  return formater(d);
};
const ilYA = (n) => dans(-n);

const vider = () => db.exec(
  'DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config; DELETE FROM projets;'
);

/** Cursus d'essai : de quoi produire un vrai programme, pas une page vide. */
const CURSUS = {
  licences: [{
    nom: 'L2 Physique',
    semestres: [{
      nom: 'Semestre 3', dateFin: dans(120),
      ues: [{
        nom: 'UE 1', ects: 12,
        matieres: [
          {
            nom: 'Mécanique 3', coefficient: 2, cm_h: 24, td_h: 18, tp_h: 0,
            evaluations: [{ nom: 'Contrôle 1', coefficient: 1, note: 12, type: 'AC', date: dans(20), statut: 'present', dureeMinutes: 60 }],
            listeCM: [
              { titre: 'Ch1', jActuel: 7, derniereRevision: ilYA(10), prochaineRevisionDate: ilYA(3) },
              { titre: 'Ch2', jActuel: 0 },
              { titre: 'Ch3', jActuel: 3, derniereRevision: ilYA(9), prochaineRevisionDate: ilYA(6) },
            ],
            listeTD: [{ titre: 'TD1', nombrePratiques: 1, difficulte: 'moyen' }],
            listeTP: [], listeAnnales: [],
          },
          {
            nom: 'Électronique', coefficient: 2, cm_h: 20, td_h: 20,
            evaluations: [{ nom: 'CC', coefficient: 1, note: 7, type: 'AC', date: dans(9), statut: 'present', dureeMinutes: 30 }],
            listeCM: [{ titre: 'Élec 1', jActuel: 5, derniereRevision: ilYA(8), prochaineRevisionDate: ilYA(3) }],
            listeTD: [{ titre: 'TD Élec', nombrePratiques: 0, difficulte: 'difficile' }],
            listeTP: [], listeAnnales: [],
          },
        ],
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

const HISTORIQUE = [
  { id: 'h1', type: 'CM', titre: 'Ch1', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 30, timestamp: new Date(`${ilYA(2)}T10:00:00`).toISOString() },
  { id: 'h2', type: 'TD', titre: 'TD1', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 45, timestamp: new Date(`${ilYA(3)}T10:00:00`).toISOString() },
];

const PROJETS = [{ id: 'p1', titre: 'Portfolio', dateFin: dans(60), phases: [{ id: 'f1', nom: 'Maquette', complete: true }] }];

/**
 * Source en mémoire, à l'image de celle du téléphone.
 *
 * Le téléphone ne reconstruit pas le cursus depuis des tables : il détient le
 * document déjà assemblé, transporté par la synchronisation. Cette source imite
 * exactement cela — des documents entiers, rendus tels quels.
 */
function sourceEnMemoire(etat) {
  const copie = (o) => JSON.parse(JSON.stringify(o));
  return {
    lireConfig: () => copie(etat.config),
    ecrireConfig: (c) => { etat.config = copie(c); },
    lireCours: () => copie(etat.cours),
    ecrireCours: (c) => { etat.cours = copie(c); },
    lireHistorique: () => copie(etat.historique),
    ecrireHistorique: (h) => { etat.historique = copie(h); },
    lireProjets: () => copie(etat.projets),
    ecrireProjets: (p) => { etat.projets = copie(p); },
  };
}

/** Ce qui doit coïncider entre les deux stockages, et rien d'autre. */
function empreinte(rapport) {
  return {
    statut: rapport.statut,
    tempsRequisMin: rapport.tempsRequisMin,
    tempsDispoMin: rapport.tempsDispoMin,
    nbEnSouffrance: rapport.nbEnSouffrance ?? null,
    taches: (rapport.tachesDuJour || []).map(t => ({
      type: t.type, titre: t.titre, matiere: t.matiere,
      dureeMinutes: t.dureeMinutes, priorite: t.priorite,
      raisons: t.explication?.raisons || [],
    })),
  };
}

beforeEach(() => {
  definirSource(null);
  vider();
});

afterEach(() => definirSource(null));
afterAll(() => { definirSource(null); vider(); });

describe('Le registre de source', () => {
  test('laisse le chemin SQLite par défaut', () => {
    expect(sourceCourante()).toBeNull();
    expect(sourceExterne()).toBe(false);
  });

  test('refuse une source incomplète plutôt que d’écrire dans le vide', () => {
    // Une source à moitié gréée ferait lire les bonnes données et écrire nulle
    // part : le travail de la journée disparaîtrait sans un message.
    expect(() => definirSource({ lireConfig: () => ({}) })).toThrow(/incomplète/i);
    expect(sourceCourante()).toBeNull();
  });

  test('se débranche proprement', () => {
    definirSource(sourceEnMemoire({ config: {}, cours: { licences: [] }, historique: [], projets: [] }));
    expect(sourceExterne()).toBe(true);
    definirSource(null);
    expect(sourceExterne()).toBe(false);
  });
});

describe('Parité entre SQLite et une source externe', () => {
  test('le même cursus produit le même rapport des deux côtés', () => {
    // 1. Le PC : on écrit en base, on calcule.
    saveConfig(CONFIG);
    saveCours(CURSUS);
    saveHistorique(HISTORIQUE);
    saveProjets(PROJETS);

    const cotePC = empreinte(genererRapportQuotidien(0, false));

    // 2. On relève ce que la base a effectivement produit : c'est ce document-là
    //    que la synchronisation transporte, pas les fixtures d'origine.
    const etat = {
      config: loadConfig(),
      cours: loadCours(),
      historique: loadHistorique(),
      projets: loadProjets(),
    };

    // 3. Le téléphone : mêmes documents, stockage différent, base vidée pour
    //    être certain qu'aucune lecture ne retombe sur SQLite par mégarde.
    vider();
    definirSource(sourceEnMemoire(etat));

    const coteTelephone = empreinte(genererRapportQuotidien(0, false));

    expect(coteTelephone).toEqual(cotePC);
    // Et le rapport n'est pas vide : comparer deux pages blanches ne prouve rien.
    expect(cotePC.taches.length).toBeGreaterThan(0);
  });

  test('les quatre lectures rendent les mêmes documents', () => {
    saveConfig(CONFIG);
    saveCours(CURSUS);
    saveHistorique(HISTORIQUE);
    saveProjets(PROJETS);

    const attendu = {
      config: loadConfig(),
      cours: loadCours(),
      historique: loadHistorique(),
      projets: loadProjets(),
    };

    vider();
    definirSource(sourceEnMemoire(JSON.parse(JSON.stringify(attendu))));

    expect(loadConfig()).toEqual(attendu.config);
    expect(loadCours()).toEqual(attendu.cours);
    expect(loadHistorique()).toEqual(attendu.historique);
    expect(loadProjets()).toEqual(attendu.projets);
  });

  test('l’écriture passe par la source, jamais par la base', () => {
    const etat = { config: {}, cours: { licences: [] }, historique: [], projets: [] };
    definirSource(sourceEnMemoire(etat));

    saveConfig({ maxSubjectsPerDay: 4 });
    saveCours(CURSUS);
    saveHistorique(HISTORIQUE);
    saveProjets(PROJETS);

    expect(etat.config.maxSubjectsPerDay).toBe(4);
    expect(etat.cours.licences).toHaveLength(1);
    expect(etat.historique).toHaveLength(2);
    expect(etat.projets).toHaveLength(1);

    // La base n'a pas été touchée : c'est ce qui permet au téléphone de
    // fonctionner sans SQLite du tout.
    expect(db.prepare('SELECT COUNT(*) c FROM historique').get().c).toBe(0);
    expect(db.prepare('SELECT COUNT(*) c FROM licences').get().c).toBe(0);
  });

  test('la configuration est normalisée des deux côtés', () => {
    // Le document du téléphone peut être plus ancien que le schéma courant.
    // Sans la même normalisation qu'en SQLite, les deux appareils calculeraient
    // sur des valeurs différentes — la divergence par la petite porte.
    definirSource(sourceEnMemoire({
      config: { maxStudyHoursPerDay: 99, targetGrade: 18 },
      cours: { licences: [] }, historique: [], projets: [],
    }));

    const c = loadConfig();
    expect(c.maxStudyHoursPerDay).toBe(24);          // borné, comme en SQLite
    expect(c).not.toHaveProperty('targetGrade');     // clé retirée, comme en SQLite
    expect(c.defaultDurationNewCM).toBe(120);        // valeur par défaut appliquée
  });

  test('un document tronqué ne passe pas pour un cursus réel', () => {
    definirSource(sourceEnMemoire({ config: {}, cours: { licences: 'cassé' }, historique: 'cassé', projets: 42 }));

    expect(loadCours()).toEqual({ licences: [] });
    expect(loadHistorique()).toEqual([]);
    expect(loadProjets()).toEqual([]);
  });
});
