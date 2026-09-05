import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
// We test the pure functions by importing them directly
import { DEFAULT_CONFIG, validateConfigSchema, sanitize, loadConfig, saveConfig } from '../moteur/config';

const { db } = require('../db/setup');

beforeEach(() => {
  db.exec('DELETE FROM config');
});

afterEach(() => {
  db.exec('DELETE FROM config');
});

describe('Config Module - DEFAULT_CONFIG', () => {
  test('has all required fields', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('studyStartDate');
    expect(DEFAULT_CONFIG).toHaveProperty('bedtime');
    expect(DEFAULT_CONFIG).toHaveProperty('wakeUpTime');
    expect(DEFAULT_CONFIG).toHaveProperty('maxStudyHoursPerDay');
    expect(DEFAULT_CONFIG).toHaveProperty('maxSubjectsPerDay');
    expect(DEFAULT_CONFIG).toHaveProperty('defaultDurationNewCM');
    expect(DEFAULT_CONFIG).toHaveProperty('dernierePratiqueAnki');
    expect(DEFAULT_CONFIG).toHaveProperty('antiEnnuiMultiplier');
  });

  test('n’expose plus les objectifs de moyenne et de rang', () => {
    // Deux réglages hérités d'un modèle abandonné : aucun calcul ne les lisait,
    // aucun champ ne permettait de les modifier, et le seul endroit où ils
    // réapparaissaient laissait croire à une cible qu'on aurait choisie.
    expect(DEFAULT_CONFIG).not.toHaveProperty('targetGrade');
    expect(DEFAULT_CONFIG).not.toHaveProperty('targetRank');
    // Et surtout : un appareil non encore synchronisé les repousserait sans
    // cela au premier échange. Toute écriture les retire.
    expect(sanitize({ targetGrade: 25 })).not.toHaveProperty('targetGrade');
    expect(sanitize({ targetRank: 3 })).not.toHaveProperty('targetRank');
    saveConfig({ targetGrade: 18, targetRank: 1 });
    expect(loadConfig()).not.toHaveProperty('targetGrade');
    expect(loadConfig()).not.toHaveProperty('targetRank');
  });

  test('has sensible default values', () => {
    expect(DEFAULT_CONFIG.maxStudyHoursPerDay).toBe(8);
    expect(DEFAULT_CONFIG.defaultDurationNewCM).toBe(120);
    expect(DEFAULT_CONFIG.antiEnnuiMultiplier).toBe(2.0);
    expect(DEFAULT_CONFIG.dernierePratiqueAnki).toBe('');
    expect(DEFAULT_CONFIG.subjects).toEqual([]);
    expect(DEFAULT_CONFIG.fixedCommitments).toEqual([]);
    expect(DEFAULT_CONFIG.skippedRestDays).toEqual([]);
  });

  test('default subjects and fixedCommitments are empty arrays', () => {
    expect(Array.isArray(DEFAULT_CONFIG.subjects)).toBe(true);
    expect(Array.isArray(DEFAULT_CONFIG.fixedCommitments)).toBe(true);
    expect(Array.isArray(DEFAULT_CONFIG.restDays)).toBe(true);
  });
});

describe('Config Module - validateConfigSchema', () => {
  test('rejects null input', () => {
    expect(validateConfigSchema(null)).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(validateConfigSchema('string')).toBe(false);
    expect(validateConfigSchema(42)).toBe(false);
    expect(validateConfigSchema([])).toBe(false);
  });

  test('accepts valid config', () => {
    expect(validateConfigSchema({ maxStudyHoursPerDay: 8 })).toBe(true);
  });

  test('rejects out-of-range maxStudyHoursPerDay', () => {
    expect(validateConfigSchema({ maxStudyHoursPerDay: 25 })).toBe(false);
    expect(validateConfigSchema({ maxStudyHoursPerDay: -1 })).toBe(false);
  });

  test('rejects out-of-range defaultDurationNewCM', () => {
    expect(validateConfigSchema({ defaultDurationNewCM: 3 })).toBe(false);
    expect(validateConfigSchema({ defaultDurationNewCM: 601 })).toBe(false);
  });

  test('rejects non-array subjects', () => {
    expect(validateConfigSchema({ subjects: 'not an array' })).toBe(false);
  });

  test('rejects non-array fixedCommitments', () => {
    expect(validateConfigSchema({ fixedCommitments: {} })).toBe(false);
  });

  test('rejects non-array skippedRestDays', () => {
    expect(validateConfigSchema({ skippedRestDays: 'not array' })).toBe(false);
  });

  test('rejects non-array restDays', () => {
    expect(validateConfigSchema({ restDays: 123 })).toBe(false);
  });

  test('accepts empty object (uses defaults)', () => {
    expect(validateConfigSchema({})).toBe(true);
  });
});

