import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

// Séquence complète de la méthode des J
const J_SEQUENCE = [0, 1, 3, 7, 14, 30, 60, 90, 180, 270, 365, 547, 730, 1095, 1460, 1825, 2190];

function calculateNextJ(currentJ) {
  const currentIndex = J_SEQUENCE.indexOf(currentJ);
  if (currentIndex === -1 || currentIndex === J_SEQUENCE.length - 1) {
    return currentJ;
  }
  return J_SEQUENCE[currentIndex + 1];
}

describe('Spaced Repetition Algorithm (Méthode des J)', () => {
  it('should advance from J0 to J1', () => {
    expect(calculateNextJ(0)).toBe(1);
  });

  it('should advance from J14 to J30', () => {
    expect(calculateNextJ(14)).toBe(30);
  });

  it('should handle the end of the sequence', () => {
    expect(calculateNextJ(2190)).toBe(2190);
  });

  it('should handle invalid input', () => {
    expect(calculateNextJ(999)).toBe(999);
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
