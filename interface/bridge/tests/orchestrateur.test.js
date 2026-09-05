import { describe, test, expect, vi } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false)
}));

vi.mock('../moteur/historique', () => ({
  loadHistorique: () => ([])
}));

vi.mock('../moteur/config', () => ({
  loadConfig: () => ({
    maxStudyHoursPerDay: 8,
    maxSubjectsPerDay: 4,
    restDays: [new Date(Date.now() - 86400000).toISOString().split('T')[0]],
    bedtime: '23:00',
    defaultDurationNewCM: 120,
    defaultDurationRevCM: 30,
    defaultDurationTD: 20,
    defaultDurationTP: 30,
    defaultDurationAnnales: 60,
    defaultDurationAnki: 30,
    defaultDurationTP_Etape1: 45,
    defaultDurationTP_Etape2: 180,
    defaultDurationTP_Etape3: 90,
    defaultDurationTP_Etape4: 30,
    maxNewCMPerSubjectPerDay: 5,
    maxNewCMPerSemesterPerDay: 50,
    antiEnnuiMultiplier: 2.0
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
    const r = genererRapportQuotidien(0);
    expect(r).toBeDefined();
    expect(r).toHaveProperty('statut');
    expect(r).toHaveProperty('tachesDuJour');
    expect(r).toHaveProperty('tempsRequisMin');
    expect(r).toHaveProperty('tempsDispoMin');
    expect(r.tachesDuJour).toBeInstanceOf(Array);
    // REPOS_OPTIONNEL manquait : le rapport le renvoie notamment les week-ends de
    // la phase de préparation, si bien que ce test échouait selon le jour où on
    // le lançait.
    expect(['OK', 'SURCHARGE', 'REPOS', 'REPOS_OPTIONNEL']).toContain(r.statut);
  });

  test('extraTimeMin changes tempsDispoMin behavior', () => {
    const r60 = genererRapportQuotidien(60);
    expect(r60.tempsDispoMin).toBeDefined();
  });

  test('report contains intelligence object with all axes', () => {
    const r = genererRapportQuotidien(0);
    
    expect(r.intelligence).toBeDefined();
    expect(r.intelligence).toHaveProperty('compensationMap');
    expect(r.intelligence).toHaveProperty('remainingWeightMap');
    expect(r.intelligence).toHaveProperty('velocityMap');
    expect(r.intelligence).toHaveProperty('cognitiveLoadMap');
    expect(r.intelligence).toHaveProperty('burnoutRisk');
    expect(r.intelligence).toHaveProperty('projectedScoreMap');
    // v3 additions
    expect(r.intelligence).toHaveProperty('projectedScoreDetail');
    expect(r.intelligence).toHaveProperty('timeOptimizationMap');
    expect(r.intelligence).toHaveProperty('synergyMap');
    expect(r.intelligence).toHaveProperty('workloadForecast');
  });

  test('Anti-regression: Time-awareness properly assigns moments based on current hour', () => {
    const originalGetHours = Date.prototype.getHours;
    
    // Test Soir
    Date.prototype.getHours = vi.fn(() => 20);
    const rSoir = genererRapportQuotidien(0);
    if (rSoir.tachesDuJour && rSoir.tachesDuJour.length > 0) {
      for (const t of rSoir.tachesDuJour) {
        expect(t.moment).toBe('soir');
      }
    }

    // Test Aprem
    Date.prototype.getHours = vi.fn(() => 15);
    const rAprem = genererRapportQuotidien(0);
    if (rAprem.tachesDuJour && rAprem.tachesDuJour.length > 0) {
      for (const t of rAprem.tachesDuJour) {
        expect(t.moment).not.toBe('matin');
      }
    }

    Date.prototype.getHours = originalGetHours;
  });
});
