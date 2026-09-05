import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildExamUrgencyMap } = require('../moteur/intelligence');

/** « JJ-MM-AAAA » à `n` jours dans le futur (négatif pour le passé). */
const dans = (n) => {
  const d = new Date();
  d.setHours(d.getHours() - 4);
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const cursusAvec = (matieres, extraSemestre = {}) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }], ...extraSemestre }] }],
});

describe('buildExamUrgencyMap', () => {
  it('retient l\'échéance la plus proche', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [
        { nom: 'Partiel', date: dans(20) },
        { nom: 'DS', date: dans(5) },
      ],
    }]));
    expect(carte['algèbre'].daysToExam).toBe(5);
    expect(carte['algèbre'].multiplier).toBe(2.0);
  });

  it('ignore une épreuve déjà notée', () => {
    // Régression : une note saisie avant la date de l'épreuve — ou une date
    // laissée dans le futur après coup — maintenait la matière au sommet des
    // priorités, au détriment de celles dont l'examen approchait vraiment.
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [
        { nom: 'DS', date: dans(2), note: 14 },
        { nom: 'Partiel', date: dans(25) },
      ],
    }]));
    expect(carte['algèbre'].daysToExam).toBe(25);
  });

  it('ignore une épreuve close par une absence', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [
        { nom: 'DS', date: dans(2), statut: 'defaillant' },
        { nom: 'Rattrapage', date: dans(2), statut: 'excuse' },
        { nom: 'Partiel', date: dans(40) },
      ],
    }]));
    expect(carte['algèbre'].daysToExam).toBe(40);
  });

  it('reste attentif à une épreuve datée mais pas encore notée', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [{ nom: 'DS', date: dans(2), note: null }],
    }]));
    expect(carte['algèbre'].daysToExam).toBe(2);
    expect(carte['algèbre'].multiplier).toBe(3.0);
  });

  it('écarte les épreuves passées', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [{ nom: 'DS', date: dans(-10) }],
    }]));
    expect(carte['algèbre']).toBeUndefined();
  });

  it('se rabat sur la fin du semestre à défaut d\'épreuve datée', () => {
    const carte = buildExamUrgencyMap(cursusAvec(
      [{ nom: 'Algèbre', evaluations: [{ nom: 'DS' }] }],
      { dateFin: dans(15) },
    ));
    expect(carte['algèbre'].daysToExam).toBe(15);
  });

  it('n\'inscrit rien pour une matière sans aucune échéance', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{ nom: 'Algèbre', evaluations: [] }]));
    expect(carte['algèbre']).toBeUndefined();
  });

  it('gradue l\'urgence par paliers', () => {
    const paliers = [[2, 3.0], [6, 2.0], [15, 1.5], [28, 1.2], [90, 1.0]];
    for (const [jours, attendu] of paliers) {
      const carte = buildExamUrgencyMap(cursusAvec([{
        nom: 'Algèbre', evaluations: [{ nom: 'DS', date: dans(jours) }],
      }]));
      expect(carte['algèbre'].multiplier, `${jours} jours`).toBe(attendu);
    }
  });

  it('survit à un cursus absent ou vide', () => {
    expect(buildExamUrgencyMap(null)).toEqual({});
    expect(buildExamUrgencyMap({ licences: [] })).toEqual({});
  });

  it('ignore une date illisible au lieu de propager NaN', () => {
    const carte = buildExamUrgencyMap(cursusAvec([{
      nom: 'Algèbre',
      evaluations: [{ nom: 'DS', date: 'demain matin' }, { nom: 'Partiel', date: dans(9) }],
    }]));
    expect(carte['algèbre'].daysToExam).toBe(9);
  });
});
