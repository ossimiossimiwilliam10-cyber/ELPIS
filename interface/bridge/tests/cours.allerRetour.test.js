import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { saveCours, loadCours } from '../moteur/cours';
const { db } = require('../db/setup');

/**
 * Rien de ce que l'interface sait écrire ne doit disparaître à l'enregistrement.
 *
 * Deux champs se perdaient silencieusement, pour la même raison : la colonne
 * existait, la relecture la rendait, et la requête d'insertion l'omettait.
 *
 * - `cours_cm.ankiDeck` : le paquet Anki rattaché à un chapitre disparaissait au
 *   premier enregistrement. Or c'est lui qui débloque la validation d'un cours
 *   par une vraie épreuve plutôt que par auto-évaluation — ce que l'application
 *   propose pourtant explicitement.
 * - `exercices.nombreRevisionsEtapes` : sans ce compteur, `moyenneGlissante`
 *   recevait toujours zéro mesure et remplaçait la moyenne par la dernière
 *   valeur. L'estimation de durée d'une étape de TP ne convergeait jamais.
 *
 * Ce test ne vérifie pas un champ en particulier : il compare l'objet complet
 * avant et après, feuille par feuille. Tout champ ajouté à l'interface sans être
 * câblé côté serveur le fera échouer.
 */

const vider = () => db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');
beforeEach(vider);
afterAll(vider);

/** Un cursus portant chaque champ que le schéma sait stocker, valeurs distinctes. */
const cursusComplet = () => ({
  licences: [{
    nom: 'L2 Physique', archived: false,
    semestres: [{
      nom: 'Semestre 3', archived: false, dateFin: '2027-01-31',
      ues: [{
        nom: 'UE 1', ects: 12,
        matieres: [{
          nom: 'Mécanique 3', coefficient: 2, ects: 4,
          examDates: ['2026-12-17'], ankiDeckName: 'Physique::Méca',
          evaluations: [{ nom: 'DS1', note: 14, coefficient: 2, statut: null }],
          notebookLMLink: 'https://notebooklm.google.com/abc',
          cm_h: 10, td_h: 12, tp_h: 6,
          synergies: ['Mathématiques'],
          listeCM: [{
            titre: 'Chapitre 1', dateCM: '2026-09-08',
            derniereRevision: '2026-09-10', prochaineRevisionDate: '2026-09-17',
            jActuel: 7, tempsMoyen: 95, fichePdfPath: '/api/documents/fiche.pdf',
            pdfPath: '/api/documents/cm1.pdf',
            pdfPaths: ['/api/documents/cm1.pdf', '/api/documents/cm1b.pdf'],
            fsrsCard: { due: '2026-09-17', stability: 6.2, difficulty: 5.1, reps: 3, lapses: 1, state: 2 },
            rappels: ['2026-09-15'], easeFactor: 2.4, repetitions: 3,
            nombreRevisionsTemps: 4, ankiDeck: 'Physique::Méca::Ch1',
          }],
          listeTD: [{
            titre: 'TD 1', dernierePratique: '2026-09-12', datePrevue: '2026-09-20',
            nombrePratiques: 2, tempsMoyen: 22, pdfPath: '/api/documents/td1.pdf',
            pdfPaths: ['/api/documents/td1.pdf'], page: 12, difficulte: 'assez_difficile',
            difficulteInitiale: 'moyen', notes: 'Revoir le théorème de Kœnig',
            nombreRevisionsTemps: 2,
          }],
          listeTP: [{
            titre: 'TP 1', dateTP: '2026-10-05',
            tempsMoyenEtapes: [20, 30, 40], nombreRevisionsEtapes: [1, 1, 1],
            nombrePratiques: 1, notes: 'Apporter la blouse',
          }],
          listeAnnales: [{
            titre: 'Session 2025', dernierePratique: '2026-09-14',
            nombrePratiques: 1, derniereNote: 13.5, difficulte: 'moyen',
            tempsMoyen: 58, pdfPath: '/api/documents/annale.pdf',
          }],
        }],
      }],
    }],
  }],
});

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

