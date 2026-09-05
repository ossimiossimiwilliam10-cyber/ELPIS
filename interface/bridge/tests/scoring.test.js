/**
 * Tests unitaires pour le module de scoring.
 * Teste les fonctions pures sans dépendances externes.
 * Framework: Vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock des dépendances avant l'import
vi.mock('../moteur/intelligence.js', () => ({
  getMatiereAverage: vi.fn()
}));
vi.mock('../moteur/rlEngine.js', () => ({
  getRLMultiplier: vi.fn()
}));

const {
  fuzzyLookupExamUrgency,
  getDifficultyMultiplier,
  getPrioScore,
  getSubjectExamBoost,
  getAdaptiveWeight,
  getCapitalisedUEs
} = await import('../moteur/scoring.js');

const { getMatiereAverage } = await import('../moteur/intelligence.js');
const { getRLMultiplier } = await import('../moteur/rlEngine.js');

describe('fuzzyLookupExamUrgency', () => {
  const urgencyMap = {
    'algèbre': { multiplier: 2.0, daysToExam: 5 },
    'analyse': { multiplier: 1.5, daysToExam: 20 },
    'physique quantique': { multiplier: 3.0, daysToExam: 2 },
    'mathématiques appliquées': { multiplier: 1.8, daysToExam: 15 }
  };

  it('devrait retourner la correspondance exacte (insensible à la casse)', () => {
    const result = fuzzyLookupExamUrgency(urgencyMap, 'Algèbre');
    expect(result).toEqual({ multiplier: 2.0, daysToExam: 5 });
  });

  it('devrait retourner undefined si la map est vide', () => {
    expect(fuzzyLookupExamUrgency({}, 'test')).toBeUndefined();
  });

  it('devrait retourner undefined si la map est null/undefined', () => {
    expect(fuzzyLookupExamUrgency(null, 'test')).toBeUndefined();
    expect(fuzzyLookupExamUrgency(undefined, 'test')).toBeUndefined();
  });

  it('devrait retourner undefined si le nom est null/undefined', () => {
    expect(fuzzyLookupExamUrgency(urgencyMap, null)).toBeUndefined();
    expect(fuzzyLookupExamUrgency(urgencyMap, undefined)).toBeUndefined();
  });

  it('devrait retourner undefined si le nom est vide', () => {
    expect(fuzzyLookupExamUrgency(urgencyMap, '')).toBeUndefined();
    expect(fuzzyLookupExamUrgency(urgencyMap, '   ')).toBeUndefined();
  });

  it('devrait faire un fuzzy match sur le début du nom', () => {
    const result = fuzzyLookupExamUrgency(urgencyMap, 'algèbre linéaire');
    expect(result).toEqual({ multiplier: 2.0, daysToExam: 5 });
  });

  it('devrait faire un fuzzy match quand la clé commence par le nom', () => {
    const result = fuzzyLookupExamUrgency(urgencyMap, 'physique');
    expect(result).toEqual({ multiplier: 3.0, daysToExam: 2 });
  });

  it('devrait retourner undefined si aucun match trouvé', () => {
    const result = fuzzyLookupExamUrgency(urgencyMap, 'zébulon');
    expect(result).toBeUndefined();
  });
});

describe('getDifficultyMultiplier', () => {
  it.each([
    ['difficile', 1.5],
    ['assez_difficile', 1.2],
    ['moyen', 1.0],
    ['facile', 0.8],
    ['tres_facile', 0.5],
    ['inconnue', 1.0],
    [undefined, 1.0],
    [null, 1.0],
    ['', 1.0],
  ])('devrait retourner %s pour la difficulté %s', (diff, expected) => {
    expect(getDifficultyMultiplier(diff)).toBe(expected);
  });
});

describe('getPrioScore', () => {
  const basicEx = { nombrePratiques: 0, difficulte: 'moyen' };
  const urgencyMap = { 'maths': { multiplier: 2.0, daysToExam: 5 } };

  beforeEach(() => {
    vi.clearAllMocks();
    getMatiereAverage.mockReturnValue(null);
    getRLMultiplier.mockReturnValue(1.0);
  });

  it('devrait retourner un nombre positif', () => {
    const score = getPrioScore(basicEx, {}, 'Maths');
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('devrait donner un score plus élevé pour un exercice jamais pratiqué', () => {
    const newEx = { nombrePratiques: 0, difficulte: 'moyen' };
    const practicedEx = { nombrePratiques: 10, difficulte: 'moyen' };
    const scoreNew = getPrioScore(newEx, {}, 'Maths');
    const scorePracticed = getPrioScore(practicedEx, {}, 'Maths');
    expect(scoreNew).toBeGreaterThan(scorePracticed);
  });

  it('devrait donner un score plus élevé pour un exercice difficile', () => {
    const easyEx = { nombrePratiques: 0, difficulte: 'tres_facile' };
    const hardEx = { nombrePratiques: 0, difficulte: 'difficile' };
    const scoreEasy = getPrioScore(easyEx, {}, 'Maths');
    const scoreHard = getPrioScore(hardEx, {}, 'Maths');
    expect(scoreHard).toBeGreaterThan(scoreEasy);
  });

  it('devrait appliquer un boost urgence examen', () => {
    const scoreWithout = getPrioScore(basicEx, {}, 'Maths');
    const scoreWith = getPrioScore(basicEx, urgencyMap, 'Maths');
    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });

  it('devrait gérer nombrePratiques undefined', () => {
    const ex = { difficulte: 'moyen' };
    expect(() => getPrioScore(ex, {}, 'Maths')).not.toThrow();
  });

  it('devrait gérer matiere comme string', () => {
    expect(() => getPrioScore(basicEx, urgencyMap, 'Maths')).not.toThrow();
  });

  it('devrait gérer matiere comme objet avec nom', () => {
    const matiere = { nom: 'Maths', coefficient: 2 };
    expect(() => getPrioScore(basicEx, urgencyMap, matiere)).not.toThrow();
  });

  it('devrait appliquer un boost massif pour les dettes (AJAC)', () => {
    const matiereAvecDette = { nom: 'Maths', dette: true };
    const scoreDette = getPrioScore(basicEx, {}, matiereAvecDette);
    expect(scoreDette).toBeGreaterThanOrEqual(5);
  });

  it('devrait gérer tous les paramètres null/undefined sans crasher', () => {
    expect(() => getPrioScore(basicEx, null, null, null, null)).not.toThrow();
  });
});

describe('getSubjectExamBoost', () => {
  const urgencyMap = {
    'maths': { multiplier: 2.0, daysToExam: 5 },
    'physique': { multiplier: 1.2, daysToExam: 60 }
  };

  it('devrait retourner un boost par défaut si pas de matière', () => {
    const result = getSubjectExamBoost(null, urgencyMap);
    expect(result.boost).toBe(1.0);
    expect(result.daysToExam).toBe(Infinity);
  });

  it('devrait retourner un boost par défaut si matière sans nom', () => {
    const result = getSubjectExamBoost({}, urgencyMap);
    expect(result.boost).toBe(1.0);
  });

  it('devrait appliquer le multiplicateur urgence', () => {
    const result = getSubjectExamBoost({ nom: 'Maths', coefficient: 1 }, urgencyMap);
    expect(result.boost).toBe(2.0);
    expect(result.daysToExam).toBe(5);
  });

  it('devrait bonifier les matières à fort coefficient (≥3) avec urgence ≥1.5', () => {
    const result = getSubjectExamBoost({ nom: 'Maths', coefficient: 3 }, urgencyMap);
    expect(result.boost).toBeGreaterThan(2.0);
  });

  it('devrait retourner 1.0 si la matière est absente de la map', () => {
    const result = getSubjectExamBoost({ nom: 'Inconnue', coefficient: 1 }, urgencyMap);
    expect(result.boost).toBe(1.0);
  });
});

describe('getAdaptiveWeight', () => {
  const defaultWeights = {
    examUrgency: 1.0,
    gradeDeficit: 1.0,
    remainingWeight: 1.0,
    synergy: 1.0,
    exploration: 0.15
  };

  it('devrait retourner les poids par défaut si pas dhistorique', () => {
    const weights = getAdaptiveWeight(null, null);
    expect(weights).toEqual(defaultWeights);
  });

  it('devrait retourner les poids par défaut si historique < 3', () => {
    const outcomes = [{ noteObtenue: 15 }, { noteObtenue: 12 }];
    const weights = getAdaptiveWeight(null, outcomes);
    expect(weights).toEqual(defaultWeights);
  });

  it('devrait réduire exploration si les notes sont bonnes (>13)', () => {
    const outcomes = [
      { noteObtenue: 15 }, { noteObtenue: 14 }, { noteObtenue: 16 }
    ];
    const weights = getAdaptiveWeight(null, outcomes);
    expect(weights.exploration).toBeLessThan(0.15);
  });

  it('devrait augmenter exploration si les notes sont mauvaises (<9)', () => {
    const outcomes = [
      { noteObtenue: 7 }, { noteObtenue: 8 }, { noteObtenue: 6 }
    ];
    const weights = getAdaptiveWeight(null, outcomes);
    expect(weights.exploration).toBeGreaterThan(0.15);
  });

  it('devrait ajuster gradeDeficit pour les matières à fort coefficient', () => {
    // getAdaptiveWeight nécessite au moins 3 entrées pour activer l'adaptation
    const outcomes = [
      { noteObtenue: 14, coefficient: 3 },
      { noteObtenue: 13, coefficient: 3 },
      { noteObtenue: 15, coefficient: 2 }
    ];
    const weights = getAdaptiveWeight(null, outcomes);
    expect(weights.gradeDeficit).toBeGreaterThan(1.0);
  });

  it('devrait merger avec les poids existants', () => {
    const existing = { examUrgency: 2.0 };
    const weights = getAdaptiveWeight(existing, []);
    expect(weights.examUrgency).toBe(2.0);
    expect(weights.exploration).toBe(0.15);
  });
});

describe('getCapitalisedUEs', () => {
  it('devrait retourner un Set vide si pas de licence', () => {
    const result = getCapitalisedUEs(null);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('devrait retourner un Set vide si pas de semestres', () => {
    const result = getCapitalisedUEs({});
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('devrait retourner un Set vide pour des semestres vides', () => {
    const result = getCapitalisedUEs({ semestres: [] });
    expect(result.size).toBe(0);
  });

  it('devrait gérer des semestres sans UEs', () => {
    const licence = { semestres: [{}, {}] };
    const result = getCapitalisedUEs(licence);
    expect(result).toBeInstanceOf(Set);
  });

  /*
   * getMatiereAverage n'est pas interceptée par le mock du haut de fichier :
   * scoring.js la charge en CommonJS (`require('./intelligence')`), hors du
   * registre de mocks ESM. Ces tests utilisent donc de vraies évaluations, ce
   * qui les rend de toute façon plus fidèles.
   */
  const ueAvec = (nom, matieres) => ({ nom, ects: 6, matieres });
  const mat = (nom, note, coefficient) => ({ nom, coefficient, evaluations: [{ note, coefficient: 1 }] });

  /*
   * La capitalisation est prononcée par le jury en fin d'année. Le critère
   * précédent — au moins trois notes conformes au règlement — était trop
   * faible : trois notes sont le minimum exigé de l'université, pas la preuve
   * que l'évaluation est close. Sur un cursus garni de trois notes par matière
   * en cours de semestre, les cinq UE passaient capitalisées dès le mois
   * d'août et disparaissaient entièrement du planning, examens à venir.
   */
  const semestreFini = (ues) => ({ nom: 'S3', dateFin: '2020-01-15', ues });
  const semestreEnCours = (ues) => ({ nom: 'S3', dateFin: '2099-01-15', ues });

  it('ne capitalise rien tant que le semestre est en cours', () => {
    const ue = {
      nom: 'UE1', ects: 6,
      matieres: [{ nom: 'Analyse', coefficient: 2, evaluations: [{ note: 15 }, { note: 14 }, { note: 16 }] }],
    };
    expect(getCapitalisedUEs({ semestres: [semestreEnCours([ue]), {}] }).has('UE1')).toBe(false);
  });

  it('capitalise une UE validée une fois le semestre terminé', () => {
    const ue = {
      nom: 'UE1', ects: 6,
      matieres: [{ nom: 'Analyse', coefficient: 2, evaluations: [{ note: 12 }, { note: 12 }, { note: 12 }] }],
    };
    expect(getCapitalisedUEs({ semestres: [semestreFini([ue]), {}] }).has('UE1')).toBe(true);
  });

  it('capitalise une UE que tu as déclarée acquise, même en cours de semestre', () => {
    // Les années précédentes se saisissent souvent sans le détail des épreuves.
    const ue = { nom: 'UE1', ects: 6, acquise: true, matieres: [] };
    expect(getCapitalisedUEs({ semestres: [semestreEnCours([ue]), {}] }).has('UE1')).toBe(true);
  });
  it("ne capitalise pas une UE sous la moyenne à cause d'une matière de coefficient nul", () => {
    /*
     * Une matière de coefficient 0 voyait sa moyenne s'ajouter entièrement à
     * celle de l'UE. Une UE réellement à 8/20 accompagnée d'un sport noté 18
     * était calculée à 26/20, donc déclarée capitalisée — et ELPIS cessait
     * définitivement d'en planifier les révisions, juste avant les partiels.
     */
    const licence = { semestres: [semestreFini([ueAvec('UE1', [mat('Analyse', 8, 2), mat('Sport', 18, 0)])]), {}] };
    expect(getCapitalisedUEs(licence).has('UE1')).toBe(false);
  });

  it('capitalise une UE réellement au-dessus de la moyenne', () => {
    // Contrôle : la correction ne doit pas empêcher une capitalisation légitime.
    // Trois notes équilibrées, moyenne à 12 : évaluation achevée et validée.
    const ue = {
      nom: 'UE1', ects: 6,
      matieres: [{ nom: 'Analyse', coefficient: 2, evaluations: [{ note: 12 }, { note: 12 }, { note: 12 }] }],
    };
    expect(getCapitalisedUEs({ semestres: [semestreFini([ue]), {}] }).has('UE1')).toBe(true);
  });
  it('devrait capitaliser une UE acquise explicitement', () => {
    const licence = {
      semestres: [
        { ues: [{ nom: 'UE1', acquise: true, ects: 6, matieres: [] }] },
        { ues: [{ nom: 'UE2', acquise: true, ects: 6, matieres: [] }] }
      ]
    };
    const result = getCapitalisedUEs(licence);
    expect(result).toBeInstanceOf(Set);
  });
});
