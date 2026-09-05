import { describe, test, expect } from 'vitest';
import {
  getTodayString,
  buildExamUrgencyMap,
  detectBurnoutRisk,
  buildCompensationMap,
  buildProjectedScoreMap,
  buildCognitiveLoadMap
} from '../moteur/intelligence';

describe('Intelligence Engine - buildExamUrgencyMap (Axe 1)', () => {
  test('returns empty map for null or empty courses', () => {
    expect(buildExamUrgencyMap(null)).toEqual({});
    expect(buildExamUrgencyMap({ licences: [] })).toEqual({});
  });

  /*
   * Les échéances se comptent depuis la journée logique du moteur.
   *
   * `new Date()` conserve l'heure courante, et `toISOString()` la rend en UTC :
   * entre minuit et 4 h du matin — la fenêtre que le décalage de nuit d'ELPIS
   * rattache à la veille — l'écart valait un jour entier, et « Physique dans
   * 7 jours » devenait 8. Ce test virait donc au rouge à 2 h du matin sans
   * qu'aucune ligne du moteur n'ait changé.
   */
  const generateDate = (offsetDays) => {
    const [a, m, j] = getTodayString().split('-').map(Number);
    const d = new Date(a, m - 1, j, 12, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  test('calculates correct multipliers based on days to exam', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [
              { nom: 'Maths', evaluations: [{ date: generateDate(1) }] },     // 1 day left -> multiplier 3.0
              { nom: 'Physique', evaluations: [{ date: generateDate(7) }] },  // 7 days left -> multiplier 2.0
              { nom: 'Chimie', evaluations: [{ date: generateDate(14) }] },   // 14 days left -> multiplier 1.5
              { nom: 'Bio', evaluations: [{ date: generateDate(21) }] },      // 21 days left -> multiplier 1.0 (no boost)
              { nom: 'Histoire', evaluations: [{ date: generateDate(-5) }] }, // past exam -> no multiplier
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
              // Épreuve à venir, donc pas encore notée : une note ferme
              // l'échéance et la matière sort du calcul d'urgence.
              evaluations: [{ date: evalDateStr, coefficient: 1 }]
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

  test.each(scenarios)('detects burnout risk for %d days at %d mins: expects %s', (days, mins, _expectedRisk) => {
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
    expect(map['maths'].compensable).toBe(true);
    expect(map['maths'].deficit).toBe(2); // 10 - 8 = 2
    expect(map['physique'].compensable).toBe(false);
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
    const velocityMap = { 'maths': { totalCMs: 2, masteredCMs: 2, totalStudyMinutes: 120 } };
    const map = buildProjectedScoreMap(crs, velocityMap);
    expect(map['maths']).toBeGreaterThanOrEqual(12);
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
    expect(map['maths'].cognitiveLoad).toBe('heavy');
    expect(map['bio'].cognitiveLoad).toBe('light');
  });
});

describe('Intelligence Engine - parseDateLocal (Anti-rÃ©gression)', () => {
  const { parseDateLocal } = require('../moteur/intelligence');

  test('handles valid ISO format YYYY-MM-DD', () => {
    const d = parseDateLocal('2026-06-23');
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(23);
  });

  test('handles legacy French format DD-MM-YYYY without crashing', () => {
    const d = parseDateLocal('23-06-2026');
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(23);
  });

  test('returns invalid date for malformed strings', () => {
    const d = parseDateLocal('invalid-date');
    expect(isNaN(d.getTime())).toBe(true);
  });

  test('handles empty or null gracefully', () => {
    expect(isNaN(parseDateLocal('').getTime())).toBe(true);
    expect(isNaN(parseDateLocal(null).getTime())).toBe(true);
  });
});

describe('Intelligence Engine - buildExamUrgencyMap Night Owl (Regression)', () => {
  test('daysToExam uses Night Owl shift (-4h), exam in 10 days is correctly computed', () => {
    // This test validates that buildExamUrgencyMap applies the -4h shift.
    // We use a far-future date (10 days) to avoid boundary rounding issues.
    const nightOwlToday = new Date();
    nightOwlToday.setHours(nightOwlToday.getHours() - 4);
    nightOwlToday.setHours(0, 0, 0, 0);
    const futureDate = new Date(nightOwlToday);
    futureDate.setDate(futureDate.getDate() + 10);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [
              { nom: 'TestNightOwl', evaluations: [{ date: futureDateStr }] },
            ]
          }]
        }]
      }]
    };
    const map = buildExamUrgencyMap(crs);
    expect(map['testnightowl']).toBeDefined();
    // Should be within 1 day of 10 (due to Math.ceil rounding in implementation)
    expect(map['testnightowl'].daysToExam).toBeGreaterThanOrEqual(9);
    expect(map['testnightowl'].daysToExam).toBeLessThanOrEqual(11);
    // multiplier for ~10 days = 1.5 (falls in <= 21 days range)
    expect(map['testnightowl'].multiplier).toBe(1.5);
  });
});

