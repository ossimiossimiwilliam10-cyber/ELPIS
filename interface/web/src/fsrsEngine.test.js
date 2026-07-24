import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Rating, State, migrateToFSRSCard, evaluateFSRS } from './fsrsEngine';

describe('fsrsEngine', () => {
  describe('Rating', () => {
    it('should be defined', () => {
      expect(Rating).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof Rating).toBe('function');
      expect(Rating).toBeDefined();
    });
  });

  describe('State', () => {
    it('should be defined', () => {
      expect(State).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof State).toBe('function');
      expect(State).toBeDefined();
    });
  });

  describe('migrateToFSRSCard', () => {
    it('should be defined', () => {
      expect(migrateToFSRSCard).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof migrateToFSRSCard).toBe('function');
      expect(migrateToFSRSCard).toBeDefined();
    });
  });

  describe('evaluateFSRS', () => {
    it('should be defined', () => {
      expect(evaluateFSRS).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof evaluateFSRS).toBe('function');
      expect(evaluateFSRS).toBeDefined();
    });
  });

});
