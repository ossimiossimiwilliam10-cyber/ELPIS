import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import * as fs from 'fs';
import * as path from 'path';

// ── No Mocks! Real Files! ──────────────────────────────────────────────────

const tempDir = path.join(__dirname, 'temp_test_data');
const tempConfigPath = path.join(tempDir, 'espoir_config.json');
const tempHistPath = path.join(tempDir, 'espoir_historique.json');
const tempCrsPath = path.join(tempDir, 'espoir_cours.json');

beforeAll(() => {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Create a config that will NOT trigger burnout or rest
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
  fs.writeFileSync(tempConfigPath, JSON.stringify(configData));

  // Create a recent history to prevent "30 days without rest" fallback
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
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
});

// ── Scenarios ──────────────────────────────────────────────────────────────
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
    // sinon l'orchestrateur le considère comme un "Nouveau CM"
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

    fs.writeFileSync(tempCrsPath, JSON.stringify(testCrs));

    const r = genererRapportQuotidien(tempConfigPath, tempCrsPath);
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
