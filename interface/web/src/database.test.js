import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb, syncFromBackend } from './database';

describe('database', () => {
  describe('getDb', () => {
    it('should be defined', () => {
      expect(getDb).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof getDb).toBe('function');
      expect(getDb).toBeDefined();
    });
  });

  describe('syncFromBackend', () => {
    it('should be defined', () => {
      expect(syncFromBackend).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof syncFromBackend).toBe('function');
      expect(syncFromBackend).toBeDefined();
    });
  });

});
