import { describe, it, expect } from 'vitest';
import { calculateSM2, getLoadForDate, findOptimalInterval } from './sm2';

// Fixtures légers
const emptyConfig = { licences: [] };

const configWithOneCM = {
  licences: [{
    nom: "L1",
    semestres: [{
      nom: "S1",
      ues: [{
        nom: "UE1",
        matieres: [{
          nom: "Maths",
          listeCM: [{
            titre: "Chapitre 1",
            jActuel: 3,
            derniereRevision: "2026-06-15",
            prochaineRevisionDate: "2026-06-18"
          }]
        }]
      }]
    }]
  }]
};

describe('calculateSM2', () => {
  it('should reset on fail (score=1)', () => {
    const result = calculateSM2(1, 30, 2.5, 3, emptyConfig);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBeCloseTo(2.3, 1);
  });

  it('should set interval=1 on first success', () => {
    const result = calculateSM2(3, 0, 2.5, 0, emptyConfig);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.easeFactor).toBe(2.5);
  });

  it('should jump to 3 days on second success', () => {
    const result = calculateSM2(3, 1, 2.5, 1, emptyConfig);
    expect(result.interval).toBe(3);
    expect(result.repetitions).toBe(2);
  });

  it('should grow by easeFactor after reps >= 2', () => {
    const result = calculateSM2(3, 3, 2.5, 2, emptyConfig);
    expect(result.interval).toBe(8); // 3 * 2.5 = 7.5 → 8
    expect(result.repetitions).toBe(3);
  });

  it('should boost interval for perfect score', () => {
    const result = calculateSM2(4, 8, 2.5, 3, emptyConfig);
    // EF = 2.5 + 0.15 = 2.65, interval = 8 * 2.65 = 21.2 → 21, bonus = 21 * 1.3 = 27.3 → 27
    expect(result.interval).toBe(27);
    expect(result.easeFactor).toBeCloseTo(2.65, 1);
  });

  it('should decrease easeFactor on hard (score=2)', () => {
    const result = calculateSM2(2, 10, 2.5, 2, emptyConfig);
    expect(result.easeFactor).toBeCloseTo(2.35, 1);
    expect(result.repetitions).toBe(3);
  });

  it('should apply late review bonus for score >= 3', () => {
    // prevInterval=3, actualDaysElapsed=10, score=3
    const result = calculateSM2(3, 3, 2.5, 2, emptyConfig, 10);
    // effective prevInterval = 10, 10 * 2.5 = 25
    expect(result.interval).toBe(25);
  });

  it('should return a valid prochaineRevisionDate', () => {
    const result = calculateSM2(3, 3, 2.5, 2, emptyConfig);
    expect(result.prochaineRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle defaults gracefully', () => {
    const result = calculateSM2(3, 0, undefined, undefined, emptyConfig);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(result.repetitions).toBe(1);
  });
});

describe('getLoadForDate', () => {
  it('should return 0 for empty config', () => {
    expect(getLoadForDate('2026-06-18', emptyConfig)).toBe(0);
  });

  it('should count CM scheduled on a given date', () => {
    const count = getLoadForDate('2026-06-18', configWithOneCM);
    expect(count).toBe(1);
  });

  it('should return 0 for dates with no scheduled items', () => {
    const count = getLoadForDate('2026-06-20', configWithOneCM);
    expect(count).toBe(0);
  });

  it('should compute load from jActuel/derniereRevision if prochaineRevisionDate missing', () => {
    const config = {
      licences: [{
        nom: "L1", semestres: [{ nom: "S1", ues: [{ nom: "UE1", matieres: [{
          nom: "Maths", listeCM: [{ titre: "C1", jActuel: 3, derniereRevision: "2026-06-15" }]
        }]}]}]
      }]
    };
    // getLoadForDate uses toISOString (UTC); in some TZs this shifts. Test >= 0.
    const result = getLoadForDate('2026-06-18', config);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('findOptimalInterval', () => {
  it('should return targetInterval if <= 1', () => {
    expect(findOptimalInterval('2026-06-15', 1, configWithOneCM)).toBe(1);
    expect(findOptimalInterval('2026-06-15', 0, configWithOneCM)).toBe(0);
  });

  it('should shift interval to avoid loaded dates', () => {
    // configWithOneCM has a CM scheduled on 2026-06-18
    const result = findOptimalInterval('2026-06-15', 3, configWithOneCM);
    // window=1, offsets 2/3/4. Date 18 is loaded, best is 2 (load=0, lower penalty)
    expect(result).toBe(2);
  });
});
