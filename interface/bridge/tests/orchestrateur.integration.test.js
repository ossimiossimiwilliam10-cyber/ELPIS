import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
const { db } = require('../db/setup');
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';

// Horloge figée : le planning dépend du temps restant avant le coucher et des fenêtres
// de chronotype. Sans cela, la suite passe le matin et échoue le soir.
// Seul Date est simulé, pour ne pas perturber les I/O de better-sqlite3.
const CLOCK = new Date('2026-09-16T08:00:00');
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(CLOCK);

beforeAll(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');

  // Create a config that will NOT trigger burnout or rest
  // Repos anciens uniquement : un repos daté d'hier ferait basculer le rapport en
  // REPOS_OPTIONNEL et viderait le planning, ce que ces tests ne cherchent pas à mesurer.
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i + 3));
    days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }

  const configData = {
    heuresTravailJour: 4,
    maxStudyHoursPerDay: 8,
    maxSubjectsPerDay: 4,
    restDays: days, // Recent rest days prevent burnout
    bedtime: '23:00',
    maxNewCMPerSubjectPerDay: 5,
    maxNewCMPerSemesterPerDay: 50,
    defaultDurationNewCM: 120,
    defaultDurationRevCM: 30,
    defaultDurationTD: 20,
    defaultDurationTP: 30,
    defaultDurationAnnales: 60,
    defaultDurationAnki: 30,
  };
  saveConfig(configData);

  // Create a recent history to prevent "30 days without rest" fallback
  const mockYesterday = new Date();
  mockYesterday.setDate(mockYesterday.getDate() - 1);
  const histData = [
    { timestamp: mockYesterday.toISOString(), dureeMinutes: 60 }
  ];
  saveHistorique(histData);
});

afterAll(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');
  vi.useRealTimers();
});

// â”€â”€ Scenarios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('Orchestrator Deep Integration with FSRS Logic', () => {
  const deepScenarios = [];
  
  for (let i = 0; i < 50; i++) {
    const isDue = i % 2 === 0;
    const isNew = i % 3 === 0;
    
    let revisionDate;
    if (isNew) {
      revisionDate = null;
    } else {
      const d = new Date();
      d.setDate(d.getDate() + (isDue ? -1 : 2)); 
      revisionDate = d.toISOString().split('T')[0];
    }

    deepScenarios.push([
      `Matiere_${i}`, 
      isNew ? 0 : 5, 
      revisionDate,
      isDue || isNew
    ]);
  }

  test.each(deepScenarios)('Integration CM in %s: jActuel=%d, due=%s -> expected scheduled: %s', (matName, jActuel, due, expectedScheduled) => {
    
    // Si c'est pas un nouveau CM (due !== null), on doit fournir une derniereRevision
    // sinon l'orchestrateur le considÃ¨re comme un "Nouveau CM"
    const derniereRevision = due ? '2026-06-15' : undefined;

    const testCrs = {
      licences: [{
        nom: 'L1',
        semestres: [{
          nom: 'S1',
          ues: [{
            nom: 'U1',
            matieres: [
              {
                nom: matName,
                coefficient: 3,
                listeCM: [
                  { 
                    titre: 'CM1', 
                    jActuel, 
                    derniereRevision,
                    prochaineRevisionDate: due 
                  }
                ]
              }
            ]
          }]
        }]
      }]
    };

    saveCours(testCrs);

    const r = genererRapportQuotidien(0);
    const taskTitles = r.tachesDuJour.map(t => t.titre);
    
    // Burnout should NOT be active
    expect(r.statut).not.toBe('REPOS');
    
    if (expectedScheduled) {
      if (!taskTitles.includes('CM1')) {
        throw new Error(`Failed for ${matName}, jActuel: ${jActuel}, due: ${due}\nReport: ${JSON.stringify(r)}`);
      }
      expect(taskTitles).toContain('CM1');
    } else {
      expect(taskTitles).not.toContain('CM1');
    }
  });
});
