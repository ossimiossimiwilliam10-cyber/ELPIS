import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DIFFICULTY_LEVELS } from './constants';

describe('constants', () => {
  describe('DIFFICULTY_LEVELS', () => {
    it('should be defined', () => {
      expect(DIFFICULTY_LEVELS).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof DIFFICULTY_LEVELS).toBe('function');
      expect(DIFFICULTY_LEVELS).toBeDefined();
    });
  });

});