describe('Aller-retour du cursus', () => {
  test('aucun champ ne se perd à l’enregistrement', () => {
    expect(saveCours(cursusComplet())).toBe(true);
    const avant = aplatir(cursusComplet());
    const apres = aplatir(loadCours());

    const perdus = Object.keys(avant).filter(c => !(c in apres));
    expect(perdus, `champs perdus : ${perdus.join(', ')}`).toEqual([]);
  });

  test('aucune valeur ne se déforme au passage', () => {
    expect(saveCours(cursusComplet())).toBe(true);
    const avant = aplatir(cursusComplet());
    const apres = aplatir(loadCours());

    const alteres = Object.entries(avant)
      .filter(([c, v]) => c in apres && apres[c] !== v)
      .map(([c, v]) => `${c} : ${v} → ${apres[c]}`);
    expect(alteres, `valeurs altérées : ${alteres.join(' | ')}`).toEqual([]);
  });

  test('survit à deux enregistrements successifs', () => {
    // Le cas réel : on enregistre, on recharge, on réenregistre. Un champ
    // perdu à la première passe disparaît définitivement à la seconde.
    expect(saveCours(cursusComplet())).toBe(true);
    const premier = loadCours();
    expect(saveCours(premier)).toBe(true);
    const second = loadCours();

    const a = aplatir(premier);
    const b = aplatir(second);
    const perdus = Object.keys(a).filter(c => !(c in b) || a[c] !== b[c]);
    expect(perdus, `divergences : ${perdus.slice(0, 5).join(', ')}`).toEqual([]);
  });
});

describe('Appariement lors d’un enregistrement', () => {
  /*
   * L'enregistrement fusionne le cursus entrant avec l'existant pour conserver
   * ce que l'interface ne renvoie pas — l'état FSRS, les temps mesurés. Cet
   * appariement se faisait par **position** : la matière n°2 du nouveau cursus
   * héritait des données de la matière n°2 de l'ancien, quel que soit son nom.
   *
   * Supprimer une matière faisait donc glisser notes et historique de révision
   * sur les suivantes, et en réordonner deux les échangeait. Un bulletin pouvait
   * attribuer des notes à la mauvaise matière sans que rien ne le signale.
   */
  const avec = (matieres) => ({
    licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', ects: 6, matieres }] }] }],
  });
  const matiere = (nom, extra = {}) => ({
    nom, coefficient: 1, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [], ...extra,
  });

  test('une matière neuve n’hérite pas des notes de celle qu’elle remplace', () => {
    expect(saveCours(avec([matiere('Mécanique', { evaluations: [{ note: 14, coefficient: 1 }] })]))).toBe(true);
    expect(saveCours(avec([matiere('Analyse')]))).toBe(true);

    const relue = loadCours().licences[0].semestres[0].ues[0].matieres[0];
    expect(relue.nom).toBe('Analyse');
    expect(relue.evaluations ?? []).toEqual([]);
  });

  test('réordonner deux matières n’échange pas leurs notes', () => {
    expect(saveCours(avec([
      matiere('Mécanique', { evaluations: [{ note: 18, coefficient: 1 }] }),
      matiere('Chimie', { evaluations: [{ note: 6, coefficient: 1 }] }),
    ]))).toBe(true);

    // Même contenu, ordre inversé : c'est le geste d'un glisser-déposer.
    expect(saveCours(avec([matiere('Chimie'), matiere('Mécanique')]))).toBe(true);

    const matieres = loadCours().licences[0].semestres[0].ues[0].matieres;
    const notes = Object.fromEntries(matieres.map(m => [m.nom, (m.evaluations || [])[0]?.note ?? null]));
    expect(notes['Mécanique']).toBe(18);
    expect(notes['Chimie']).toBe(6);
  });

  test('conserve l’état de révision d’un chapitre au fil des enregistrements', () => {
    // Le but même de la fusion : l'interface ne renvoie pas l'état FSRS.
    expect(saveCours(avec([matiere('Analyse', {
      listeCM: [{ titre: 'Ch1', jActuel: 12, repetitions: 4, derniereRevision: '2026-10-01' }],
    })]))).toBe(true);

    expect(saveCours(avec([matiere('Analyse', { listeCM: [{ titre: 'Ch1' }] })]))).toBe(true);

    const cm = loadCours().licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.jActuel).toBe(12);
    expect(cm.repetitions).toBe(4);
  });

  test('supprimer un chapitre ne décale pas l’historique des autres', () => {
    expect(saveCours(avec([matiere('Analyse', {
      listeCM: [
        { titre: 'Ch1', jActuel: 3 },
        { titre: 'Ch2', jActuel: 21 },
      ],
    })]))).toBe(true);

    expect(saveCours(avec([matiere('Analyse', { listeCM: [{ titre: 'Ch2' }] })]))).toBe(true);

    const cms = loadCours().licences[0].semestres[0].ues[0].matieres[0].listeCM;
    expect(cms).toHaveLength(1);
    expect(cms[0].titre).toBe('Ch2');
    expect(cms[0].jActuel).toBe(21);
  });
});
