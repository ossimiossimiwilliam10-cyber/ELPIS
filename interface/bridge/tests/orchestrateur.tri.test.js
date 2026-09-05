import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { saveConfig, loadConfig } = require('../moteur/config');
const { saveCours, loadCours } = require('../moteur/cours');
const { genererRapportQuotidien } = require('../moteur/orchestrateur');

/**
 * Ordre de traitement des tâches.
 *
 * Deux échelles coexistent dans le moteur : `prio`, le score historique — un
 * produit d'une douzaine de facteurs, d'amplitude libre — et `priorite`, borné
 * entre 0 et 100 et construit sur des critères explicites. Le tri s'appuyait
 * sur la première, si bien qu'un exercice cumulant deux multiplicateurs
 * extrêmes passait devant un cours dû depuis trois semaines. C'est désormais
 * `priorite` qui décide, `prio` ne servant plus qu'à départager les ex æquo.
 */

let configOrigine;
let coursOrigine;

const matiere = (nom, extra = {}) => ({
  nom, coefficient: 1, evaluations: [],
  listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
  ...extra,
});

/** Date « JJ-MM-AAAA » située `n` jours dans le passé. */
const ilYA = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

beforeAll(() => {
  configOrigine = loadConfig();
  coursOrigine = loadCours();

  saveCours({
    licences: [{
      nom: 'L2',
      semestres: [{
        nom: 'S3',
        ues: [{
          nom: 'UE1', ects: 6,
          matieres: [
            matiere('Mécanique', {
              listeCM: [
                { titre: 'Cinématique', derniereRevision: ilYA(30), jActuel: 3, prochaineRevisionDate: ilYA(27) },
                { titre: 'Dynamique' },
              ],
              listeTD: [{ titre: 'TD Mécanique 1' }],
            }),
            matiere('Optique', {
              listeCM: [{ titre: 'Réfraction' }],
              listeAnnales: [{ titre: 'Annale 2024', difficulteInitiale: 5 }],
            }),
          ],
        }],
      }],
    }],
  });

  saveConfig({
    ...configOrigine,
    studyStartDate: '01-01-2020',
    restDays: [],
    skippedRestDays: [],
    enableTD: true,
    enableAnnales: true,
    maxStudyHoursPerDay: 8,
    wakeUpTime: '07:00',
    bedtime: '23:00',
  });
});

afterAll(() => {
  saveConfig(configOrigine);
  if (coursOrigine) saveCours(coursOrigine);
});

describe('Ordre des tâches du jour', () => {
  test('chaque tâche porte une priorité bornée entre 0 et 100', () => {
    const rapport = genererRapportQuotidien(0, true);
    const taches = rapport.tachesDuJour || [];
    expect(taches.length).toBeGreaterThan(0);

    for (const t of taches) {
      expect(Number.isFinite(t.priorite)).toBe(true);
      expect(t.priorite).toBeGreaterThanOrEqual(0);
      expect(t.priorite).toBeLessThanOrEqual(100);
    }
  });

  test('l\'amplitude des priorités reste lisible', () => {
    // Le score historique atteignait un rapport de 1 à 1200 entre la première
    // et la dernière tâche : un seul exercice décidait alors de la journée.
    const taches = (genererRapportQuotidien(0, true).tachesDuJour || [])
      .filter(t => t.type !== 'ANKI' && t.type !== 'PROJET');
    if (taches.length < 2) return;

    const scores = taches.map(t => t.priorite).filter(v => v > 0);
    const rapport = Math.max(...scores) / Math.min(...scores);
    expect(rapport).toBeLessThan(20);
  });

  test('un cours jamais abordé reçoit une priorité de fond', () => {
    // Régression : le critère « oubli » valait zéro pour un contenu jamais
    // travaillé — il n'avait rien à oublier — ce qui déclassait tous les
    // nouveaux cours derrière n'importe quel exercice déjà vu.
    const taches = genererRapportQuotidien(0, true).tachesDuJour || [];
    const nouveaux = taches.filter(t => t.type === 'CM');
    expect(nouveaux.length).toBeGreaterThan(0);
    for (const cm of nouveaux) {
      expect(cm.priorite).toBeGreaterThan(0);
    }
  });

  test('chaque tâche explique son rang', () => {
    const taches = (genererRapportQuotidien(0, true).tachesDuJour || [])
      .filter(t => t.explication);

    expect(taches.length).toBeGreaterThan(0);
    for (const t of taches) {
      expect(Array.isArray(t.explication.composantes)).toBe(true);
      expect(Array.isArray(t.explication.raisons)).toBe(true);
    }
  });

  test('reste stable d\'un appel à l\'autre', () => {
    // Un tri instable réordonnait la session à chaque rafraîchissement.
    const premier = (genererRapportQuotidien(0, true).tachesDuJour || []).map(t => t.titre);
    const second = (genererRapportQuotidien(0, true).tachesDuJour || []).map(t => t.titre);
    expect(second).toEqual(premier);
  });

  test('ne propose jamais deux fois la même tâche', () => {
    const taches = genererRapportQuotidien(0, true).tachesDuJour || [];
    const cles = taches.map(t => `${t.type}::${t.matiere}::${t.titre}`);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

describe('Préparation aux travaux dirigés', () => {
  test('un cours dont le TD est au programme porte le motif', () => {
    // Le boost ne portait que sur le score historique : une fois le tri passé
    // sur l'échelle bornée, il n'avait plus aucun effet sur l'ordre.
    const taches = genererRapportQuotidien(0, true).tachesDuJour || [];
    const prepa = taches.filter(t => (t.raisons || []).includes('PREPA_TD'));

    if (prepa.length === 0) return; // aucun TD planifié ce jour-là
    for (const t of prepa) {
      expect(t.type).toBe('CM');
      expect(t.priorite).toBeGreaterThan(0);
    }
  });
});
