import { describe, test, expect, vi, afterEach } from 'vitest';
import * as aiAdapter from '../aiAdapter';
import fs from 'fs';
import path from 'path';

const { buildAIContext } = aiAdapter;

describe('AI Adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('buildAIContext assembles context from JSON files', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('espoir_config.json')) return '{"targetGrade": 15}';
      if (filePath.includes('espoir_cours.json')) return '{"licences": []}';
      if (filePath.includes('espoir_historique.json')) return '[{"type": "CM"}]';
      return '';
    });

    const context = buildAIContext('/fake/data/dir');
    expect(context).toContain('{"targetGrade": 15}');
    expect(context).toContain('{"licences": []}');
    expect(context).toContain('[{"type": "CM"}]');
  });

  test('buildAIContext handles missing files gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const context = buildAIContext('/fake/data/dir');
    expect(context).toContain('{}'); // Default for missing config/cours
    expect(context).toContain('[]'); // Default for missing history
  });
});
