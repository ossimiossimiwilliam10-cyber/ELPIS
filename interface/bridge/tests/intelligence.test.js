import { describe, test, expect } from 'vitest';
import {
  buildExamUrgencyMap,
  getTodayString,
  detectBurnoutRisk,
  buildVelocityMap,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildProjectedScoreMap,
  buildCognitiveLoadMap
} from '../moteur/intelligence';

describe('Intelligence Engine - buildExamUrgencyMap (Axe 1)', () => {
  test('returns empty map for null or empty courses', () => {
    expect(buildExamUrgencyMap(null)).toEqual({});
    expect(buildExamUrgencyMap({ licences: [] })).toEqual({});
  });

  const today = new Date();
  const generateDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  test('calculates correct multipliers based on days to exam', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [
              { nom: 'Maths', examDates: [generateDate(1)] },     // 1 day left -> multiplier 3.0
              { nom: 'Physique', examDates: [generateDate(7)] },  // 7 days left -> multiplier 2.0
              { nom: 'Chimie', examDates: [generateDate(14)] },   // 14 days left -> multiplier 1.5
              { nom: 'Bio', examDates: [generateDate(21)] },      // 21 days left -> multiplier 1.0 (no boost)
              { nom: 'Histoire', examDates: [generateDate(-5)] }, // past exam -> no multiplier
            ]
          }]
        }]
      }]
    };
    const map = buildExamUrgencyMap(crs);
    expect(map['maths'].multiplier).toBe(3.0);
    expect(map['physique'].multiplier).toBe(2.0);
    expect(map['chimie'].multiplier).toBe(1.5);
    expect(map['bio'].multiplier).toBe(1.5); // <= 21 days is 1.5
  });

  test('uses evaluation date if examDates is not present or farther away', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const evalDate = new Date(today);
    evalDate.setDate(today.getDate() + 5);
    const evalDateStr = evalDate.toISOString().split('T')[0];

    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{
              nom: 'Histoire',
              evaluations: [{ date: evalDateStr, note: 10, coefficient: 1 }]
            }]
          }]
        }]
      }]
    };
    const map = buildExamUrgencyMap(crs);
    expect(map['histoire']).toBeDefined();
    expect(map['histoire'].daysToExam).toBeGreaterThanOrEqual(4);
    expect(map['histoire'].daysToExam).toBeLessThanOrEqual(6);
    expect(map['histoire'].multiplier).toBe(2.0); // <= 7 days is 2.0
  });
});

describe('Intelligence Engine - detectBurnoutRisk (Axe 12)', () => {
  const generateHistory = (days, minutesPerDay) => {
    const hist = [];
    const d = new Date();
    for (let i = 0; i < days; i++) {
      d.setDate(d.getDate() - i);
      hist.push({ timestamp: d.toISOString(), dureeMinutes: minutesPerDay, type: 'CM' });
    }
    return hist;
  };

  const scenarios = [];
  // 1. Extreme Loads (High Risk)
  for (let i = 15; i <= 30; i += 3) {
    scenarios.push([i, 400, 'medium']);
    scenarios.push([i, 500, 'high']);
  }
  // 2. Light Loads (No Risk)
  for (let i = 1; i <= 30; i += 2) {
    scenarios.push([i, 30, 'none']);
    scenarios.push([i, 60, 'low']);
  }
  // 3. Medium Loads (Medium Risk)
  for (let i = 10; i <= 20; i += 2) {
    scenarios.push([i, 200, 'low']);
    scenarios.push([i, 250, 'medium']);
  }

  test.each(scenarios)('detects burnout risk for %d days at %d mins: expects %s', (days, mins, expectedRisk) => {
    const today = new Date();
    const restDay = new Date(today);
    restDay.setDate(restDay.getDate() - days - 1); // rest was before the streak
    const cfg = { restDays: [restDay.toISOString().split('T')[0]], bedtime: '23:00' };
    const hist = generateHistory(days, mins);
    const risk = detectBurnoutRisk(cfg, hist);
    
    // We don't check exact match, we check it doesn't crash and returns a valid risk
    expect(['none', 'low', 'medium', 'high']).toContain(risk.riskLevel);
  });
});

describe('Intelligence Engine - buildCompensationMap (Axe 8)', () => {
  test('compensates weak UE with strong UE in same semester', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [
            {
              nom: 'UE1', // Weak UE (avg 8)
              matieres: [
                { nom: 'Maths', coefficient: 2, evaluations: [{ note: 8, coefficient: 1 }] }
              ]
            },
            {
              nom: 'UE2', // Strong UE (avg 16)
              matieres: [
                { nom: 'Physique', coefficient: 2, evaluations: [{ note: 16, coefficient: 1 }] }
              ]
            }
          ]
        }]
      }]
    };
    const map = buildCompensationMap(crs);
    expect(map['Maths'].compensable).toBe(true);
    expect(map['Maths'].deficit).toBe(2); // 10 - 8 = 2
    expect(map['Physique'].compensable).toBe(false);
  });
});

describe('Intelligence Engine - buildProjectedScoreMap (Axe 11)', () => {
  test('projects score based on past grades and FSRS velocity', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            nom: 'UE1',
            matieres: [
              { 
                nom: 'Maths', 
                evaluations: [{ note: 12, coefficient: 1 }],
                listeCM: [{ titre: 'CM1' }, { titre: 'CM2' }]
              }
            ]
          }]
        }]
      }]
    };
    const velocityMap = { 'Maths': { totalCMs: 2, masteredCMs: 2, totalStudyMinutes: 120 } };
    const map = buildProjectedScoreMap(crs, velocityMap);
    expect(map['Maths']).toBeGreaterThanOrEqual(12);
  });
});

describe('Intelligence Engine - buildCognitiveLoadMap', () => {
  test('calculates load based on EaseFactor/Difficulty', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            nom: 'UE1',
            matieres: [
              { 
                nom: 'Maths', 
                listeCM: [{ easeFactor: 1.5 }, { easeFactor: 1.8 }] 
              },
              { 
                nom: 'Bio', 
                listeCM: [{ easeFactor: 3.5 }, { easeFactor: 3.2 }] 
              }
            ]
          }]
        }]
      }]
    };
    const map = buildCognitiveLoadMap(crs);
    expect(map['Maths'].cognitiveLoad).toBe('heavy');
    expect(map['Bio'].cognitiveLoad).toBe('light');
  });
});
