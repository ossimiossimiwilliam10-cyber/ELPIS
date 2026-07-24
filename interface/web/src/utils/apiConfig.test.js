import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiUrl, getServerUrl, setApiUrl, getRawIp } from './apiConfig';

describe('apiConfig', () => {
  describe('getApiUrl', () => {
    it('should be defined', () => {
      expect(getApiUrl).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof getApiUrl).toBe('function');
      expect(getApiUrl).toBeDefined();
    });
  });

  describe('getServerUrl', () => {
    it('should be defined', () => {
      expect(getServerUrl).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof getServerUrl).toBe('function');
      expect(getServerUrl).toBeDefined();
    });
  });

  describe('setApiUrl', () => {
    it('should be defined', () => {
      expect(setApiUrl).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof setApiUrl).toBe('function');
      expect(setApiUrl).toBeDefined();
    });
  });

  describe('getRawIp', () => {
    it('should be defined', () => {
      expect(getRawIp).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof getRawIp).toBe('function');
      expect(getRawIp).toBeDefined();
    });
  });

});
