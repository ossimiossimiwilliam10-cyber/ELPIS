import { describe, test, expect } from 'vitest';
const {
  calculateUCBScore,
  updateQValues,
  getRLMultiplier,
  loadRLState,
  saveRLState
} = require('../moteur/rlEngine');

const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Reinforcement Learning Engine (UCB)', () => {
  test('calculateUCBScore returns a high value for an unexplored subject', () => {
    const rlState = { totalTrials: 10, subjects: {} };
    const score = calculateUCBScore('physique', rlState);
    expect(score).toBeGreaterThan(100); // Forces exploration
  });

  test('calculateUCBScore computes UCB correctly for an explored subject', () => {
    // Q = 0.5, N = 10, n = 2
    const rlState = { 
      totalTrials: 10, 
      subjects: { 
        'maths': { qValue: 0.5, trials: 2 } 
      } 
    };
    
    // c = Math.SQRT2 ≈ 1.414
    // Math.sqrt(Math.log(10) / 2) ≈ Math.sqrt(2.302 / 2) ≈ Math.sqrt(1.151) ≈ 1.073
    // explorationTerm = 1.414 * 1.073 ≈ 1.517
    // score = 0.5 + 1.517 = 2.017
    
    const score = calculateUCBScore('maths', rlState);
    expect(score).toBeCloseTo(2.017, 2);
  });

  test('updateQValues correctly updates trials and Q-Value incrementally', () => {
    let rlState = { totalTrials: 0, subjects: {} };
    
    // First session: reward +0.4
    rlState = updateQValues('Maths', rlState, 0.4);
    expect(rlState.totalTrials).toBe(1);
    expect(rlState.subjects['maths'].trials).toBe(1);
    expect(rlState.subjects['maths'].qValue).toBeCloseTo(0.4, 4);
    
    // Second session: reward +0.6
    rlState = updateQValues('Maths', rlState, 0.6);
    expect(rlState.totalTrials).toBe(2);
    expect(rlState.subjects['maths'].trials).toBe(2);
    // (0.4 + 0.6) / 2 = 0.5
    expect(rlState.subjects['maths'].qValue).toBeCloseTo(0.5, 4);
  });

  test('getRLMultiplier transforms UCB score into a bounded multiplier', () => {
    let rlState = { totalTrials: 0, subjects: {} };
    
    // Unexplored subject -> default high boost (e.g. 1.3)
    let mult = getRLMultiplier('chimie', rlState);
    expect(mult).toBe(1.3);
    
    // Explored subject with bad reward (Q = -1.0)
    rlState = { 
      totalTrials: 100, 
      subjects: { 
        'chimie': { qValue: -1.0, trials: 50 } 
      } 
    };
    mult = getRLMultiplier('chimie', rlState);
    // UCB ≈ -1.0 + 1.414 * sqrt(ln(100)/50) = -1.0 + 1.414 * 0.303 = -0.57
    // Boost = 1.0 + (-0.57 * 0.5) = 0.715 -> capped at 0.8
    expect(mult).toBe(0.8);
    
    // Explored subject with high reward (Q = 1.5)
    rlState.subjects['chimie'] = { qValue: 1.5, trials: 50 };
    mult = getRLMultiplier('chimie', rlState);
    // UCB ≈ 1.5 + 0.43 = 1.93
    // Boost = 1.0 + (1.93 * 0.5) = 1.965
    expect(mult).toBeGreaterThan(1.5);
    expect(mult).toBeLessThanOrEqual(2.5); // bounded
  });

  test('loadRLState and saveRLState work properly', () => {
    const tempFilePath = path.join(os.tmpdir(), `test_rl_${Date.now()}.json`);
    const mockState = {
      totalTrials: 5,
      subjects: {
        'histoire': { qValue: 0.2, trials: 5 }
      }
    };
    
    // Save
    saveRLState(mockState, tempFilePath);
    
    // Load
    const loadedState = loadRLState(tempFilePath);
    expect(loadedState.totalTrials).toBe(5);
    expect(loadedState.subjects['histoire'].qValue).toBe(0.2);
    
    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });
});
