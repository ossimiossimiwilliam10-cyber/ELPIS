import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
// We test the pure functions by importing them directly
import { DEFAULT_CONFIG, validateConfigSchema, sanitize, loadConfig, saveConfig } from '../moteur/config';

const testDir = path.join(__dirname, 'temp_config_test');
const testConfigPath = path.join(testDir, 'espoir_config.json');

beforeEach(() => {
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  // Clean up any leftover files
  if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
  const tmp = testConfigPath + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
});

afterEach(() => {
  if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
  const tmp = testConfigPath + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
});

describe('Config Module - DEFAULT_CONFIG', () => {
  test('has all required fields', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('studyStartDate');
    expect(DEFAULT_CONFIG).toHaveProperty('bedtime');
    expect(DEFAULT_CONFIG).toHaveProperty('wakeUpTime');
    expect(DEFAULT_CONFIG).toHaveProperty('maxStudyHoursPerDay');
    expect(DEFAULT_CONFIG).toHaveProperty('targetGrade');
    expect(DEFAULT_CONFIG).toHaveProperty('maxSubjectsPerDay');
    expect(DEFAULT_CONFIG).toHaveProperty('defaultDurationNewCM');
    expect(DEFAULT_CONFIG).toHaveProperty('dernierePratiqueAnki');
    expect(DEFAULT_CONFIG).toHaveProperty('antiEnnuiMultiplier');
  });

  test('has sensible default values', () => {
    expect(DEFAULT_CONFIG.maxStudyHoursPerDay).toBe(8);
    expect(DEFAULT_CONFIG.targetGrade).toBe(14);
    expect(DEFAULT_CONFIG.defaultDurationNewCM).toBe(120);
    expect(DEFAULT_CONFIG.antiEnnuiMultiplier).toBe(2.0);
    expect(DEFAULT_CONFIG.dernierePratiqueAnki).toBe('');
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
    expect(validateConfigSchema({ maxStudyHoursPerDay: 8, targetGrade: 14 })).toBe(true);
  });

  test('rejects out-of-range maxStudyHoursPerDay', () => {
    expect(validateConfigSchema({ maxStudyHoursPerDay: 25 })).toBe(false);
    expect(validateConfigSchema({ maxStudyHoursPerDay: -1 })).toBe(false);
  });

  test('rejects out-of-range targetGrade', () => {
    expect(validateConfigSchema({ targetGrade: 21 })).toBe(false);
    expect(validateConfigSchema({ targetGrade: -1 })).toBe(false);
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

  test('clamps targetGrade to 0-20', () => {
    const cfg = sanitize({ targetGrade: 25 });
    expect(cfg.targetGrade).toBe(20);
  });

  test('applies defaults for missing fields', () => {
    const cfg = sanitize({});
    expect(cfg.maxStudyHoursPerDay).toBe(8);
    expect(cfg.targetGrade).toBe(14);
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
  test('returns defaults when file does not exist', () => {
    const cfg = loadConfig(testConfigPath);
    expect(cfg.maxStudyHoursPerDay).toBe(8);
    expect(cfg.targetGrade).toBe(14);
  });

  test('loads and merges with defaults', () => {
    fs.writeFileSync(testConfigPath, JSON.stringify({ targetGrade: 18 }));
    const cfg = loadConfig(testConfigPath);
    expect(cfg.targetGrade).toBe(18);
    expect(cfg.maxStudyHoursPerDay).toBe(8); // from defaults
  });

  test('handles corrupted JSON gracefully', () => {
    fs.writeFileSync(testConfigPath, 'not valid json {{{');
    const cfg = loadConfig(testConfigPath);
    expect(cfg.maxStudyHoursPerDay).toBe(8); // falls back to defaults
  });

  test('handles empty file gracefully', () => {
    fs.writeFileSync(testConfigPath, '');
    const cfg = loadConfig(testConfigPath);
    expect(cfg.maxStudyHoursPerDay).toBe(8);
  });
});

describe('Config Module - saveConfig', () => {
  test('saves config to disk', () => {
    const success = saveConfig({ targetGrade: 16 }, testConfigPath);
    expect(success).toBe(true);
    expect(fs.existsSync(testConfigPath)).toBe(true);
    
    const loaded = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    expect(loaded.targetGrade).toBe(16);
  });

  test('preserves existing fields on partial update', () => {
    // First save a full config
    saveConfig({ targetGrade: 16, maxStudyHoursPerDay: 6 }, testConfigPath);
    // Then update only one field
    saveConfig({ targetGrade: 18 }, testConfigPath);
    
    const loaded = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    expect(loaded.targetGrade).toBe(18);
    expect(loaded.maxStudyHoursPerDay).toBe(6); // preserved from previous save
  });

  test('sanitizes values before saving', () => {
    saveConfig({ maxStudyHoursPerDay: 30 }, testConfigPath);
    const loaded = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    expect(loaded.maxStudyHoursPerDay).toBe(24); // clamped
  });

  test('returns false on write error (invalid path)', () => {
    const success = saveConfig({}, '/invalid/path/that/does/not/exist/config.json');
    expect(success).toBe(false);
  });
});
