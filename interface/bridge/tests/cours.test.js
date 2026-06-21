import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateCoursSchema, sanitizeCours, loadCours, saveCours } from '../moteur/cours';

const testDir = path.join(__dirname, 'temp_cours_test');
const testCoursPath = path.join(testDir, 'espoir_cours.json');

beforeEach(() => {
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  if (fs.existsSync(testCoursPath)) fs.unlinkSync(testCoursPath);
  const tmp = testCoursPath + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
});

afterEach(() => {
  if (fs.existsSync(testCoursPath)) fs.unlinkSync(testCoursPath);
  const tmp = testCoursPath + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  if (fs.existsSync(testDir)) fs.rmdirSync(testDir, { recursive: true });
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

  test('rejects licence without semestres', () => {
    const crs = { licences: [{}] };
    expect(validateCoursSchema(crs)).toBe(false);
  });

  test('rejects semestre without ues', () => {
    const crs = { licences: [{ semestres: [{}] }] };
    expect(validateCoursSchema(crs)).toBe(false);
  });

  test('rejects ue without matieres', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{}]
        }]
      }]
    };
    expect(validateCoursSchema(crs)).toBe(false);
  });

  test('rejects invalid licence entry', () => {
    const crs = { licences: [null] };
    expect(validateCoursSchema(crs)).toBe(false);
  });

  test('rejects invalid ue entry', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [null]
        }]
      }]
    };
    expect(validateCoursSchema(crs)).toBe(false);
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

describe('Cours Module - sanitizeCours', () => {
  test('handles legacy semestres at root level', () => {
    const legacy = {
      semestres: [{ ues: [{ matieres: [{ nom: "Maths" }] }] }]
    };
    const sanitized = sanitizeCours(legacy);
    expect(sanitized.licences).toBeDefined();
    expect(sanitized.licences.length).toBe(1);
    expect(sanitized.licences[0].nom).toBe("Licence 1");
    expect(sanitized.semestres).toBeUndefined(); // legacy field removed
  });

  test('creates empty licences if missing', () => {
    const sanitized = sanitizeCours({});
    expect(Array.isArray(sanitized.licences)).toBe(true);
    expect(sanitized.licences.length).toBe(0);
  });

  test('sanitizes UE ects to 0-180 range', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [
            { ects: 200, matieres: [{ nom: "M1" }] },
            { ects: -10, matieres: [{ nom: "M2" }] }
          ]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    expect(sanitized.licences[0].semestres[0].ues[0].ects).toBe(180);
    expect(sanitized.licences[0].semestres[0].ues[1].ects).toBe(0);
  });

  test('sanitizes cm_h/td_h/tp_h to 0-500 range', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{ nom: "M1", cm_h: 600, td_h: -5, tp_h: 1000 }]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    const m = sanitized.licences[0].semestres[0].ues[0].matieres[0];
    expect(m.cm_h).toBe(500);
    expect(m.td_h).toBe(0);
    expect(m.tp_h).toBe(500);
  });

  test('sanitizes coefficient to 1-10 range', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [
              { nom: "M1", coefficient: 0 },
              { nom: "M2", coefficient: 15 },
              { nom: "M3" } // missing
            ]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    const matieres = sanitized.licences[0].semestres[0].ues[0].matieres;
    expect(matieres[0].coefficient).toBe(1);
    expect(matieres[1].coefficient).toBe(10);
    expect(matieres[2].coefficient).toBe(1); // default
  });

  test('creates empty arrays for missing lists', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{ nom: "M1" }]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    const m = sanitized.licences[0].semestres[0].ues[0].matieres[0];
    expect(Array.isArray(m.listeCM)).toBe(true);
    expect(Array.isArray(m.listeTD)).toBe(true);
    expect(Array.isArray(m.listeTP)).toBe(true);
    expect(Array.isArray(m.listeAnnales)).toBe(true);
  });

  test('sanitizes CM jActuel to 0-3000 range', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{
              nom: "M1",
              listeCM: [{ titre: "CM1", jActuel: 5000 }]
            }]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    expect(sanitized.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].jActuel).toBe(3000);
  });

  test('sets derniereRevision for active CMs that lack it', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{
              nom: "M1",
              listeCM: [{ titre: "CM1", jActuel: 5 }]
            }]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    const cm = sanitized.licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.derniereRevision).toBeDefined();
    expect(cm.derniereRevision).not.toBe('');
  });

  test('sanitizes TD/TP/Annales page and nombrePratiques', () => {
    const crs = {
      licences: [{
        semestres: [{
          ues: [{
            matieres: [{
              nom: "M1",
              listeTD: [{ titre: "TD1", page: 0, nombrePratiques: -5 }],
              listeTP: [{ titre: "TP1", page: 20000, nombrePratiques: 50000 }],
              listeAnnales: [{ titre: "A1", page: -3 }]
            }]
          }]
        }]
      }]
    };
    const sanitized = sanitizeCours(crs);
    const td = sanitized.licences[0].semestres[0].ues[0].matieres[0].listeTD[0];
    expect(td.page).toBe(1);
    expect(td.nombrePratiques).toBe(0);
    
    const tp = sanitized.licences[0].semestres[0].ues[0].matieres[0].listeTP[0];
    expect(tp.page).toBe(9999);
    expect(tp.nombrePratiques).toBe(10000);
  });

  test('removes legacy semestres at root level', () => {
    const crs = {
      licences: [{ semestres: [{ ues: [{ matieres: [{ nom: "M1" }] }] }] }],
      semestres: "should be removed"
    };
    const sanitized = sanitizeCours(crs);
    expect(sanitized.semestres).toBeUndefined();
  });

  test('default licence name if missing', () => {
    const crs = {
      licences: [{ semestres: [{ ues: [{ matieres: [{ nom: "M1" }] }] }] }]
    };
    const sanitized = sanitizeCours(crs);
    expect(sanitized.licences[0].nom).toBe("Nouvelle Licence");
  });
});

