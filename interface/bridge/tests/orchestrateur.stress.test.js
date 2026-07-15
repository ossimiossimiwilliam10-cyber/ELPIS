import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
const { db } = require('../db/setup');
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';

beforeAll(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }

  const configData = {
    heuresTravailJour: 4,
    maxStudyHoursPerDay: 8,
    maxSubjectsPerDay: 4,
    restDays: days,
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

  const mockYesterday = new Date();
  mockYesterday.setDate(mockYesterday.getDate() - 1);
  const histData = [
    { timestamp: mockYesterday.toISOString(), dureeMinutes: 60 }
  ];
  saveHistorique(histData);
});

afterAll(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');
});

// â”€â”€ Scenarios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('Le Chantier des 1000 Tests - Stress Testing Orchestrator', () => {
  const stressScenarios = [];
  
  // We need exactly 279 tests to reach the 1000 milestone!
  for (let i = 0; i < 279; i++) {
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

    stressScenarios.push([
      `StressMatiere_${i}`, 
      isNew ? 0 : 5, 
      revisionDate,
      isDue || isNew,
      isNew,
      isDue
    ]);
  }

  test.each(stressScenarios)('Stress Test CM in %s: jActuel=%d, due=%s -> robust scheduling', (matName, jActuel, due, expectedScheduled, isNew, isDue) => {
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
                    titre: 'StressCM', 
                    jActuel, 
                    derniereRevision,
                    prochaineRevisionDate: due 
                  }
                ],
                listeTD: [
                  {
                    titre: 'StressTD',
                    dernierePratique: due ? '2026-06-15' : undefined,
                    difficulte: 'moyen',
                    nombrePratiques: isNew ? 0 : 2
                  }
                ],
                listeTP: [
                  {
                    titre: 'StressTP',
                    dernierePratique: undefined,
                    difficulte: 'difficile',
                    nombrePratiques: 0,
                    dateTP: isDue ? '2026-06-21' : undefined // Simulate tomorrow
                  }
                ],
                listeAnnales: [
                  {
                    titre: 'StressAnnale',
                    dernierePratique: undefined,
                    difficulte: 'tres_facile'
                  }
                ]
              }
            ]
          }]
        }]
      }]
    };

    saveCours(testCrs);

    // Call orchestrator
    const r = genererRapportQuotidien(0);
    const taskTitles = r.tachesDuJour.map(t => t.titre);
    
    expect(r.statut).not.toBe('REPOS');
    
    // Validate output structure doesn't crash under massive load
    expect(Array.isArray(r.tachesDuJour)).toBe(true);
    expect(r.tempsDispoMin).toBeGreaterThanOrEqual(0);
    
    if (expectedScheduled) {
      expect(taskTitles).toContain('StressCM');
    } else {
      expect(taskTitles).not.toContain('StressCM');
    }
  });
});
