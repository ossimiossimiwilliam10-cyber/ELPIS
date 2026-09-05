import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';
const { db } = require('../db/setup');

/**
 * Le statut du jour doit dire quelque chose.
 *
 * Deux définitions ont échoué avant celle-ci. La première sommait tout le
 * catalogue de cours éligibles : avec 78 cours dont la moitié jamais ouverts,
 * le total dépassait forcément une journée. La seconde, restreinte aux
 * révisions dues, restait rouge elle aussi — mesuré sur le cursus réel, ce
 * stock ne descend jamais sous 23 h et grossit à mesure que du contenu entre en
 * circulation. Un voyant allumé 58 jours sur 58 n'apprend rien.
 *
 * On mesure donc le retard relatif : les révisions pour lesquelles on a laissé
 * filer plus du double du délai prévu. Contrairement à un stock, cet ensemble
 * se vide quand on le traite.
 */

const MIDI = new Date('2026-09-16T08:00:00');
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(MIDI);

const jourISO = (d) => d.toISOString().split('T')[0];
const ilYA = (n) => { const d = new Date(MIDI); d.setDate(d.getDate() - n); return jourISO(d); };
const dans = (n) => { const d = new Date(MIDI); d.setDate(d.getDate() + n); return jourISO(d); };

const vider = () => db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');
afterAll(() => { vider(); vi.useRealTimers(); });

/** Chapitre revu, dont la prochaine échéance tombe dans `dansNJours`. */
const cm = (titre, intervalle, echeanceDans) => ({
  titre, jActuel: intervalle,
  derniereRevision: ilYA(intervalle - echeanceDans),
  prochaineRevisionDate: echeanceDans >= 0 ? dans(echeanceDans) : ilYA(-echeanceDans),
});

const cursusAvec = (listeCM, extra = {}) => ({
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [{ nom: 'UE1', ects: 6, matieres: [{ nom: 'Analyse', coefficient: 3, listeCM, listeTD: [], listeTP: [], listeAnnales: [], ...extra }] }],
    }],
  }],
});

beforeEach(() => {
  vider();
  const repos = [];
  for (let i = 0; i < 5; i++) repos.push(ilYA(i + 3));
  saveConfig({
    heuresTravailJour: 5, maxStudyHoursPerDay: 5, maxSubjectsPerDay: 4, restDays: repos,
    bedtime: '23:00', maxNewCMPerSubjectPerDay: 5, maxNewCMPerSemesterPerDay: 3,
    defaultDurationNewCM: 120, defaultDurationRevCM: 30, defaultDurationTD: 20,
    defaultDurationTP: 30, defaultDurationAnnales: 60, defaultDurationAnki: 30,
  });
  saveHistorique([{ timestamp: new Date(MIDI.getTime() - 864e5).toISOString(), dureeMinutes: 60 }]);
});

describe('Statut du jour', () => {
  test('reste vert quand les révisions arrivent simplement à échéance', () => {
    // Beaucoup de révisions dues, aucune en retard : c'est une journée normale,
    // pas une alerte. C'est exactement le cas que les deux définitions
    // précédentes peignaient en rouge.
    const chapitres = Array.from({ length: 30 }, (_, i) => cm(`Ch${i}`, 7, 0));
    saveCours(cursusAvec(chapitres));

    const r = genererRapportQuotidien(0, false);
    expect(r.tempsDuAujourdhuiMin).toBeGreaterThan(r.tempsDispoMin);
    expect(r.nbEnSouffrance).toBe(0);
    expect(r.statut).toBe('OK');
  });

  test('passe au rouge quand le retard dépasse largement les intervalles', () => {
    // Trente chapitres à intervalle 7, oubliés depuis 40 jours : plus de cinq
    // fois le délai prévu. Là, il y a bien quelque chose à signaler.
    const chapitres = Array.from({ length: 30 }, (_, i) => cm(`Ch${i}`, 7, -40));
    saveCours(cursusAvec(chapitres));

    const r = genererRapportQuotidien(0, false);
    expect(r.nbEnSouffrance).toBeGreaterThan(0);
    expect(r.retardMaxJours).toBeGreaterThanOrEqual(40);
    expect(r.statut).toBe('SURCHARGE');
  });

  test('ne compte pas un chapitre jamais ouvert comme du retard', () => {
    // Un cours à venir n'est pas une dette : on choisit quand l'aborder.
    saveCours(cursusAvec([
      { titre: 'Neuf 1', jActuel: 0 }, { titre: 'Neuf 2', jActuel: 0 }, { titre: 'Neuf 3', jActuel: 0 },
    ]));

    const r = genererRapportQuotidien(0, false);
    expect(r.nbEnSouffrance).toBe(0);
    expect(r.statut).toBe('OK');
  });

  test('un léger dépassement ne suffit pas à déclencher l’alerte', () => {
    // Deux jours de retard sur un intervalle de sept : on rattrape, sans drame.
    const chapitres = Array.from({ length: 20 }, (_, i) => cm(`Ch${i}`, 7, -2));
    saveCours(cursusAvec(chapitres));

    const r = genererRapportQuotidien(0, false);
    expect(r.nbEnSouffrance).toBe(0);
    expect(r.statut).toBe('OK');
  });
});