describe('Cours Module - loadCours', () => {
  test('returns empty licences when file does not exist', () => {
    const crs = loadCours(testCoursPath);
    expect(crs.licences).toEqual([]);
  });

  test('loads and sanitizes valid cours file', () => {
    fs.writeFileSync(testCoursPath, JSON.stringify(validCours));
    const crs = loadCours(testCoursPath);
    expect(crs.licences.length).toBe(1);
    expect(crs.licences[0].nom).toBe("Licence Test");
  });

  test('handles corrupted JSON by returning empty fallback', () => {
    fs.writeFileSync(testCoursPath, '{{corrupted}');
    const crs = loadCours(testCoursPath);
    expect(crs.licences).toEqual([]);
  });

  test('handles empty file', () => {
    fs.writeFileSync(testCoursPath, '');
    const crs = loadCours(testCoursPath);
    expect(crs.licences).toEqual([]);
  });
});

describe('Cours Module - saveCours', () => {
  test('saves valid cours to disk', () => {
    const success = saveCours(validCours, testCoursPath);
    expect(success).toBe(true);
    expect(fs.existsSync(testCoursPath)).toBe(true);
    
    const loaded = JSON.parse(fs.readFileSync(testCoursPath, 'utf8'));
    expect(loaded.licences.length).toBe(1);
  });

  test('rejects saving if licences is missing', () => {
    const success = saveCours({}, testCoursPath);
    expect(success).toBe(false);
  });

  test('rejects saving if licences is not an array', () => {
    const success = saveCours({ licences: 'invalid' }, testCoursPath);
    expect(success).toBe(false);
  });

  test('deep merges: preserves FSRS data when frontend sends partial update', () => {
    // First save avec FSRS data
    const initialCours = JSON.parse(JSON.stringify(validCours));
    initialCours.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].fsrsCard = {
      stability: 15.5,
      difficulty: 4.2,
      state: 2
    };
    initialCours.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].tempsMoyen = 45;
    saveCours(initialCours, testCoursPath);

    // Puis update partiel (le frontend envoie un titre modifié sans fsrsCard)
    const partialUpdate = JSON.parse(JSON.stringify(validCours));
    partialUpdate.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].titre = "Chapitre 1 - Modifié";
    // Le frontend n'envoie PAS fsrsCard ni tempsMoyen
    delete partialUpdate.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].fsrsCard;
    delete partialUpdate.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].tempsMoyen;

    saveCours(partialUpdate, testCoursPath);

    const loaded = JSON.parse(fs.readFileSync(testCoursPath, 'utf8'));
    const cm = loaded.licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.titre).toBe("Chapitre 1 - Modifié"); // updated
    expect(cm.fsrsCard).toBeDefined(); // preserved from deep merge
    expect(cm.fsrsCard.stability).toBe(15.5);
    expect(cm.tempsMoyen).toBe(45); // preserved
  });

  test('returns false on write error (invalid path)', () => {
    const success = saveCours(validCours, '/invalid/path/that/does/not/exist/cours.json');
    expect(success).toBe(false);
  });

  test('atomically writes: tmp file is cleaned up', () => {
    saveCours(validCours, testCoursPath);
    const tmpPath = testCoursPath + '.tmp';
    expect(fs.existsSync(tmpPath)).toBe(false);
    expect(fs.existsSync(testCoursPath)).toBe(true);
  });

  test('handles multiple licences', () => {
    const multiLicence = {
      licences: [
        { nom: "L1", semestres: [{ ues: [{ matieres: [{ nom: "M1" }] }] }] },
        { nom: "L2", semestres: [{ ues: [{ matieres: [{ nom: "M2" }] }] }] }
      ]
    };
    const success = saveCours(multiLicence, testCoursPath);
    expect(success).toBe(true);
    
    const loaded = JSON.parse(fs.readFileSync(testCoursPath, 'utf8'));
    expect(loaded.licences.length).toBe(2);
    expect(loaded.licences[0].nom).toBe("L1");
    expect(loaded.licences[1].nom).toBe("L2");
  });
});
