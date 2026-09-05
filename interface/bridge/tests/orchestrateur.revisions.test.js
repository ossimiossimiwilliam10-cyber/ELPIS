import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';
const { db } = require('../db/setup');

/**
 * Le matériau neuf ne doit pas affamer les révisions dues.
 *
 * Un chapitre jamais ouvert reçoit d'office le retard maximal, donc la priorité
 * plafond, en permanence ; une révision due n'atteint ce plafond qu'après dix
 * jours de retard. À quoi s'ajoutait le coût : 120 minutes pour un CM neuf
 * contre 30 pour une révision. Le neuf gagnait la priorité et mangeait le temps.
 *
 * Sur le cursus réel de juillet, la conséquence était mesurable : 15 CM neufs
 * programmés sur sept jours et pas une seule révision, alors que le rapport
 * annonçait chaque jour 25 heures de révisions dues. Ce qui explique le fait
 * relevé lors de l'évaluation — zéro CM révisé en quatorze jours d'usage réel.
 */

const MIDI = new Date('2026-09-16T08:00:00');
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(MIDI);

const jourISO = (d) => d.toISOString().split('T')[0];
const ilYA = (jours) => { const d = new Date(MIDI); d.setDate(d.getDate() - jours); return jourISO(d); };

const vider = () => db.exec(
  'DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;'
);

/** Chapitre jamais ouvert : ni intervalle, ni dernière révision. */
const cmNeuf = (titre) => ({ titre, jActuel: 0, derniereRevision: null });

/** Chapitre vu il y a `retard + intervalle` jours : sa révision est due. */
const cmARéviser = (titre, intervalle = 2, retard = 3) =>
  ({ titre, jActuel: intervalle, derniereRevision: ilYA(intervalle + retard) });

const cursusAvec = (listeCM) => ({
  licences: [{
    nom: 'Licence Test',
    semestres: [{
      nom: 'Semestre 3',
      ues: [{
        nom: 'UE1', ects: 6,
        matieres: [{
          nom: 'Analyse', coefficient: 3,
          listeCM, listeTD: [], listeTP: [], listeAnnales: [],
        }],
      }],
    }],
  }],
});

beforeEach(() => {
  vider();
  // Des repos anciens évitent le repli anti-burnout, qui viderait le planning.
  const repos = [];
  for (let i = 0; i < 5; i++) repos.push(ilYA(i + 3));
  saveConfig({
    heuresTravailJour: 4, maxStudyHoursPerDay: 8, maxSubjectsPerDay: 4, restDays: repos,
    bedtime: '23:00', maxNewCMPerSubjectPerDay: 20, maxNewCMPerSemesterPerDay: 20,
    defaultDurationNewCM: 120, defaultDurationRevCM: 30, defaultDurationTD: 20,
    defaultDurationTP: 30, defaultDurationAnnales: 60, defaultDurationAnki: 30,
  });
  saveHistorique([{ timestamp: new Date(MIDI.getTime() - 864e5).toISOString(), dureeMinutes: 60 }]);
});

afterAll(() => { vider(); vi.useRealTimers(); });

const planDuJour = () => {
  const r = genererRapportQuotidien(0, false);
  const taches = (r.tachesDuJour || []).filter(t => t.type === 'CM');
  return {
    dispoMin: r.tempsDispoMin,
    neufs: taches.filter(t => t.isNew),
    revisions: taches.filter(t => !t.isNew),
  };
};

describe('Budget de révisions', () => {
  test('programme des révisions dues même quand des chapitres restent à découvrir', () => {
    saveCours(cursusAvec([
      cmNeuf('Chapitre 1'), cmNeuf('Chapitre 2'), cmNeuf('Chapitre 3'), cmNeuf('Chapitre 4'),
      cmARéviser('Chapitre A'), cmARéviser('Chapitre B'), cmARéviser('Chapitre C'), cmARéviser('Chapitre D'),
    ]));
    const plan = planDuJour();
    expect(plan.revisions.length).toBeGreaterThan(0);
    expect(plan.neufs.length).toBeGreaterThan(0); // la découverte ne s'arrête pas
  });

  test('le matériau neuf ne dépasse pas la moitié de la journée face à un arriéré', () => {
    // Douze révisions dues, soit 360 minutes : plus que le plafond de réserve.
    // C'est alors le plafond qui s'applique, et le neuf est ramené à la moitié.
    const arriere = Array.from({ length: 12 }, (_, i) => cmARéviser(`Révision ${i + 1}`));
    saveCours(cursusAvec([
      cmNeuf('Chapitre 1'), cmNeuf('Chapitre 2'), cmNeuf('Chapitre 3'), cmNeuf('Chapitre 4'), cmNeuf('Chapitre 5'),
      ...arriere,
    ]));
    const plan = planDuJour();
    const minutesNeuves = plan.neufs.reduce((acc, t) => acc + t.dureeMinutes, 0);
    expect(minutesNeuves).toBeLessThanOrEqual(plan.dispoMin * 0.5);
  });

  test('sans révision due, le neuf dispose de la journée entière', () => {
    // La réserve ne prélève que ce dont les révisions ont besoin : aucune due,
    // aucune minute confisquée.
    saveCours(cursusAvec([cmNeuf('Chapitre 1'), cmNeuf('Chapitre 2'), cmNeuf('Chapitre 3'), cmNeuf('Chapitre 4')]));
    const plan = planDuJour();
    const minutesNeuves = plan.neufs.reduce((acc, t) => acc + t.dureeMinutes, 0);
    expect(plan.revisions.length).toBe(0);
    expect(minutesNeuves).toBeGreaterThan(plan.dispoMin * 0.5);
  });

  test('une petite dette de révision ne bride pas la découverte', () => {
    // Une seule révision de 30 minutes ne doit pas coûter la moitié de la journée.
    saveCours(cursusAvec([
      cmNeuf('Chapitre 1'), cmNeuf('Chapitre 2'), cmNeuf('Chapitre 3'), cmNeuf('Chapitre 4'),
      cmARéviser('Chapitre A'),
    ]));
    const plan = planDuJour();
    const minutesNeuves = plan.neufs.reduce((acc, t) => acc + t.dureeMinutes, 0);
    expect(plan.revisions.length).toBe(1);
    expect(minutesNeuves).toBeGreaterThan(plan.dispoMin * 0.5);
  });
});
