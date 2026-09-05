import { describe, test, expect } from 'vitest';
import {
  PALIERS,
  CATEGORIES,
  CATEGORIE_DEFAUT,
  CATEGORIE_ETALON,
  clefLangue,
  categoriePour,
  facteurCategorie,
  paliersAjustes,
  heuresRelevees,
  normaliserHeuresAcquises,
  palierParCode,
  niveauLangue,
} from '../moteur/niveauLangue';

/** Séances de langue, toutes de même durée. */
const seances = (nombre, minutes, matiere = 'Anglais') =>
  Array.from({ length: nombre }, (_, i) => ({
    type: 'LANGUE',
    matiere,
    titre: 'Vocabulaire',
    dureeMinutes: minutes,
    timestamp: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T10:00:00`,
  }));

describe('Catégorie de difficulté', () => {
  test('les noms de langue se comparent sans accent ni casse', () => {
    expect(clefLangue('Coréen')).toBe('coreen');
    expect(clefLangue('  NÉERLANDAIS ')).toBe('neerlandais');
  });

  test('les langues courantes sont reconnues depuis leur nom', () => {
    expect(categoriePour('Espagnol')).toBe('I');
    expect(categoriePour('Allemand')).toBe('II');
    expect(categoriePour('Russe')).toBe('III');
    expect(categoriePour('Japonais')).toBe('IV');
  });

  test('une langue inconnue prend la catégorie par défaut', () => {
    expect(categoriePour('Klingon')).toBe(CATEGORIE_DEFAUT);
  });

  test('la catégorie déclarée l’emporte sur celle présumée', () => {
    expect(categoriePour('Espagnol', 'IV')).toBe('IV');
    expect(categoriePour('Espagnol', 'iv')).toBe('IV');
  });

  test('une catégorie invalide retombe sur la déduction', () => {
    expect(categoriePour('Japonais', 'XII')).toBe('IV');
    expect(categoriePour('Japonais', '')).toBe('IV');
  });

  test('la catégorie étalon n’étire pas l’échelle', () => {
    expect(facteurCategorie(CATEGORIE_ETALON)).toBe(1);
  });

  test('le facteur croît avec la distance à la langue', () => {
    expect(facteurCategorie('II')).toBeGreaterThan(facteurCategorie('I'));
    expect(facteurCategorie('III')).toBeGreaterThan(facteurCategorie('II'));
    expect(facteurCategorie('IV')).toBeGreaterThan(facteurCategorie('III'));
    // 2200 h contre 700 h : un peu plus du triple.
    expect(facteurCategorie('IV')).toBeCloseTo(CATEGORIES.IV.heures / CATEGORIES.I.heures, 5);
  });

  test('les paliers ajustés conservent la référence non étirée', () => {
    const ajustes = paliersAjustes('IV');
    const b1 = ajustes.find(p => p.code === 'B1');
    expect(b1.heuresReference).toBe(400);
    expect(b1.heures).toBe(Math.round(400 * facteurCategorie('IV')));
  });

  test('les paliers restent strictement croissants après ajustement', () => {
    for (const categorie of Object.keys(CATEGORIES)) {
      const heures = paliersAjustes(categorie).map(p => p.heures);
      const trie = [...heures].sort((a, b) => a - b);
      expect(heures).toEqual(trie);
    }
  });
});

describe('Heures relevées', () => {
  test('les séances de la langue sont cumulées et converties en heures', () => {
    expect(heuresRelevees('Anglais', seances(6, 20))).toBe(2);
  });

  test('les autres langues et les autres types sont ignorés', () => {
    const historique = [
      ...seances(3, 20, 'Espagnol'),
      { type: 'CM', matiere: 'Anglais', titre: 'Vocabulaire', dureeMinutes: 300, timestamp: '2026-08-01T10:00:00' },
    ];
    expect(heuresRelevees('Anglais', historique)).toBe(0);
  });

  test('une durée absente ou aberrante ne fausse pas le total', () => {
    const historique = [
      { type: 'LANGUE', matiere: 'Anglais', dureeMinutes: null, timestamp: '2026-08-01T10:00:00' },
      { type: 'LANGUE', matiere: 'Anglais', dureeMinutes: 'vingt', timestamp: '2026-08-02T10:00:00' },
      { type: 'LANGUE', matiere: 'Anglais', dureeMinutes: -50, timestamp: '2026-08-03T10:00:00' },
      { type: 'LANGUE', matiere: 'Anglais', dureeMinutes: 60, timestamp: '2026-08-04T10:00:00' },
    ];
    expect(heuresRelevees('Anglais', historique)).toBe(1);
  });

  test('un historique absent vaut zéro heure', () => {
    expect(heuresRelevees('Anglais', null)).toBe(0);
  });

  test('les heures acquises sont bornées et entières', () => {
    expect(normaliserHeuresAcquises(-10)).toBe(0);
    expect(normaliserHeuresAcquises('abc')).toBe(0);
    expect(normaliserHeuresAcquises(123.7)).toBe(124);
    expect(normaliserHeuresAcquises(99999)).toBe(20000);
  });
});

describe('Niveau estimé', () => {
  test('une langue sans aucune heure part du premier palier', () => {
    const n = niveauLangue({ nom: 'Anglais' }, []);
    expect(n.code).toBe('A0');
    expect(n.heures).toBe(0);
    expect(n.codeSuivant).toBe('A1');
  });

  test('les heures déclarées et les heures relevées s’additionnent', () => {
    const n = niveauLangue({ nom: 'Anglais', heuresAcquises: 250 }, seances(6, 20));
    expect(n.heuresAcquises).toBe(250);
    expect(n.heuresRelevees).toBe(2);
    expect(n.heures).toBe(252);
  });

  test('le palier suit les heures guidées du CECR pour une langue proche', () => {
    const pour = h => niveauLangue({ nom: 'Anglais', heuresAcquises: h }, []).code;
    expect(pour(50)).toBe('A0');
    expect(pour(100)).toBe('A1');
    expect(pour(250)).toBe('A2');
    expect(pour(450)).toBe('B1');
    expect(pour(650)).toBe('B2');
    expect(pour(900)).toBe('C1');
    expect(pour(1300)).toBe('C2');
  });

  test('une langue lointaine demande davantage d’heures pour le même palier', () => {
    // 250 heures : A2 en espagnol, encore le tout début en japonais.
    expect(niveauLangue({ nom: 'Espagnol', heuresAcquises: 250 }, []).code).toBe('A2');
    expect(niveauLangue({ nom: 'Japonais', heuresAcquises: 250 }, []).code).toBe('A0');
  });

  test('le niveau imposé remplace l’estimation sans effacer les heures', () => {
    const n = niveauLangue({ nom: 'Espagnol', heuresAcquises: 20, niveauImpose: 'C1' }, []);
    expect(n.code).toBe('C1');
    expect(n.impose).toBe(true);
    expect(n.heures).toBe(20);
  });

  test('un niveau imposé inconnu est ignoré', () => {
    const n = niveauLangue({ nom: 'Espagnol', heuresAcquises: 250, niveauImpose: 'Z9' }, []);
    expect(n.code).toBe('A2');
    expect(n.impose).toBe(false);
  });

  test('la progression se mesure entre le palier atteint et le suivant', () => {
    // A2 court de 200 à 400 heures : 300 heures, c'est la moitié.
    const n = niveauLangue({ nom: 'Anglais', heuresAcquises: 300 }, []);
    expect(n.code).toBe('A2');
    expect(n.progression).toBeCloseTo(0.5, 2);
    expect(n.heuresRestantes).toBe(100);
  });

  test('le dernier palier n’a pas de suite', () => {
    const n = niveauLangue({ nom: 'Anglais', heuresAcquises: 5000 }, []);
    expect(n.code).toBe('C2');
    expect(n.codeSuivant).toBeNull();
    expect(n.progression).toBe(1);
    expect(n.heuresRestantes).toBe(0);
  });

  test('chaque palier porte une description exploitable par un modèle', () => {
    for (const palier of PALIERS) {
      expect(palier.attendu.length).toBeGreaterThan(30);
    }
    expect(palierParCode('b2').code).toBe('B2');
    expect(palierParCode('inconnu')).toBeNull();
  });

  test('une langue vide ne fait pas tomber le calcul', () => {
    const n = niveauLangue(undefined, undefined);
    expect(n.code).toBe('A0');
    expect(n.categorie).toBe(CATEGORIE_DEFAUT);
  });
});
