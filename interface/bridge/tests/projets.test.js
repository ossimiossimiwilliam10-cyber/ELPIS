import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadProjets, saveProjets } from '../moteur/projets';
const { db } = require('../db/setup');

describe('Projets Module', () => {
  beforeEach(() => {
    // Clear db
    db.exec('DELETE FROM projets');
  });

  test('loadProjets > returns empty array if no projets', () => {
    const data = loadProjets();
    expect(data).toEqual([]);
  });

  test('saveProjets > saves valid array and loadProjets reads it', () => {
    // La page produit `titre`, `dateFin` et `phases` ; ce test attendait `nom`,
    // vocabulaire d'un modèle abandonné dont la table avait gardé la trace — et
    // sur lequel tout enregistrement échouait.
    const fakeProjets = [
      { id: "p1", titre: "Projet Alpha", matiere: "Maths", phases: [] }
    ];

    const result = saveProjets(fakeProjets);
    expect(result).toBe(true);

    const data = loadProjets();
    expect(data.length).toBe(1);
    expect(data[0].titre).toBe("Projet Alpha");
  });

  test('saveProjets > rejects invalid (non-array) data', () => {
    const invalidData = { id: 1, nom: "Projet" };
    const result = saveProjets(invalidData);
    expect(result).toBe(false);
  });
});
