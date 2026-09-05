import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { saveConfig, loadConfig } from '../moteur/config';
import { saveHistorique, loadHistorique } from '../moteur/historique';
import { saveProjets, loadProjets } from '../moteur/projets';
const { db } = require('../db/setup');

/**
 * Rien de ce que l'interface produit ne doit se perdre à l'enregistrement.
 *
 * Le même audit sur le cursus avait révélé deux champs silencieusement écartés.
 * Étendu aux trois autres chemins de persistance, il a trouvé bien pire : la
 * table des projets datait d'un modèle abandonné — elle attendait `nom`,
 * `status` et `progress` quand la page produit `titre`, `dateFin` et une liste
 * de `phases`. L'insertion échouait sur la contrainte NOT NULL de `nom`, la
 * route renvoyait une erreur, et aucun projet ne pouvait exister.
 *
 * Ces tests comparent l'objet complet avant et après, feuille par feuille.
 */

const vider = () => db.exec('DELETE FROM config; DELETE FROM historique; DELETE FROM projets;');
beforeEach(vider);
afterAll(vider);

/** Chemins des feuilles d'un objet, avec leur valeur sérialisée. */
function aplatir(valeur, prefixe = '') {
  const sortie = {};
  for (const [cle, v] of Object.entries(valeur || {})) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(sortie, aplatir(v, chemin));
    } else if (Array.isArray(v) && v.some(x => x && typeof x === 'object')) {
      v.forEach((x, i) => Object.assign(sortie, aplatir(x, `${chemin}[${i}]`)));
    } else {
      sortie[chemin] = JSON.stringify(v);
    }
  }
  return sortie;
}

/** Compare deux objets et rend les divergences, lisibles dans le message d'échec. */
function divergences(attendu, obtenu) {
  const a = aplatir(attendu);
  const b = aplatir(obtenu);
  return Object.entries(a)
    .filter(([c, v]) => !(c in b) || b[c] !== v)
    .map(([c, v]) => `${c} : ${v} → ${c in b ? b[c] : 'ABSENT'}`);
}

describe('Configuration', () => {
  const configComplete = () => ({
    studyStartDate: '07-09-2026', userStartDate: '2026-09-07',
    bedtime: '23:30', wakeUpTime: '06:45',
    maxStudyHoursPerDay: 5,
    maxSubjectsPerDay: 4, capaciteQuotidienneH: 5,
    inscriptionPedagogiqueDone: true, theme: 'light',
    currentStreak: 4, bestStreak: 11, dernierePratiqueAnki: '2026-08-28',
    enableTD: false, enableAnnales: true, maxLanguesParJour: 2,
    restDays: ['2026-09-13', '2026-09-20'], skippedRestDays: ['2026-09-06'],
    fixedCommitments: [{ day: 'Lundi', start: '08:00', end: '10:00', label: 'CM Méca', matiereLinked: 'Mécanique 3' }],
    langues: [{
      id: 'esp', nom: 'Espagnol', categorie: 1, heuresAcquises: 120, cadence: 3,
      lienGrammaire: 'https://gemini.google.com/app/x', livre: 'Bescherelle',
      dernieresPratiques: { vocabulaire: '2026-08-27', grammaire: '2026-08-25', conversation: '2026-08-26' },
    }],
    absences: [{ id: 'a1', matiere: 'Optique 2', date: '2026-10-12', justifiee: true, motif: 'Maladie' }],
    stages: [{ id: 's1', titre: 'Stage labo', debut: '2027-05-01', fin: '2027-06-15', interrompu: false, memoireRendu: false }],
    mesVideos: [{ id: 'v1', titre: 'Cours de thermo', url: 'https://youtu.be/abc', matiere: 'Thermodynamique' }],
  });

  test('conserve chaque réglage, langue, absence et stage', () => {
    expect(saveConfig(configComplete())).toBe(true);
    expect(divergences(configComplete(), loadConfig())).toEqual([]);
  });

  test('permet de vider une liste', () => {
    // L'enregistrement fusionne avec l'existant : une liste vidée doit tout de
    // même le rester, faute de quoi une langue supprimée reviendrait seule.
    saveConfig(configComplete());
    saveConfig({ ...configComplete(), langues: [], absences: [] });
    const relu = loadConfig();
    expect(relu.langues).toEqual([]);
    expect(relu.absences).toEqual([]);
  });
});

describe('Historique', () => {
  const entrees = () => ([
    { id: 'h1', type: 'CM', titre: 'Chapitre 1', matiere: 'Mécanique 3', action: 'Révisé (3/4)', timestamp: '2026-08-28T09:00:00.000Z', dureeMinutes: 45.5 },
    { id: 'h2', type: 'TD', titre: 'TD 2', matiere: 'Algèbre', action: 'Terminé (moyen)', timestamp: '2026-08-28T14:00:00.000Z', dureeMinutes: 20 },
    { id: 'h3', type: 'ANNALE', titre: 'Session 2025', matiere: 'Optique 2', action: 'Terminé (Note: 14/20)', timestamp: '2026-08-29T10:00:00.000Z', dureeMinutes: 60 },
  ]);

  test('conserve chaque séance à l’identique', () => {
    saveHistorique(entrees());
    expect(divergences({ h: entrees() }, { h: loadHistorique() })).toEqual([]);
  });

  test('préserve une durée nulle au lieu de la perdre', () => {
    /*
     * `||` convertissait 0 en null, que le moteur de charge relit ensuite comme
     * 30 minutes par défaut : une séance mesurée à zéro devenait une demi-heure
     * de travail dans les statistiques.
     */
    saveHistorique([{ id: 'h0', type: 'CM', titre: 'Interrompu', matiere: 'X', action: 'Terminé', timestamp: '2026-08-29T08:00:00.000Z', dureeMinutes: 0 }]);
    expect(loadHistorique()[0].dureeMinutes).toBe(0);
  });
});

describe('Projets', () => {
  const projet = () => ({
    id: 'p1', titre: 'Site portfolio', dateFin: '2026-12-20',
    phases: [
      { id: 'ph1', nom: 'Maquette', complete: true },
      { id: 'ph2', nom: 'Intégration', complete: false },
    ],
  });

  test('enregistre un projet tel que la page le produit', () => {
    // Avant correction : `NOT NULL constraint failed: projets.nom`, donc aucun
    // projet ne pouvait être enregistré.
    expect(saveProjets([projet()])).toBe(true);
    const relu = loadProjets()[0];
    expect(relu.titre).toBe('Site portfolio');
    expect(relu.dateFin).toBe('2026-12-20');
    expect(relu.phases).toHaveLength(2);
    expect(relu.phases[1].nom).toBe('Intégration');
  });

  test('conserve un projet sans phase ni échéance', () => {
    expect(saveProjets([{ id: 'p2', titre: 'Idée en vrac' }])).toBe(true);
    const relu = loadProjets()[0];
    expect(relu.titre).toBe('Idée en vrac');
    expect(relu.phases).toEqual([]);
    expect(relu.dateFin).toBeNull();
  });

  test('relit encore les projets écrits à l’ancien format', () => {
    // Les lignes existantes portent `nom` et `deadline` : elles doivent rester
    // lisibles après le changement de vocabulaire.
    db.prepare('INSERT INTO projets (id, nom, deadline) VALUES (?, ?, ?)').run('vieux', 'Ancien projet', '2026-11-01');
    const relu = loadProjets().find(p => p.id === 'vieux');
    expect(relu.titre).toBe('Ancien projet');
    expect(relu.dateFin).toBe('2026-11-01');
  });
});
