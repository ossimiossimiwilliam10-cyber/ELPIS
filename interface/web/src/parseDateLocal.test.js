import { describe, it, expect } from 'vitest';
import { parseDateLocal } from './parseDateLocal';

describe('parseDateLocal', () => {
  // --- YYYY-MM-DD (HTML date input) ---
  it('should parse YYYY-MM-DD correctly', () => {
    const d = parseDateLocal('2026-06-15');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(d.getDate()).toBe(15);
  });

  it('should parse YYYY-MM-DD for January correctly', () => {
    const d = parseDateLocal('2027-01-01');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(1);
  });

  it('should parse YYYY-MM-DD for December correctly', () => {
    const d = parseDateLocal('2026-12-31');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(31);
  });

  // --- DD-MM-YYYY (legacy / factory reset) ---
  it('should parse DD-MM-YYYY correctly', () => {
    const d = parseDateLocal('15-01-2027');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(15);
  });

  it('should parse DD-MM-YYYY for study start date', () => {
    const d = parseDateLocal('07-09-2026');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September
    expect(d.getDate()).toBe(7);
  });

  // Note: XX-XX-XXXX is inherently ambiguous (DD-MM-YYYY vs MM-DD-YYYY).
  // We treat it as DD-MM-YYYY (French/European convention).
  it('should treat XX-XX-XXXX as DD-MM-YYYY (European convention)', () => {
    const d = parseDateLocal('12-06-2026');
    expect(d).not.toBeNull();
    expect(d.getDate()).toBe(12);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getFullYear()).toBe(2026);
  });

  // --- Edge cases: null/undefined/empty ---
  it('should return null for empty string', () => {
    expect(parseDateLocal('')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseDateLocal(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(parseDateLocal(undefined)).toBeNull();
  });

  it('should return null for non-string input (number)', () => {
    expect(parseDateLocal(12345)).toBeNull();
  });

  // --- Invalid formats ---
  it('should return null for invalid format', () => {
    expect(parseDateLocal('not-a-date')).toBeNull();
  });

  it('should return null for YYYY/MM/DD (wrong separator)', () => {
    expect(parseDateLocal('2026/06/15')).toBeNull();
  });

  it('should return null for YYYYMMDD (no separators)', () => {
    expect(parseDateLocal('20260615')).toBeNull();
  });

  // --- Consistency: both formats parse to same local midnight ---
  it('should produce identical dates for equivalent YYYY-MM-DD and DD-MM-YYYY', () => {
    const d1 = parseDateLocal('2026-09-07');
    const d2 = parseDateLocal('07-09-2026');
    expect(d1.getTime()).toBe(d2.getTime());
  });

  it('should be at local midnight (hours=0, minutes=0)', () => {
    const d = parseDateLocal('2026-06-15');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  // --- Whitespace handling ---
  it('should trim whitespace', () => {
    const d = parseDateLocal('  2026-06-15  ');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });
});
