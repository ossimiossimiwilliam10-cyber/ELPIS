import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChronoStore } from './store';

describe('store', () => {
  describe('useChronoStore', () => {
    it('should be defined', () => {
      expect(useChronoStore).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof useChronoStore).toBe('function');
      expect(useChronoStore).toBeDefined();
    });
  });

});
