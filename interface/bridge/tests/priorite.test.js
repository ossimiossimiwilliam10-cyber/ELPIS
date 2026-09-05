import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  calculerPriorite, contexteDepuisExercice, joursEntre,
  pointsExamen, pointsNote, pointsOubli, pointsCouverture, pointsDifficulte,
  PLAFONDS,
} = require('../moteur/priorite');

describe('Bornes de l\'échelle', () => {
  test('les plafonds font 100 points au total', () => {
    const somme = Object.values(PLAFONDS).reduce((a, b) => a + b, 0);
    expect(somme).toBe(100);
  });

  test('aucun contexte ne dépasse 100', () => {
    // Le pire cas cumulé : examen demain, moyenne au plancher, très en retard,
    // jamais travaillé, difficile, en dette, fort coefficient.
    const { score } = calculerPriorite({
      joursAvantExamen: 1, coefficient: 10, moyenne: 0,
      joursDepuisDernierPassage: 200, intervalleAttenduJours: 1,
      nombrePratiques: 0, difficulte: 'difficile', dette: true,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  test('un contexte vide ne descend pas sous zéro', () => {
    expect(calculerPriorite({}).score).toBeGreaterThanOrEqual(0);
  });

  test('l\'amplitude reste raisonnable entre deux exercices identiques', () => {
    // Le calcul précédent produisait un facteur 60 sur ce seul écart de contexte,
    // et jusqu'à 1200 en cumulant examen et synergie : une matière raflait la
    // journée entière.
    const ordinaire = calculerPriorite({ nombrePratiques: 0, difficulte: 'moyen', moyenne: 12, coefficient: 1 });
    const cumul = calculerPriorite({ nombrePratiques: 0, difficulte: 'moyen', moyenne: 2, coefficient: 5, dette: true });

    expect(cumul.score / ordinaire.score).toBeLessThan(5);
    expect(cumul.score).toBeGreaterThan(ordinaire.score);
  });
});

describe('Urgence d\'examen', () => {
  test('monte à l\'approche de l\'épreuve', () => {
    const j30 = pointsExamen(30, 1).points;
    const j7 = pointsExamen(7, 1).points;
    const j2 = pointsExamen(2, 1).points;
    expect(j2).toBeGreaterThan(j7);
    expect(j7).toBeGreaterThan(j30);
  });

  test('ne compte pas au-delà de deux mois', () => {
    expect(pointsExamen(90, 1).points).toBe(0);
  });

  test('tient compte du coefficient sans changer d\'ordre de grandeur', () => {
    const faible = pointsExamen(5, 1).points;
    const fort = pointsExamen(5, 6).points;
    expect(fort).toBeGreaterThan(faible);
    expect(fort / faible).toBeLessThan(2);
  });

  test('reste sous son plafond', () => {
    expect(pointsExamen(0, 20).points).toBeLessThanOrEqual(PLAFONDS.examen);
  });

  test('ignore une échéance absente ou passée', () => {
    expect(pointsExamen(undefined, 1).points).toBe(0);
    expect(pointsExamen(-3, 1).points).toBe(0);
  });

  test('nomme l\'échéance dans son libellé', () => {
    expect(pointsExamen(2, 1).detail.libelle).toMatch(/2 jours/);
    expect(pointsExamen(6, 1).detail.libelle).toMatch(/cette semaine/i);
  });
});

describe('Déficit de note', () => {
  test('croît quand la moyenne baisse', () => {
    expect(pointsNote(4, 1).points).toBeGreaterThan(pointsNote(10, 1).points);
  });

  test('ne compte pas au-dessus de l\'objectif', () => {
    expect(pointsNote(14, 1, 12).points).toBe(0);
  });

  test('pèse plus lourd à fort coefficient', () => {
    expect(pointsNote(8, 5).points).toBeGreaterThan(pointsNote(8, 1).points);
  });

  test('reste sous son plafond', () => {
    expect(pointsNote(0, 20).points).toBeLessThanOrEqual(PLAFONDS.note);
  });

  test('nomme le seuil au lieu de parler d’un objectif', () => {
    // « Sous l'objectif » laissait croire que le classement suivait une moyenne
    // visée qu'on aurait réglée. Le seuil est fixe — 12 — et le libellé le dit.
    expect(pointsNote(6, 1).detail.libelle).toMatch(/critique/i);
    expect(pointsNote(11, 1).detail.libelle).toMatch(/sous 12/i);
    expect(pointsNote(11, 1).detail.libelle).not.toMatch(/objectif/i);
  });

  test('ignore une matière sans note', () => {
    expect(pointsNote(null, 1).points).toBe(0);
  });
});

describe('Oubli', () => {
  test('ne compte rien avant l\'échéance', () => {
    expect(pointsOubli(3, 7).points).toBe(0);
  });

  test('monte avec le retard', () => {
    const juste = pointsOubli(7, 7).points;
    const tard = pointsOubli(21, 7).points;
    expect(tard).toBeGreaterThan(juste);
  });

  test('sature au-delà du double de l\'intervalle', () => {
    expect(pointsOubli(14, 7).points).toBe(pointsOubli(100, 7).points);
  });

  test('fait passer devant un exercice ancien mais souvent pratiqué', () => {
    // L'ancien calcul ne regardait que le nombre de passages : cinq révisions il
    // y a six mois passaient derrière une révision d'hier.
    const ancien = calculerPriorite({ nombrePratiques: 5, joursDepuisDernierPassage: 180, intervalleAttenduJours: 7 });
    const recent = calculerPriorite({ nombrePratiques: 1, joursDepuisDernierPassage: 1, intervalleAttenduJours: 7 });
    expect(ancien.score).toBeGreaterThan(recent.score);
  });

  test('ignore un exercice jamais daté', () => {
    expect(pointsOubli(null, 7).points).toBe(0);
  });
});

describe('Couverture', () => {
  test('privilégie ce qui n\'a jamais été fait', () => {
    expect(pointsCouverture(0).points).toBeGreaterThan(pointsCouverture(3).points);
  });

  test('décroît sans jamais s\'annuler', () => {
    expect(pointsCouverture(20).points).toBeGreaterThan(0);
  });

  test('signale explicitement le jamais-travaillé', () => {
    expect(pointsCouverture(0).detail.libelle).toBe('Jamais travaillé');
    expect(pointsCouverture(2).detail).toBeNull();
  });
});

describe('Difficulté', () => {
  test('classe les niveaux déclarés', () => {
    expect(pointsDifficulte('difficile').points).toBeGreaterThan(pointsDifficulte('moyen').points);
    expect(pointsDifficulte('moyen').points).toBeGreaterThan(pointsDifficulte('tres_facile').points);
  });

  test('retombe sur un niveau moyen si rien n\'est déclaré', () => {
    expect(pointsDifficulte(undefined).points).toBe(pointsDifficulte('moyen').points);
  });
});

describe('Modificateurs', () => {
  test('une dette rehausse sans écraser', () => {
    const sans = calculerPriorite({ nombrePratiques: 0, moyenne: 10 });
    const avec = calculerPriorite({ nombrePratiques: 0, moyenne: 10, dette: true });
    expect(avec.score).toBeGreaterThan(sans.score);
    expect(avec.score / sans.score).toBeLessThan(2);
  });

  test('une matière compensée redescend', () => {
    const sans = calculerPriorite({ nombrePratiques: 0, moyenne: 9 });
    const avec = calculerPriorite({ nombrePratiques: 0, moyenne: 9, compensable: true });
    expect(avec.score).toBeLessThan(sans.score);
  });

  test('une matière maîtrisée redescend', () => {
    const moyenne = calculerPriorite({ nombrePratiques: 0, moyenne: 11 });
    const maitrisee = calculerPriorite({ nombrePratiques: 0, moyenne: 17 });
    expect(maitrisee.score).toBeLessThan(moyenne.score);
  });

  test('les modificateurs appliqués sont rapportés', () => {
    const { modificateurs } = calculerPriorite({ dette: true, moyenne: 16 });
    expect(modificateurs.map(m => m.nom)).toContain('dette');
    expect(modificateurs.map(m => m.nom)).toContain('maitrise');
  });
});

describe('Explication du score', () => {
  test('rend la décomposition du calcul', () => {
    // C'est ce qui manquait le plus : un produit ne se décompose pas.
    const { composantes } = calculerPriorite({
      joursAvantExamen: 6, moyenne: 8, coefficient: 3, nombrePratiques: 0,
    });
    const criteres = composantes.map(c => c.critere);
    expect(criteres).toContain('examen');
    expect(criteres).toContain('note');
    expect(criteres).toContain('couverture');
  });

  test('n\'expose que les contributions notables', () => {
    // Un exercice déjà pratiqué et de difficulté moyenne verse des points sans
    // qu'il y ait rien à en dire : le détail reste donc en deçà du total.
    const r = calculerPriorite({ joursAvantExamen: 6, moyenne: 8, nombrePratiques: 3, difficulte: 'moyen' });
    const somme = r.composantes.reduce((s, c) => s + c.points, 0);
    expect(somme).toBeLessThanOrEqual(r.score + 0.5);
    expect(r.composantes.every(c => c.points > 0)).toBe(true);
  });

  test('résume les trois motifs dominants', () => {
    const { raisons } = calculerPriorite({
      joursAvantExamen: 2, moyenne: 5, nombrePratiques: 0,
      joursDepuisDernierPassage: 40, difficulte: 'difficile',
    });
    expect(raisons.length).toBeLessThanOrEqual(3);
    expect(raisons[0]).toMatch(/Examen/i);
  });

  test('ne raconte rien qui ne compte pas', () => {
    const { raisons } = calculerPriorite({ nombrePratiques: 5, moyenne: 14 });
    expect(raisons).not.toContain('Jamais travaillé');
  });
});

describe('joursEntre', () => {
  test('compte les jours entiers', () => {
    expect(joursEntre('2026-09-01', new Date(2026, 8, 8))).toBe(7);
  });

  test('renvoie null sans date', () => {
    expect(joursEntre(null)).toBeNull();
    expect(joursEntre('pas une date')).toBeNull();
  });
});

describe('contexteDepuisExercice', () => {
  test('assemble le contexte depuis le cursus', () => {
    const exercice = { nombrePratiques: 2, difficulte: 'difficile', dernierePratique: '2026-09-01' };
    const matiere = { nom: 'Algèbre', coefficient: 4, dette: true, evaluations: [{ note: 8, coefficient: 1 }] };

    const ctx = contexteDepuisExercice(exercice, matiere, { joursAvantExamen: 5 });
    expect(ctx).toMatchObject({
      nombrePratiques: 2, difficulte: 'difficile', coefficient: 4, dette: true, joursAvantExamen: 5,
    });
    expect(ctx.moyenne).toBe(8);
  });

  test('supporte un exercice neuf sans historique', () => {
    const ctx = contexteDepuisExercice({}, { nom: 'X' });
    expect(ctx.nombrePratiques).toBe(0);
    expect(ctx.joursDepuisDernierPassage).toBeNull();
    expect(() => calculerPriorite(ctx)).not.toThrow();
  });
});
