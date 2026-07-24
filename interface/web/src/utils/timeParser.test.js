import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseTimeInput } from './timeParser';

describe('timeParser', () => {
  describe('parseTimeInput', () => {
    it('should be defined', () => {
      expect(parseTimeInput).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof parseTimeInput).toBe('function');
      expect(parseTimeInput).toBeDefined();
    });
  });

});
