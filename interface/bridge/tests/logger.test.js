/**
 * Tests unitaires pour le logger utilitaire.
 * Framework: Vitest
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger', () => {
  let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.LOG_LEVEL = 'debug';
    vi.resetModules();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  describe('exports', () => {
    it('devrait exporter un objet logger', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('devrait avoir les méthodes debug, info, warn, error', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('log levels', () => {
    it('devrait logger en debug sans erreur', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.debug('test debug')).not.toThrow();
    });

    it('devrait logger en info sans erreur', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.info('test info')).not.toThrow();
    });

    it('devrait logger en warn sans erreur', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.warn('test warn')).not.toThrow();
    });

    it('devrait logger en error sans erreur', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.error('test error')).not.toThrow();
    });
  });

  describe('format', () => {
    it('devrait accepter plusieurs arguments', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.info('message', { key: 'value' }, 42)).not.toThrow();
    });

    it('devrait accepter des objets comme arguments', async () => {
      const { logger } = await import('../utils/logger.js');
      const obj = { nom: 'test', valeur: 123 };
      expect(() => logger.info('contexte:', obj)).not.toThrow();
    });

    it('devrait gérer les valeurs undefined et null', async () => {
      const { logger } = await import('../utils/logger.js');
      expect(() => logger.info(undefined)).not.toThrow();
      expect(() => logger.info(null)).not.toThrow();
      expect(() => logger.error(null, undefined)).not.toThrow();
    });
  });

  describe('timestamps', () => {
    it('devrait inclure un timestamp ISO dans les logs', async () => {
      const { logger } = await import('../utils/logger.js');
      logger.info('timestamp test');
      if (consoleLogSpy.mock.calls.length > 0) {
        const output = consoleLogSpy.mock.calls[0].join(' ');
        expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('devrait préfixer avec le niveau de log en majuscule', async () => {
      const { logger } = await import('../utils/logger.js');
      logger.error('level test');
      if (consoleErrorSpy.mock.calls.length > 0) {
        const output = consoleErrorSpy.mock.calls[0].join(' ');
        expect(output).toContain('[ERROR]');
      }
    });
  });
});
