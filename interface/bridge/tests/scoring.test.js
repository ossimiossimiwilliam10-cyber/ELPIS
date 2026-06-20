import { describe, test, expect } from 'vitest';
import { getPrioScore, getSubjectExamBoost, getDifficultyMultiplier } from '../moteur/scoring';

describe('Scoring Engine - getDifficultyMultiplier', () => {
  test.each([
    ['tres_facile', 0.5],
    ['facile', 0.8],
    ['moyen', 1.0],
    ['difficile', 1.5],
    ['unknown', 1.0],
    [null, 1.0]
  ])('maps %s to %f', (diff, expected) => {
    expect(getDifficultyMultiplier(diff)).toBe(expected);
  });
});

describe('Scoring Engine - getSubjectExamBoost', () => {
  test('returns 1.0 when no urgency', () => {
    const matiere = { nom: 'Histoire' };
    const r = getSubjectExamBoost(matiere, {});
    expect(r.boost).toBe(1.0);
  });

  test('applies exam urgency multiplier', () => {
    const matiere = { nom: 'Maths' };
    const map = { 'maths': { multiplier: 2.5, daysToExam: 3 } };
    const r = getSubjectExamBoost(matiere, map);
    expect(r.boost).toBe(2.5);
    expect(r.daysToExam).toBe(3);
  });

  test('forces massive boost for high coeff + imminent exam', () => {
    const matiere = { nom: 'Physique', coefficient: 4 };
    const map = { 'physique': { multiplier: 1.5, daysToExam: 10 } };
    const r = getSubjectExamBoost(matiere, map);
    // Overridden by extreme priority logic in getSubjectExamBoost
    expect(r.boost).toBeGreaterThan(1.5);
  });
});

describe('Scoring Engine - getPrioScore', () => {
  test('base priority for unpracticed exercise is 1.0', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    expect(getPrioScore(ex, {}, null, null, null)).toBeCloseTo(1.0);
  });

  test('hard exercises get higher priority', () => {
    const exHard = { nombrePratiques: 0, difficulte: 'difficile' };
    const exEasy = { nombrePratiques: 0, difficulte: 'facile' };
    expect(getPrioScore(exHard, {}, null)).toBeGreaterThan(getPrioScore(exEasy, {}, null));
  });

  test('Mission 3: Annale eve of exam crushes normal CM priority', () => {
    const exAnnale = { type: 'ANNALE', nombrePratiques: 0, difficulte: 'moyen' };
    const urgencyMap = { 'maths': { multiplier: 3.0, daysToExam: 1 } };
    const matiere = { nom: 'Maths', coefficient: 3, evaluations: [] };

    const prioAnnale = getPrioScore(exAnnale, urgencyMap, matiere);
    
    const exCM = { type: 'CM', nombrePratiques: 0, difficulte: 'moyen' };
    const prioCM = getPrioScore(exCM, {}, { nom: 'Histoire' });

    expect(prioAnnale).toBeGreaterThan(prioCM * 2); // At least twice as important
    expect(prioAnnale).toBeGreaterThanOrEqual(3.0);
  });

  const diffMultiplier = {
    'tres_facile': 0.5,
    'facile': 0.8,
    'moyen': 1.0,
    'difficile': 1.5,
    'inconnu': 1.0
  };

  const cmScenarios = [];
  for (let practices = 0; practices <= 5; practices++) {
    for (const diff of Object.keys(diffMultiplier)) {
      cmScenarios.push([practices, diff]);
    }
  }

  test.each(cmScenarios)('CM priority for %d practices and %s difficulty', (practices, diff) => {
    const ex = { type: 'CM', nombrePratiques: practices, difficulte: diff };
    const prio = getPrioScore(ex, {}, { nom: 'Test', coefficient: 1 });
    expect(prio).toBeGreaterThan(0);
    // As practices increase, priority should drop, except if urgency boosts it
    if (practices > 0) {
      expect(prio).toBeLessThanOrEqual(1.0 * diffMultiplier[diff]);
    }
  });

  const tdScenarios = [];
  for (let practices = 0; practices <= 3; practices++) {
    for (const diff of Object.keys(diffMultiplier)) {
      tdScenarios.push([practices, diff]);
    }
  }

  test.each(tdScenarios)('TD priority for %d practices and %s difficulty', (practices, diff) => {
    const ex = { type: 'TD', nombrePratiques: practices, difficulte: diff };
    const prio = getPrioScore(ex, {}, { nom: 'Test', coefficient: 1 });
    expect(prio).toBeGreaterThan(0);
  });
});
