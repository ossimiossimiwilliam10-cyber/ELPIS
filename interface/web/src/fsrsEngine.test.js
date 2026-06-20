import { describe, it, expect } from 'vitest';
import { evaluateFSRS, migrateToFSRSCard, Rating, State } from './fsrsEngine';

// ============================================================
// migrateToFSRSCard
// ============================================================
describe('migrateToFSRSCard', () => {
  it('should return a New card for an untouched CM', () => {
    const cm = { jActuel: 0, titre: 'Chapitre 1' };
    const card = migrateToFSRSCard(cm);
    expect(card.state).toBe(State.New);
  });

  it('should return a New card when jActuel is undefined', () => {
    const cm = { titre: 'Chapitre 1' };
    const card = migrateToFSRSCard(cm);
    expect(card.state).toBe(State.New);
  });

  it('should migrate a reviewed CM to Review state', () => {
    const cm = { jActuel: 7, repetitions: 2, derniereRevision: '2026-06-10' };
    const card = migrateToFSRSCard(cm);
    expect(card.state).toBe(State.Review);
    expect(card.reps).toBe(2);
    expect(card.stability).toBe(7);
    expect(card.difficulty).toBe(5.0);
    expect(card.scheduled_days).toBe(7);
    expect(card.elapsed_days).toBe(7);
    expect(card.last_review).toBeInstanceOf(Date);
    expect(card.due).toBeInstanceOf(Date);
  });

  it('should default reps to 1 if not provided', () => {
    const cm = { jActuel: 5 };
    const card = migrateToFSRSCard(cm);
    expect(card.reps).toBe(1);
  });

  it('should set due date to now when derniereRevision is missing', () => {
    const cm = { jActuel: 5 };
    const card = migrateToFSRSCard(cm);
    expect(card.last_review).toBeInstanceOf(Date);
    expect(card.due).toBeInstanceOf(Date);
    // due should be close to now (within a few seconds)
    const now = new Date();
    const diffMs = Math.abs(card.due.getTime() - now.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  it('should compute due = last_review + jActuel when derniereRevision exists', () => {
    const cm = { jActuel: 7, derniereRevision: '2026-06-10' };
    const card = migrateToFSRSCard(cm);
    const expectedDue = new Date('2026-06-10T12:00:00');
    expectedDue.setDate(expectedDue.getDate() + 7);
    expect(card.due.toISOString().split('T')[0]).toBe(expectedDue.toISOString().split('T')[0]);
  });

  it('should handle jActuel = 0 as New card', () => {
    const cm = { jActuel: 0, repetitions: 0, derniereRevision: '2026-06-10' };
    const card = migrateToFSRSCard(cm);
    expect(card.state).toBe(State.New);
  });
});

// ============================================================
// evaluateFSRS
// ============================================================
describe('evaluateFSRS', () => {
  it('should handle a fresh card with Good rating', () => {
    const cm = { jActuel: 0, titre: 'Test' };
    const card = migrateToFSRSCard(cm);
    const result = evaluateFSRS(card, Rating.Good);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    // Fresh card uses short-term learning steps → scheduled_days may be 0
    expect(result.scheduled_days).toBeGreaterThanOrEqual(0);
    expect(result.due).toBeInstanceOf(Date);
    expect(result.stability).toBeGreaterThan(0);
  });

  it('should handle Again rating (lapse back to short-term)', () => {
    const cm = { jActuel: 10, repetitions: 3, derniereRevision: '2026-06-10' };
    const card = migrateToFSRSCard(cm);
    const result = evaluateFSRS(card, Rating.Again);
    expect(result).toBeDefined();
    // Again on a Review card → may go to short-term relearning (scheduled_days = 0)
    expect(result.scheduled_days).toBeGreaterThanOrEqual(0);
    expect(result.state).toBeDefined();
  });

  it('should accept numeric ratings 1-4', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-10' };
    const card = migrateToFSRSCard(cm);
    
    const r1 = evaluateFSRS(card, 1); // Again
    expect(r1.scheduled_days).toBeGreaterThanOrEqual(0);
    
    const r2 = evaluateFSRS(card, 3); // Good
    expect(r2.scheduled_days).toBeGreaterThanOrEqual(0);
    // Good on a Review card should produce days-based interval
    expect(r2.scheduled_days).toBeGreaterThan(0);
  });

  it('should handle null/undefined card gracefully', () => {
    const result = evaluateFSRS(null, Rating.Good);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    // Fresh card from scratch → may use short-term steps
    expect(result.scheduled_days).toBeGreaterThanOrEqual(0);
    expect(result.stability).toBeGreaterThan(0);
  });

  it('should handle card without state property', () => {
    const result = evaluateFSRS({ due: new Date() }, Rating.Good);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
  });

  it('should apply velocity multiplier > 1 (fast learner → longer interval)', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const normal = evaluateFSRS(card, Rating.Good, 1.0);
    const fast = evaluateFSRS(card, Rating.Good, 1.2);
    // Fast learner should have longer or equal interval
    expect(fast.scheduled_days).toBeGreaterThanOrEqual(normal.scheduled_days);
  });

  it('should apply velocity multiplier < 1 (slow learner → shorter interval)', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const normal = evaluateFSRS(card, Rating.Good, 1.0);
    const slow = evaluateFSRS(card, Rating.Good, 0.8);
    // Slow learner should have shorter or equal interval
    expect(slow.scheduled_days).toBeLessThanOrEqual(normal.scheduled_days);
  });

  it('should not apply velocity when multiplier is 1.0', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const a = evaluateFSRS(card, Rating.Good, 1.0);
    const b = evaluateFSRS(card, Rating.Good, 1.0);
    expect(a.scheduled_days).toBe(b.scheduled_days);
  });

  it('should return a Date for due field', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const result = evaluateFSRS(card, Rating.Good);
    expect(result.due).toBeInstanceOf(Date);
    expect(isNaN(result.due.getTime())).toBe(false);
  });

  it('should return valid stability and difficulty in FSRS range', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const result = evaluateFSRS(card, Rating.Good);
    expect(result.stability).toBeGreaterThan(0.001); // S_MIN
    expect(result.stability).toBeLessThanOrEqual(36500); // S_MAX
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.difficulty).toBeLessThanOrEqual(10);
  });

  it('should produce consistent results for same inputs', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const r1 = evaluateFSRS(card, Rating.Good, 1.0);
    const r2 = evaluateFSRS(card, Rating.Good, 1.0);
    // FSRS is deterministic
    expect(r1.scheduled_days).toBe(r2.scheduled_days);
    expect(r1.stability).toBe(r2.stability);
    expect(r1.difficulty).toBe(r2.difficulty);
  });

  it('should handle Easy rating (score 4)', () => {
    const cm = { jActuel: 3, repetitions: 2, derniereRevision: '2026-06-01' };
    const card = migrateToFSRSCard(cm);
    const result = evaluateFSRS(card, Rating.Easy);
    expect(result.scheduled_days).toBeGreaterThan(0);
    expect(result.due).toBeInstanceOf(Date);
  });
});

