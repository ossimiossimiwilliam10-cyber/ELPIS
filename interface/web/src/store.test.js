import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

// SM-2 Algorithm tests
function mockCalculateSM2(score, previousInterval = 0, easeFactor = 2.5, repetitions = 0) {
  let newEaseFactor = easeFactor;
  let newRepetitions = repetitions;
  let newInterval = previousInterval;

  if (score === 1) {
    // Fail
    newRepetitions = 0;
    newInterval = 1;
    newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
  } else {
    if (score === 2) {
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.15);
    } else if (score === 4) {
      newEaseFactor += 0.15;
    }

    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 3;
    } else {
      newInterval = Math.round(previousInterval * newEaseFactor);
      if (score === 4) {
        newInterval = Math.round(newInterval * 1.3);
      }
    }
    newRepetitions += 1;
  }

  return { interval: newInterval, easeFactor: newEaseFactor, repetitions: newRepetitions };
}

describe('SM-2 Spaced Repetition Algorithm', () => {
  it('should reset on fail (score=1)', () => {
    const result = mockCalculateSM2(1, 30, 2.5, 3);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it('should start with interval 1 on first success (reps=0)', () => {
    const result = mockCalculateSM2(3, 0, 2.5, 0);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('should jump to 3 days on second success (reps=1)', () => {
    const result = mockCalculateSM2(3, 1, 2.5, 1);
    expect(result.interval).toBe(3);
    expect(result.repetitions).toBe(2);
  });

  it('should grow by easeFactor after reps >= 2', () => {
    // EF=2.5, prevInterval=3 → 3 * 2.5 = 7.5 → 8
    const result = mockCalculateSM2(3, 3, 2.5, 2);
    expect(result.interval).toBe(8);
    expect(result.repetitions).toBe(3);
  });

  it('should boost interval for perfect score (4)', () => {
    // EF=2.5, prevInterval=8 → 8 * 2.5 = 20 → 20 * 1.3 = 26
    const result = mockCalculateSM2(4, 8, 2.5, 3);
    expect(result.interval).toBe(26);
  });

  it('should decrease easeFactor on hard (score=2)', () => {
    const result = mockCalculateSM2(2, 10, 2.5, 2);
    expect(result.easeFactor).toBeCloseTo(2.35, 1);
  });

  it('should handle defaults for old CMs (no easeFactor/repetitions)', () => {
    const result = mockCalculateSM2(3, 0, 2.5, 0);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(result.repetitions).toBe(1);
  });
});

describe('Store Logic Mock', () => {
  it('should update activeTab', () => {
    const useStore = create((set) => ({
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab })
    }));

    const state = useStore.getState();
    expect(state.activeTab).toBe('dashboard');
    
    state.setActiveTab('cours');
    expect(useStore.getState().activeTab).toBe('cours');
  });
});