describe('Reprise garantie', () => {
  test('programme le chapitre le plus délaissé, même noyé dans le programme', () => {
    /*
     * Le classement défavorise structurellement un chapitre abandonné : un TD
     * jamais fait cumule les points d'oubli et de couverture, quand un chapitre
     * travaillé six fois puis délaissé ne récolte que les premiers. Sans reprise
     * garantie, quatre matières sur treize ne recevaient pas une séance en deux
     * mois sur le cursus réel.
     */
    const chapitres = [
      ...Array.from({ length: 12 }, (_, i) => cm(`Récent ${i}`, 3, 0)),
      cm('Le grand oublié', 5, -90),
    ];
    saveCours(cursusAvec(chapitres));

    const r = genererRapportQuotidien(0, false);
    const titres = (r.tachesDuJour || []).map(t => t.titre);
    expect(titres).toContain('Le grand oublié');
  });

  test('la reprise ne fait pas déborder la journée', () => {
    // Une journée qui dépasse la capacité déclarée n'est plus une journée tenable.
    const chapitres = [
      ...Array.from({ length: 40 }, (_, i) => cm(`Récent ${i}`, 3, 0)),
      cm('Le grand oublié', 5, -90),
    ];
    saveCours(cursusAvec(chapitres));

    const r = genererRapportQuotidien(0, false);
    expect(r.tempsRequisMin).toBeLessThanOrEqual(r.tempsDispoMin);
  });

  test('ne force rien quand rien ne traîne', () => {
    saveCours(cursusAvec(Array.from({ length: 6 }, (_, i) => cm(`Ch${i}`, 7, 0))));
    const r = genererRapportQuotidien(0, false);
    const reprises = (r.tachesDuJour || []).filter(t => (t.raisons || []).includes('RATTRAPAGE'));
    expect(reprises).toHaveLength(0);
  });
});

describe('Routine Anki', () => {
  test('ne propose rien tant qu’aucun paquet n’est rattaché', () => {
    /*
     * Au premier lancement, avec un cursus encore structuré mais vide, la
     * routine Anki était la seule tâche de la journée — et elle ne menait nulle
     * part, aucune matière n'ayant de paquet. Le jour de la rentrée est le pire
     * moment pour donner à une application l'air de tourner à vide.
     */
    saveCours(cursusAvec([]));
    const r = genererRapportQuotidien(0, false);
    const anki = (r.tachesDuJour || []).filter(t => t.type === 'ANKI');
    expect(anki).toHaveLength(0);
  });

  test('la propose dès qu’une matière a son paquet', () => {
    saveCours(cursusAvec([], { ankiDeckName: 'Physique::Mécanique' }));
    const r = genererRapportQuotidien(0, false);
    const anki = (r.tachesDuJour || []).filter(t => t.type === 'ANKI');
    expect(anki).toHaveLength(1);
  });

  test('la propose aussi si le paquet est rattaché à un chapitre', () => {
    saveCours(cursusAvec([{ titre: 'Ch1', jActuel: 0, ankiDeck: 'Physique::Ch1' }]));
    const r = genererRapportQuotidien(0, false);
    expect((r.tachesDuJour || []).filter(t => t.type === 'ANKI')).toHaveLength(1);
  });
});
