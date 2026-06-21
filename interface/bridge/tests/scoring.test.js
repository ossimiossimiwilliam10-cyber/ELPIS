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

  test('fuzzy matches exam subject by prefix', () => {
    const matiere = { nom: 'Physique Avancée' };
    const map = { 'physique': { multiplier: 1.2, daysToExam: 15 } };
    const r = getSubjectExamBoost(matiere, map);
    expect(r.boost).toBeCloseTo(1.2);
    expect(r.daysToExam).toBe(15);
  });

  test('forces baseBoost to 2.0 if coeff >= 3 and multiplier is exactly 1.5', () => {
    const matiere = { nom: 'Electronique', coefficient: 3 };
    const map = { 'electronique': { multiplier: 1.5, daysToExam: 10 } };
    const r = getSubjectExamBoost(matiere, map);
    // Base boost becomes 2.0, then * (1 + 0.2) = 2.4
    expect(r.boost).toBeCloseTo(2.4);
    expect(r.daysToExam).toBe(10);
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

  test('AXE 5: Remaining Weight Factor boosts priority if remainingRatio >= 0.4', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    const matiere = { nom: 'Maths', coefficient: 1, evaluations: [] };
    const rwMap = { 'Maths': { remainingRatio: 0.8 } }; // Boost: 1 + (0.8 - 0.4)*1 = 1.4

    const prioWithRW = getPrioScore(ex, null, matiere, rwMap, null);
    const prioWithoutRW = getPrioScore(ex, null, matiere, {}, null);

    expect(prioWithRW).toBeCloseTo(prioWithoutRW * 1.4);
  });

  test('AXE 8: Compensation reduces pressure if UE is compensable and deficit < 2', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    const matiere = { nom: 'Maths', coefficient: 1, evaluations: [] };
    const compMap = { 'Maths': { compensable: true, deficit: 1 } }; 

    const prioWithComp = getPrioScore(ex, null, matiere, null, compMap);
    const prioWithoutComp = getPrioScore(ex, null, matiere, null, {});

    expect(prioWithComp).toBeCloseTo(prioWithoutComp * 0.7);
  });

  test('AXE 13: Synergies Inter-Matières boosts priority if related subject ratio < 0.3', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    const matiere = { nom: 'Maths', _ueMatieres: ['Maths', 'Physique'] };
    const velocityMap = { 'Physique': { totalCMs: 10, masteredCMs: 1 } }; // ratio 0.1 < 0.3 => boost +0.2

    const prioWithSynergy = getPrioScore(ex, null, matiere, null, null, velocityMap);
    const prioWithoutSynergy = getPrioScore(ex, null, matiere, null, null, {});

    expect(prioWithSynergy).toBeCloseTo(prioWithoutSynergy * 1.2);
  });

  test('AXE 13: Synergies Inter-Matières reduces priority if related subject ratio > 0.8', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    const matiere = { nom: 'Maths', _ueMatieres: ['Maths', 'Physique'] };
    const velocityMap = { 'Physique': { totalCMs: 10, masteredCMs: 9 } }; // ratio 0.9 > 0.8 => boost -0.1

    const prioWithSynergy = getPrioScore(ex, null, matiere, null, null, velocityMap);
    const prioWithoutSynergy = getPrioScore(ex, null, matiere, null, null, {});

    expect(prioWithSynergy).toBeCloseTo(prioWithoutSynergy * 0.9);
  });

  test('Grade deficit boost: grade < 12 boosts priority', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    // getMatiereAverage relies on evaluations
    const matiere = { nom: 'Maths', coefficient: 2, evaluations: [{note: 10, coefficient: 1}] };
    // boost = 1.0 + ((12-10)/10)*2 = 1.4

    const prioWithDeficit = getPrioScore(ex, null, matiere, null, null, null);
    expect(prioWithDeficit).toBeCloseTo(1.4);
  });

  test('Grade deficit boost: grade >= 15 reduces priority', () => {
    const ex = { nombrePratiques: 0, difficulte: 'moyen' };
    const matiere = { nom: 'Maths', coefficient: 1, evaluations: [{note: 16, coefficient: 1}] };
    // grade >= 15 => boost = 0.8

    const prioHighGrade = getPrioScore(ex, null, matiere, null, null, null);
    expect(prioHighGrade).toBeCloseTo(0.8);
  });

  test('difficulty multiplier variations', () => {
    const ex1 = { difficulte: 'assez_difficile' };
    expect(getPrioScore(ex1, null, null)).toBeCloseTo(1.2);

    const ex2 = { difficulte: 'tres_facile' };
    expect(getPrioScore(ex2, null, null)).toBeCloseTo(0.6);
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
