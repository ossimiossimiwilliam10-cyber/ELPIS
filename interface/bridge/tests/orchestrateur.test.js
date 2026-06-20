import { describe, test, expect, vi } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false)
}));

import * as fs from 'fs';
vi.mock('../moteur/config', () => ({
  loadConfig: () => ({
    heuresTravailJour: 2,
    maxStudyHoursPerDay: 8,
    maxSubjectsPerDay: 4,
    restDays: [new Date().toISOString().split('T')[0]], // Rest day today? No, we want NO rest day to test time.
    // Wait, if it's a rest day, tempsDispoMin is 0. Let's make it yesterday so it's not today.
    restDays: [new Date(Date.now() - 86400000).toISOString().split('T')[0]],
    bedtime: '23:00'
  })
}));

vi.mock('../moteur/cours', () => ({
  loadCours: () => ({
    licences: [{
      semestres: [{
        ues: [{
          matieres: [
            {
              nom: 'Maths',
              coefficient: 3,
              listeCM: [
                { titre: 'CM1', jActuel: 0, easeFactor: 2.5 }
              ]
            }
          ]
        }]
      }]
    }]
  })
}));

describe('Orchestrateur - genererRapportQuotidien', () => {
  test('returns a valid daily report structure', () => {
    const r = genererRapportQuotidien('dummyCfg', 'dummyCrs');
    expect(r).toBeDefined();
    expect(r).toHaveProperty('statut');
    expect(r).toHaveProperty('tachesDuJour');
    expect(r).toHaveProperty('tempsRequisMin');
    expect(r).toHaveProperty('tempsDispoMin');
    expect(r.tachesDuJour).toBeInstanceOf(Array);
    expect(['OK', 'SURCHARGE', 'REPOS']).toContain(r.statut);
  });

  test('extraTimeMin changes tempsDispoMin behavior', () => {
    const r60 = genererRapportQuotidien('dummyCfg', 'dummyCrs', 60);
    expect(r60.tempsDispoMin).toBeDefined();
  });

  test('report contains intelligence object with all axes', () => {
    const r = genererRapportQuotidien('dummyCfg', 'dummyCrs', 0);
    
    expect(r.intelligence).toBeDefined();
    expect(r.intelligence).toHaveProperty('compensationMap');
    expect(r.intelligence).toHaveProperty('remainingWeightMap');
    expect(r.intelligence).toHaveProperty('velocityMap');
    expect(r.intelligence).toHaveProperty('cognitiveLoadMap');
    expect(r.intelligence).toHaveProperty('burnoutRisk');
    expect(r.intelligence).toHaveProperty('projectedScoreMap');
  });
});
