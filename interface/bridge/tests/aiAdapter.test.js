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
      if (filePath.endsWith('espoir_config.json')) return '{"targetGrade": 15}';
      if (filePath.endsWith('espoir_cours.json')) return '{"licences": []}';
      if (filePath.endsWith('espoir_historique.json')) return `[{"type": "CM", "timestamp": "${new Date().toISOString()}"}]`;
      return '';
    });

    const context = buildAIContext('/fake/data/dir');
    expect(context).toContain('{"targetGrade": 15}');
    expect(context).toContain('{"licences":[]}');
    expect(context).toContain('"type":"CM"');
  });

  test('buildAIContext handles missing files gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const context = buildAIContext('/fake/data/dir');
    expect(context).toContain('{}'); // Default for missing config/cours
    expect(context).toContain('[]'); // Default for missing history
  });
});
