import { describe, it, expect } from 'vitest';
import {
  construireChargeCognitive, difficulteDe, difficulteMatiere,
  regrouperEnTrois, centreLePlusProche, releverMatieres,
  SEUIL_LOURD, SEUIL_LEGER,
} from '../moteur/chargeCognitive';

const cours = (extra = {}) => ({ titre: 'CM', ...extra });
const dur = (difficulty) => cours({ fsrsCard: { difficulty } });

const cursusAvec = (matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

describe('difficulteDe', () => {
  it('lit la difficulté FSRS quand elle existe', () => {
    expect(difficulteDe(dur(7.5))).toBe(7.5);
  });

  it('convertit le facteur de facilité des cours d\'avant la migration', () => {
    // ef = (10 − d) / 4 + 1,3, donc d = 10 − (ef − 1,3) × 4.
    expect(difficulteDe(cours({ easeFactor: 2.5 }))).toBeCloseTo(5.2, 5);
    expect(difficulteDe(cours({ easeFactor: 3.55 }))).toBeCloseTo(1, 5);
  });

  it('reste dans l\'échelle même sur une valeur aberrante', () => {
    const d = difficulteDe(cours({ easeFactor: 99 }));
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(10);
  });

  it('distingue « pas encore évalué » d\'une difficulté nulle', () => {
    expect(difficulteDe(cours())).toBeNull();
    expect(difficulteDe(cours({ fsrsCard: {} }))).toBeNull();
  });
});

describe('difficulteMatiere', () => {
  it('moyenne les cours évalués', () => {
    expect(difficulteMatiere({ listeCM: [dur(4), dur(8)] })).toBe(6);
  });

  it('ignore les cours non évalués au lieu de les compter au milieu', () => {
    // Régression : une matière sans donnée recevait 2,5, valeur inventée qui
    // la plaçait au centre du classement comme si on l'avait mesurée.
    expect(difficulteMatiere({ listeCM: [dur(9), cours(), cours()] })).toBe(9);
    expect(difficulteMatiere({ listeCM: [cours()] })).toBeNull();
    expect(difficulteMatiere({})).toBeNull();
  });
});

describe('regrouperEnTrois', () => {
  it('trie numériquement, pas alphabétiquement', () => {
    // Régression : `[2.5, 10, 3].sort()` rend `["10", "2.5", "3"]`. Les centres
    // partaient donc de valeurs choisies dans le mauvais ordre.
    const centres = regrouperEnTrois([2, 3, 10, 1, 9, 8]);
    expect(centres[0]).toBeLessThan(centres[1]);
    expect(centres[1]).toBeLessThan(centres[2]);
    expect(centres[0]).toBeLessThan(5);
    expect(centres[2]).toBeGreaterThan(5);
  });

  it('sépare trois groupes nettement distincts', () => {
    const centres = regrouperEnTrois([1, 1.2, 5, 5.1, 9, 9.3]);
    expect(centres[0]).toBeCloseTo(1.1, 1);
    expect(centres[1]).toBeCloseTo(5.05, 1);
    expect(centres[2]).toBeCloseTo(9.15, 1);
  });

  it('ne s\'effondre pas quand toutes les valeurs coïncident', () => {
    const centres = regrouperEnTrois([5, 5, 5, 5]);
    expect(centres.every(c => Number.isFinite(c))).toBe(true);
    expect(centres.every(c => c === 5)).toBe(true);
  });

  it('rend un résultat identique d\'un appel à l\'autre', () => {
    const valeurs = [3, 7, 2, 8, 5, 6, 1];
    expect(regrouperEnTrois(valeurs)).toEqual(regrouperEnTrois([...valeurs].reverse()));
  });
});

describe('centreLePlusProche', () => {
  it('retient le centre le plus proche', () => {
    expect(centreLePlusProche(1.2, [1, 5, 9])).toBe(0);
    expect(centreLePlusProche(8.5, [1, 5, 9])).toBe(2);
  });

  it('tranche les égalités vers le plus petit indice', () => {
    expect(centreLePlusProche(3, [1, 5, 9])).toBe(0);
  });
});

describe('releverMatieres', () => {
  it('parcourt le cursus actif', () => {
    const releve = releverMatieres(cursusAvec([
      { nom: 'Algèbre', listeCM: [dur(4)] },
      { nom: 'Analyse', listeCM: [] },
    ]));
    expect(releve.map(m => m.nom)).toEqual(['Algèbre', 'Analyse']);
    expect(releve[1].difficulte).toBeNull();
  });

  it('ignore une licence ou un semestre archivé', () => {
    const cursus = cursusAvec([{ nom: 'Algèbre', listeCM: [dur(4)] }]);
    cursus.licences[0].archived = true;
    expect(releverMatieres(cursus)).toEqual([]);
  });

  it('survit à un cursus absent', () => {
    expect(releverMatieres(null)).toEqual([]);
  });
});

describe('construireChargeCognitive', () => {
  it('répartit les matières entre le matin et le soir', () => {
    const carte = construireChargeCognitive(cursusAvec([
      { nom: 'Quantique', listeCM: [dur(9), dur(9.5)] },
      { nom: 'Thermo', listeCM: [dur(5), dur(5.2)] },
      { nom: 'Anglais', listeCM: [dur(1.5), dur(2)] },
    ]));

    expect(carte['quantique'].cognitiveLoad).toBe('heavy');
    expect(carte['thermo'].cognitiveLoad).toBe('medium');
    expect(carte['anglais'].cognitiveLoad).toBe('light');
  });

  it('écarte du classement les matières jamais évaluées', () => {
    const carte = construireChargeCognitive(cursusAvec([
      { nom: 'Quantique', listeCM: [dur(9)] },
      { nom: 'Thermo', listeCM: [dur(5)] },
      { nom: 'Anglais', listeCM: [dur(2)] },
      { nom: 'Neuve', listeCM: [cours()] },
    ]));

    expect(carte['neuve'].cognitiveLoad).toBe('inconnue');
    expect(carte['neuve'].difficulte).toBeNull();
  });

  it('applique des seuils fixes quand trop peu de matières sont mesurées', () => {
    const carte = construireChargeCognitive(cursusAvec([
      { nom: 'Ardue', listeCM: [dur(SEUIL_LOURD + 1)] },
      { nom: 'Facile', listeCM: [dur(SEUIL_LEGER - 1)] },
    ]));
    expect(carte['ardue'].cognitiveLoad).toBe('heavy');
    expect(carte['facile'].cognitiveLoad).toBe('light');
  });

  it('conserve le facteur de facilité pour les consommateurs antérieurs', () => {
    const carte = construireChargeCognitive(cursusAvec([{ nom: 'Algèbre', listeCM: [dur(5.2)] }]));
    expect(carte['algèbre'].avgEaseFactor).toBeCloseTo(2.5, 1);
  });

  it('n\'attribue jamais NaN', () => {
    const carte = construireChargeCognitive(cursusAvec([
      { nom: 'Bruit', listeCM: [cours({ fsrsCard: { difficulty: 'oui' } }), cours({ easeFactor: null })] },
    ]));
    expect(carte['bruit'].difficulte).toBeNull();
    expect(carte['bruit'].cognitiveLoad).toBe('inconnue');
  });

  it('survit à un cursus vide', () => {
    expect(construireChargeCognitive({ licences: [] })).toEqual({});
    expect(construireChargeCognitive(null)).toEqual({});
  });
});
