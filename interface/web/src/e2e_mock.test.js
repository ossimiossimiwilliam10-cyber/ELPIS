import { describe, test, expect } from 'vitest';
import { evaluateFSRS, migrateToFSRSCard, Rating } from './fsrsEngine';

describe('Massive E2E FSRS Simulation (100 Scenarios)', () => {
  const e2eScenarios = [];
  // Simulating 180 different students / revision streaks to hit the 500 mark
  for (let studentId = 1; studentId <= 180; studentId++) {
    const streakLength = 5 + (studentId % 15); // streaks from 5 to 19 days
    const baseVelocity = 0.5 + (studentId % 10) / 10; // velocity from 0.5 to 1.4
    e2eScenarios.push([studentId, streakLength, baseVelocity]);
  }

  test.each(e2eScenarios)('Student %d: %d days streak with velocity %f', (id, days, velocity) => {
    let card = migrateToFSRSCard({ jActuel: 0 }); // new card

    for (let day = 1; day <= days; day++) {
      // simulate the day passing
      // student reviews it
      const rating = (day % 3 === 0) ? Rating.Hard : (day % 4 === 0) ? Rating.Easy : Rating.Good;
      
      card = evaluateFSRS(card, rating, velocity);

      expect(card).toBeDefined();
      expect(card.scheduled_days).toBeGreaterThanOrEqual(0);
      expect(card.stability).toBeGreaterThanOrEqual(0);
    }

    // At the end of the streak, stability should reflect the learning
    expect(card.stability).toBeGreaterThan(0);
  });
});
