import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateCoursSchema, sanitizeCours, loadCours, saveCours } from '../moteur/cours';

const { db } = require('../db/setup');

beforeEach(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');
});

afterEach(() => {
  db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');
});

const validCours = {
  licences: [{
    nom: "Licence Test",
    semestres: [{
      nom: "Semestre 1",
      ues: [{
        nom: "UE1",
        ects: 6,
        matieres: [{
          nom: "Maths",
          coefficient: 2,
          listeCM: [{ titre: "Chapitre 1", jActuel: 0 }],
          listeTD: [{ titre: "TD1", nombrePratiques: 0 }],
          listeTP: [],
          listeAnnales: []
        }]
      }]
    }]
  }]
};

describe('Cours Module - validateCoursSchema', () => {
  test('rejects null input', () => {
    expect(validateCoursSchema(null)).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(validateCoursSchema('string')).toBe(false);
    expect(validateCoursSchema([])).toBe(false);
  });

  test('rejects missing licences', () => {
    expect(validateCoursSchema({})).toBe(false);
  });

  test('rejects non-array licences', () => {
    expect(validateCoursSchema({ licences: 'not-array' })).toBe(false);
  });

  test('accepts empty licences array', () => {
    expect(validateCoursSchema({ licences: [] })).toBe(true);
  });

  test('validates valid cours structure', () => {
    expect(validateCoursSchema(validCours)).toBe(true);
  });



  test('validates multiple licences', () => {
    const crs = {
      licences: [
        { nom: "L1", semestres: [{ ues: [{ matieres: [{ nom: "M1" }] }] }] },
        { nom: "L2", semestres: [{ ues: [{ matieres: [{ nom: "M2" }] }] }] }
      ]
    };
    expect(validateCoursSchema(crs)).toBe(true);
  });
});

describe('Cours Module - loadCours', () => {
  test('returns empty default if db is empty', () => {
    const crs = loadCours();
    expect(crs.licences).toEqual([]);
  });
});

describe('Cours Module - saveCours', () => {
  test('saves valid cours to db', () => {
    const success = saveCours(validCours);
    expect(success).toBe(true);
    
    const loaded = loadCours();
    expect(loaded.licences.length).toBe(1);
    expect(loaded.licences[0].nom).toBe("Licence Test");
  });

  test('rejects saving if licences is missing', () => {
    const success = saveCours({});
    expect(success).toBe(false);
  });

  test('rejects saving if licences is not an array', () => {
    const success = saveCours({ licences: 'invalid' });
    expect(success).toBe(false);
  });

  test('handles multiple licences', () => {
    const multiLicence = {
      licences: [
        { nom: "L1", semestres: [{ nom: "S1", ues: [{ nom: "U1", matieres: [{ nom: "M1", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] }] }] }] },
        { nom: "L2", semestres: [{ nom: "S2", ues: [{ nom: "U2", matieres: [{ nom: "M2", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] }] }] }] }
      ]
    };
    const success = saveCours(multiLicence);
    expect(success).toBe(true);
    
    const loaded = loadCours();
    expect(loaded.licences.length).toBe(2);
    expect(loaded.licences[0].nom).toBe("L1");
    expect(loaded.licences[1].nom).toBe("L2");
  });
});
