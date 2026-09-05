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

describe('Cours Module - aller-retour du coefficient', () => {
  /*
   * La colonne s'appelle `coef` en base et `coefficient` côté application. La
   * conversion écrasait un coefficient 0 explicite en NULL, puis relisait tout
   * NULL comme un 0 — si bien que « non renseigné » et « hors barème » se
   * confondaient. Depuis que le coefficient 0 exclut la matière de la moyenne
   * de son UE, la confusion ferait disparaître des matières d'un bulletin.
   */

  test('préserve un coefficient 0 explicite', () => {
    const cursus = { licences: [{ nom: "L", semestres: [{ nom: "S", ues: [{ nom: "U", ects: 6, matieres: [
      { nom: "Sport", coefficient: 0, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] }
    ] }] }] }] };
    expect(saveCours(cursus)).toBe(true);
    const m = loadCours().licences[0].semestres[0].ues[0].matieres[0];
    expect(m.coefficient).toBe(0);
  });

  test('laisse un coefficient absent absent, pour que le calcul applique son défaut', () => {
    const cursus = { licences: [{ nom: "L", semestres: [{ nom: "S", ues: [{ nom: "U", ects: 6, matieres: [
      { nom: "Maths", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] }
    ] }] }] }] };
    expect(saveCours(cursus)).toBe(true);
    const m = loadCours().licences[0].semestres[0].ues[0].matieres[0];
    expect(m.coefficient).toBeUndefined();
  });

  test('préserve un coefficient ordinaire', () => {
    const cursus = { licences: [{ nom: "L", semestres: [{ nom: "S", ues: [{ nom: "U", ects: 6, matieres: [
      { nom: "Analyse", coefficient: 3, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] }
    ] }] }] }] };
    expect(saveCours(cursus)).toBe(true);
    const m = loadCours().licences[0].semestres[0].ues[0].matieres[0];
    expect(m.coefficient).toBe(3);
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

describe('Cours Module - paquet Anki du chapitre', () => {
  /*
   * La colonne `ankiDeck` existait dans `cours_cm` et la relecture la rendait,
   * mais l'écriture l'omettait : le rattachement fait dans la Bibliothèque
   * disparaissait au premier enregistrement. Or c'est lui qui débloque la
   * validation d'un cours par une vraie épreuve Anki, au lieu d'une
   * auto-évaluation — ce que l'application propose explicitement.
   */
  test('conserve le paquet rattaché à un chapitre', () => {
    const cursus = { licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [
      { nom: 'Mécanique', listeCM: [{ titre: 'Ch1', ankiDeck: 'Physique::Mécanique::Ch1' }], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] };
    expect(saveCours(cursus)).toBe(true);

    const cm = loadCours().licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.ankiDeck).toBe('Physique::Mécanique::Ch1');
  });

  test('accepte un chapitre sans paquet', () => {
    const cursus = { licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [
      { nom: 'Mécanique', listeCM: [{ titre: 'Ch1' }], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] };
    expect(saveCours(cursus)).toBe(true);
    expect(loadCours().licences[0].semestres[0].ues[0].matieres[0].listeCM[0].ankiDeck).toBeNull();
  });
});
