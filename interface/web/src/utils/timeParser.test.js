import { describe, test, expect } from 'vitest';
import { parseTimeInput } from './timeParser';

describe('timeParser - parseTimeInput', () => {
  test('handles null and undefined', () => {
    expect(parseTimeInput(null)).toBeNull();
    expect(parseTimeInput(undefined)).toBeNull();
  });

  test('handles pure numbers', () => {
    expect(parseTimeInput(35)).toBe(35);
    expect(parseTimeInput(35.5)).toBe(35.5);
    expect(parseTimeInput(-5)).toBeNull(); // Negative not allowed
  });

  test('handles simple string numbers', () => {
    expect(parseTimeInput("35")).toBe(35);
    expect(parseTimeInput("35.5")).toBe(35.5);
    expect(parseTimeInput("35,5")).toBe(35.5); // French decimal
  });

  test('handles MM:SS format', () => {
    expect(parseTimeInput("35:44")).toBeCloseTo(35 + 44/60, 4);
    expect(parseTimeInput("05:30")).toBe(5.5);
    expect(parseTimeInput("120:00")).toBe(120);
  });

  test('handles natural language formats', () => {
    expect(parseTimeInput("35m44s")).toBeCloseTo(35 + 44/60, 4);
    expect(parseTimeInput("35m 44s")).toBeCloseTo(35 + 44/60, 4);
    expect(parseTimeInput("35 min et 44 sec")).toBeCloseTo(35 + 44/60, 4);
    expect(parseTimeInput("35 minutes et 44 secondes")).toBeCloseTo(35 + 44/60, 4);
  });

  test('handles invalid strings gracefully', () => {
    expect(parseTimeInput("hello")).toBeNull();
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("   ")).toBeNull();
    expect(parseTimeInput("-15")).toBeNull();
  });
});
