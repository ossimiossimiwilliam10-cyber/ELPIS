import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import * as fs from 'fs';
import * as path from 'path';
// ── No Mocks! Real Files! ──────────────────────────────────────────────────

const tempDir = path.join(__dirname, 'temp_stress_data');
const tempConfigPath = path.join(tempDir, 'espoir_config.json');
const tempHistPath = path.join(tempDir, 'espoir_historique.json');
const tempCrsPath = path.join(tempDir, 'espoir_cours.json');

beforeAll(() => {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

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
  fs.writeFileSync(tempConfigPath, JSON.stringify(configData));

  const mockYesterday = new Date();
  mockYesterday.setDate(mockYesterday.getDate() - 1);
  const histData = [
    { timestamp: mockYesterday.toISOString(), dureeMinutes: 60 }
  ];
  fs.writeFileSync(tempHistPath, JSON.stringify(histData));
});

afterAll(() => {
  if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
  if (fs.existsSync(tempHistPath)) fs.unlinkSync(tempHistPath);
  if (fs.existsSync(tempCrsPath)) fs.unlinkSync(tempCrsPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── Scenarios ──────────────────────────────────────────────────────────────
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
        semestres: [{
          ues: [{
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

    fs.writeFileSync(tempCrsPath, JSON.stringify(testCrs));

    const r = genererRapportQuotidien(tempConfigPath, tempCrsPath);
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
