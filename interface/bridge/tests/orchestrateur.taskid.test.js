/**
 * Non-régression : chaque tâche du planning doit porter un identifiant stable.
 *
 * Sans cet identifiant, l'interface ne peut ni retirer la bonne tâche après validation,
 * ni écarter ce qui a déjà été fait, ni conserver l'ordre du glisser-déposer — trois
 * fonctionnalités qui échouaient silencieusement.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { genererRapportQuotidien, buildTaskId } from '../moteur/orchestrateur';
const { db } = require('../db/setup');
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';

// Horloge figée : le planning dépend de l'heure (budget avant le coucher, chronotype).
const CLOCK = new Date('2026-09-16T08:00:00');
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(CLOCK);

const wipe = () => db.exec(
  'DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; ' +
  'DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;'
);

beforeAll(() => {
  wipe();

  saveConfig({
    studyStartDate: '01-01-2020',
    maxStudyHoursPerDay: 10,
    maxSubjectsPerDay: 5,
    bedtime: '23:59',
    restDays: [],
    skippedRestDays: [],
    maxNewCMPerSubjectPerDay: 5,
    maxNewCMPerSemesterPerDay: 50,
    defaultDurationNewCM: 60,
  });

  // Un peu de travail hier : évite la bascule en repos optionnel.
  const hier = new Date(CLOCK);
  hier.setDate(hier.getDate() - 1);
  saveHistorique([{ type: 'CM', matiere: 'Physique', titre: 'x', timestamp: hier.toISOString(), dureeMinutes: 60 }]);

  saveCours({
    licences: [{
      nom: 'L1',
      semestres: [{
        nom: 'S1',
        ues: [{
          nom: 'U1',
          matieres: [
            { nom: 'Physique', coefficient: 3, listeCM: [{ titre: 'CM_NEUF', jActuel: 0 }] },
            // Homonyme dans une autre matière : le piège que corrige l'identifiant.
            { nom: 'Chimie', coefficient: 3, listeCM: [{ titre: 'CM_NEUF', jActuel: 0 }] },
          ],
        }],
      }],
    }],
  });
});

afterAll(() => {
  wipe();
  vi.useRealTimers();
});

describe('Identifiant de tâche', () => {
  test('buildTaskId normalise casse et espaces', () => {
    expect(buildTaskId({ type: 'CM', matiere: '  Physique ', titre: 'CM_NEUF' }))
      .toBe('cm::physique::cm_neuf');
    expect(buildTaskId({})).toBe('::::');
  });

  test('chaque tâche du planning porte un id non vide', () => {
    const r = genererRapportQuotidien(0);
    expect(r.tachesDuJour.length).toBeGreaterThan(0);
    for (const t of r.tachesDuJour) {
      expect(t.id, `tâche sans id : ${t.titre}`).toBeTruthy();
      expect(t.id).toBe(buildTaskId(t));
    }
  });

  test('deux CM homonymes dans des matières différentes ont des ids distincts', () => {
    const r = genererRapportQuotidien(0);
    const homonymes = r.tachesDuJour.filter(t => t.titre === 'CM_NEUF');
    expect(homonymes.length).toBe(2);
    expect(homonymes[0].id).not.toBe(homonymes[1].id);
  });

  test("l'id est stable d'une génération à l'autre", () => {
    const ids1 = genererRapportQuotidien(0).tachesDuJour.map(t => t.id).sort();
    const ids2 = genererRapportQuotidien(0).tachesDuJour.map(t => t.id).sort();
    expect(ids1).toEqual(ids2);
  });
});