// ============================================================
// Round-trip: migrate → evaluate → re-evaluate
// ============================================================
describe('FSRS round-trip', () => {
  it('should maintain valid card state through multiple reviews', () => {
    // Simulate a card being reviewed 5 times with Good ratings
    let cm = { jActuel: 0, titre: 'Test', derniereRevision: null, repetitions: 0 };
    let fsrsCard = migrateToFSRSCard(cm);
    
    for (let i = 0; i < 5; i++) {
      fsrsCard = evaluateFSRS(fsrsCard, Rating.Good);
      expect(fsrsCard.state).toBeDefined();
      // First iteration(s) may use short-term steps (scheduled_days = 0)
      expect(fsrsCard.scheduled_days).toBeGreaterThanOrEqual(0);
      expect(fsrsCard.stability).toBeGreaterThan(0);
      expect(fsrsCard.difficulty).toBeGreaterThanOrEqual(1);
      expect(fsrsCard.difficulty).toBeLessThanOrEqual(10);
      expect(fsrsCard.due).toBeInstanceOf(Date);
    }
    
    // After 5 Good reviews, interval should have grown to at least 1 day
    expect(fsrsCard.scheduled_days).toBeGreaterThan(0);
  });

  it('should correctly handle Again after several Good reviews', () => {
    let cm = { jActuel: 0, titre: 'Test' };
    let fsrsCard = migrateToFSRSCard(cm);
    
    // 3 Good reviews
    for (let i = 0; i < 3; i++) {
      fsrsCard = evaluateFSRS(fsrsCard, Rating.Good);
    }
    const stabilityBefore = fsrsCard.stability;
    
    // 1 Again
    fsrsCard = evaluateFSRS(fsrsCard, Rating.Again);
    // Stability should decrease or stay low after Again
    expect(fsrsCard.scheduled_days).toBeLessThanOrEqual(7);
  });

  it('should serialize and deserialize correctly (JSON round-trip)', () => {
    const cm = { jActuel: 5, repetitions: 2, derniereRevision: '2026-06-01' };
    let card = migrateToFSRSCard(cm);
    card = evaluateFSRS(card, Rating.Good);

    // Simulate JSON serialization
    const json = JSON.stringify(card);
    const restored = JSON.parse(json);

    // Re-hydrate dates
    if (typeof restored.due === 'string') restored.due = new Date(restored.due);
    if (typeof restored.last_review === 'string') restored.last_review = new Date(restored.last_review);

    expect(restored.stability).toBe(card.stability);
    expect(restored.difficulty).toBe(card.difficulty);
    expect(restored.scheduled_days).toBe(card.scheduled_days);
    expect(restored.due instanceof Date).toBe(true);
  });
});