describe('Config Module - sanitize', () => {
  test('clamps maxStudyHoursPerDay to 0-24', () => {
    const cfg = sanitize({ maxStudyHoursPerDay: 30 });
    expect(cfg.maxStudyHoursPerDay).toBe(24);
    
    const cfg2 = sanitize({ maxStudyHoursPerDay: -5 });
    expect(cfg2.maxStudyHoursPerDay).toBe(0);
  });

  test('applies defaults for missing fields', () => {
    const cfg = sanitize({});
    expect(cfg.maxStudyHoursPerDay).toBe(8);
    expect(cfg.defaultDurationNewCM).toBe(120);
    expect(cfg.pomoWork).toBe(25);
    expect(cfg.pomoBreak).toBe(5);
    expect(cfg.currentStreak).toBe(0);
    expect(cfg.bestStreak).toBe(0);
  });

  test('ensures subjects and fixedCommitments are arrays', () => {
    const cfg = sanitize({ subjects: null, fixedCommitments: undefined });
    expect(Array.isArray(cfg.subjects)).toBe(true);
    expect(Array.isArray(cfg.fixedCommitments)).toBe(true);
    expect(Array.isArray(cfg.restDays)).toBe(true);
  });

  test('clamps pomoWork to 5-120', () => {
    const cfg = sanitize({ pomoWork: 200 });
    expect(cfg.pomoWork).toBe(120);
    
    const cfg2 = sanitize({ pomoWork: 2 });
    expect(cfg2.pomoWork).toBe(5);
  });

  test('clamps pomoBreak to 1-60', () => {
    const cfg = sanitize({ pomoBreak: 100 });
    expect(cfg.pomoBreak).toBe(60);
    
    const cfg2 = sanitize({ pomoBreak: 0 });
    expect(cfg2.pomoBreak).toBe(1);
  });

  test('clamps antiEnnuiMultiplier to >= 1.0', () => {
    const cfg = sanitize({ antiEnnuiMultiplier: 0.5 });
    expect(cfg.antiEnnuiMultiplier).toBe(1.0);
  });

  test('validates theme', () => {
    const cfg = sanitize({ theme: 'invalid' });
    expect(cfg.theme).toBe('dark');
    
    const cfg2 = sanitize({ theme: 'light' });
    expect(cfg2.theme).toBe('light');
  });

  test('sanitizes currentStreak and bestStreak to non-negative', () => {
    const cfg = sanitize({ currentStreak: -5, bestStreak: -10 });
    expect(cfg.currentStreak).toBe(0);
    expect(cfg.bestStreak).toBe(0);
  });

  test('clamps duration fields', () => {
    const cfg = sanitize({ defaultDurationNewCM: 3 });
    expect(cfg.defaultDurationNewCM).toBe(5);
    
    const cfg2 = sanitize({ defaultDurationRevCM: 2 });
    expect(cfg2.defaultDurationRevCM).toBe(5);
  });
});

describe('Config Module - loadConfig', () => {
  test('returns defaults when db is empty', () => {
    const cfg = loadConfig();
    expect(cfg.maxStudyHoursPerDay).toBe(8);
  });

  test('loads and merges with defaults', () => {
    saveConfig({ maxSubjectsPerDay: 4 });
    const cfg = loadConfig();
    expect(cfg.maxSubjectsPerDay).toBe(4);
    expect(cfg.maxStudyHoursPerDay).toBe(8); // from defaults
  });
});

describe('Config Module - saveConfig', () => {
  test('saves config to disk', () => {
    const success = saveConfig({ maxSubjectsPerDay: 2 });
    expect(success).toBe(true);

    const loaded = loadConfig();
    expect(loaded.maxSubjectsPerDay).toBe(2);
  });

  test('preserves existing fields on partial update', () => {
    // First save a full config
    saveConfig({ maxSubjectsPerDay: 2, maxStudyHoursPerDay: 6 });
    // Then update only one field
    saveConfig({ maxSubjectsPerDay: 4 });

    const loaded = loadConfig();
    expect(loaded.maxSubjectsPerDay).toBe(4);
    expect(loaded.maxStudyHoursPerDay).toBe(6); // preserved from previous save
  });

  test('sanitizes values before saving', () => {
    saveConfig({ maxStudyHoursPerDay: 30 });
    const loaded = loadConfig();
    expect(loaded.maxStudyHoursPerDay).toBe(24); // clamped
  });
});
