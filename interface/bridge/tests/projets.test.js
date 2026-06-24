import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadProjets, saveProjets } from '../moteur/projets';

const TEMP_PROJETS_FILE = path.join(__dirname, 'test_espoir_projets.json');

describe('Projets Module', () => {
  
  beforeAll(() => {
    process.env.ELPIS_ROOT = __dirname;
  });

  afterAll(() => {
    delete process.env.ELPIS_ROOT;
    if (fs.existsSync(TEMP_PROJETS_FILE)) {
      fs.unlinkSync(TEMP_PROJETS_FILE);
    }
  });

  beforeEach(() => {
    if (fs.existsSync(TEMP_PROJETS_FILE)) {
      fs.unlinkSync(TEMP_PROJETS_FILE);
    }
  });

  test('loadProjets > returns empty array if file does not exist', () => {
    const targetFile = path.join(__dirname, 'espoir_projets.json');
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
    
    const data = loadProjets();
    expect(data).toEqual([]);
  });

  test('saveProjets > saves valid array and loadProjets reads it', () => {
    const fakeProjets = [
      { id: 1, titre: "Projet Alpha", phases: [{nom: "Recherche", active: true}] }
    ];
    
    const result = saveProjets(fakeProjets);
    expect(result).toBe(true);

    const data = loadProjets();
    expect(data.length).toBe(1);
    expect(data[0].titre).toBe("Projet Alpha");
  });

  test('saveProjets > rejects invalid (non-array) data', () => {
    const invalidData = { id: 1, titre: "Projet" };
    const result = saveProjets(invalidData);
    expect(result).toBe(false);
  });
});