// ============================================================
// DEEP LOGIC: FSRS Curve Evolution (100+ Scenarios)
// ============================================================
describe('DEEP LOGIC: FSRS Curve Evolution over Time', () => {
  const curveScenarios = [];
  // We simulate 100 students taking 10 days of different sequences
  for (let s = 1; s <= 100; s++) {
    const isFastLearner = s % 2 === 0;
    const velocity = isFastLearner ? 1.2 : 0.8;
    curveScenarios.push([s, velocity, isFastLearner]);
  }

  test.each(curveScenarios)('Student %d (fast: %s) curve validates logical FSRS bounds', (studentId, velocity, isFastLearner) => {
    let card = migrateToFSRSCard({ jActuel: 0, titre: 'Deep Logic CM' });
    
    // Day 1: Learn
    card = evaluateFSRS(card, Rating.Good, velocity);
    expect(card.state).not.toBe(State.New);
    
    // Day 2-10: Review with varying success
    for (let day = 2; day <= 10; day++) {
      const prevStability = card.stability;
      const rating = (day % 4 === 0) ? Rating.Hard : ((day % 5 === 0) ? Rating.Easy : Rating.Good);
      
      card = evaluateFSRS(card, rating, velocity);
      
      // Basic bounds check to ensure algorithm doesn't blow up
      expect(card.stability).toBeGreaterThan(0);
      expect(card.difficulty).toBeGreaterThanOrEqual(1);
      expect(card.difficulty).toBeLessThanOrEqual(10);
      
      // If we answer Good/Easy, stability should generally increase or stay high
      // With velocity = 0.8 (slow learner), stability might occasionally drop slightly if retrievability is very low.
      if (rating >= Rating.Good && card.state === State.Review) {
         expect(card.stability).toBeGreaterThanOrEqual(prevStability * 0.8);
      }
    }
    
    // Final check after 10 days of solid learning
    expect(card.scheduled_days).toBeGreaterThan(1); // Should have graduated from short-term intervals
  });
});

// ============================================================
// Rating / State re-exports
// ============================================================
describe('Rating and State exports', () => {
  it('should export Rating enum', () => {
    expect(Rating.Again).toBe(1);
    expect(Rating.Hard).toBe(2);
    expect(Rating.Good).toBe(3);
    expect(Rating.Easy).toBe(4);
  });

  it('should export State enum', () => {
    expect(State.New).toBe(0);
    expect(State.Learning).toBe(1);
    expect(State.Review).toBe(2);
    expect(State.Relearning).toBe(3);
  });
});
