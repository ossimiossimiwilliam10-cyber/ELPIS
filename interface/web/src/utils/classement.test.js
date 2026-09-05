import { describe, it, expect } from 'vitest';
import { percentile, rangDepuisPercentile, estRevisionReussie, noteRetenue, scoreNotes, scoreRetention, scoreRegularite, synthetiserClassement, POIDS, formaterRang } from './classement';

const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
const JOUR = 86400000;

const cursusAvec = (evaluations, extra = {}) => ({
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [{ nom: 'UE1', ects: 6, matieres: [{ nom: 'Algèbre', coefficient: 1, evaluations, ...extra }] }],
    }],
  }],
});

describe('percentile et rang', () => {
  it('place la moyenne exactement au milieu', () => {
    expect(percentile(10, 10, 3)).toBeCloseTo(50, 1);
  });

  it('borne les écarts extrêmes à trois sigmas', () => {
    // Sans bornes, une note isolée produisait un « Top 0.0 % » trompeur.
    expect(percentile(100, 10, 3)).toBeCloseTo(percentile(19, 10, 3), 1);
  });

  it('refuse un écart-type inexploitable', () => {
    expect(percentile(12, 10, 0)).toBeNull();
    expect(percentile(12, 10, NaN)).toBeNull();
  });

  it('convertit un percentile en position de tête', () => {
    expect(rangDepuisPercentile(90)).toBeCloseTo(10, 5);
    expect(rangDepuisPercentile(100)).toBe(0.1);
    expect(rangDepuisPercentile(null)).toBeNull();
  });
});

describe('estRevisionReussie', () => {
  it('reconnaît les actions réellement écrites par l\'application', () => {
    // Régression : le filtre visait un type « revision » inexistant et un champ
    // `difficulty` jamais écrit ; les cours révisés n'entraient jamais en compte.
    expect(estRevisionReussie({ action: 'Révisé (J7)' })).toBe(true);
    expect(estRevisionReussie({ action: 'Terminé (Note: 15/20)' })).toBe(true);
  });

  it('écarte une séance suspendue', () => {
    expect(estRevisionReussie({ action: 'Suspendu (séance partielle)' })).toBe(false);
  });

  it('écarte une action inconnue', () => {
    expect(estRevisionReussie({ action: 'Temps investi' })).toBe(false);
    expect(estRevisionReussie({})).toBe(false);
  });
});

describe('noteRetenue', () => {
  it('privilégie la note réelle', () => {
    const m = { nom: 'Algèbre', evaluations: [{ note: 14, coefficient: 1 }] };
    expect(noteRetenue(m, { projectedScoreMap: { 'algèbre': 8 } })).toEqual({ note: 14, estimee: false });
  });

  it('se rabat sur la projection à défaut de note', () => {
    const m = { nom: 'Algèbre', evaluations: [] };
    expect(noteRetenue(m, { projectedScoreMap: { 'algèbre': 8 } })).toEqual({ note: 8, estimee: true });
  });

  it('écarte une défaillance, qui ne se compare à rien', () => {
    const m = { nom: 'Algèbre', evaluations: [{ note: null, statut: 'defaillant', coefficient: 1 }] };
    expect(noteRetenue(m, null).note).toBeNull();
  });
});

describe('scoreNotes', () => {
  it('pondère les évaluations comme le bulletin', () => {
    // Régression : la moyenne était arithmétique, ignorant les coefficients —
    // le classement et le bulletin affichaient deux notes différentes.
    const r = scoreNotes(cursusAvec([
      { nom: 'DS', note: 10, coefficient: 1 },
      { nom: 'Examen', note: 16, coefficient: 3 },
    ]), null);
    expect(r.moyenne).toBeCloseTo(14.5, 2);
    expect(r.score).toBeCloseTo(72.5, 1);
  });

  it('rend null plutôt que zéro sans aucune note', () => {
    // Un score de 0 se lit comme un échec ; l'absence de données n'en est pas un.
    expect(scoreNotes(cursusAvec([]), null).score).toBeNull();
  });

  it('ignore une licence archivée', () => {
    const cursus = cursusAvec([{ nom: 'DS', note: 12, coefficient: 1 }]);
    cursus.licences[0].archived = true;
    expect(scoreNotes(cursus, null).score).toBeNull();
  });

  it('survit à un cursus absent', () => {
    expect(scoreNotes(null, null).score).toBeNull();
    expect(scoreNotes({}, null).matieres).toEqual([]);
  });
});

describe('scoreRetention', () => {
  const revision = (action) => ({ type: 'CM', action });

  it('compte les cours révisés, pas seulement les routines Anki', () => {
    expect(scoreRetention([revision('Révisé (J7)'), revision('Révisé (J1)')], null))
      .toEqual({ score: 100, source: 'historique' });
  });

  it('exclut les séances suspendues des révisions réussies', () => {
    expect(scoreRetention([revision('Révisé (J7)'), revision('Suspendu (séance partielle)')], null).score).toBe(50);
  });

  it('ignore les exercices, qui ne sont pas des révisions espacées', () => {
    expect(scoreRetention([{ type: 'TD', action: 'Terminé' }], null))
      .toEqual({ score: null, source: 'aucune' });
  });

  it('remplace l\'estimation par la mesure réelle d\'Anki', () => {
    // Régression : les deux valeurs étaient multipliées, ce qui faisait chuter
    // le score dès qu'Anki était branché — 100 % × 88 % donnait 88, puis 77…
    const r = scoreRetention([revision('Révisé (J7)')], { fsrs_real_retention: 88 });
    expect(r).toEqual({ score: 88, source: 'anki' });
  });
});

describe('scoreRegularite', () => {
  const seances = (n, depuis = 0) =>
    Array.from({ length: n }, (_, i) => ({ timestamp: new Date(MAINTENANT - (depuis + i) * 3600000).toISOString() }));

  it('rapporte les séances à la fenêtre réellement écoulée', () => {
    // Régression : un compte vieux de 3 jours était comparé à 30 jours
    // d'objectif, condamnant le score à rester au ras du sol.
    const config = { userStartDate: new Date(MAINTENANT - 3 * JOUR).toISOString() };
    const r = scoreRegularite(seances(6), config, MAINTENANT);
    expect(r.fenetre).toBe(3);
    expect(r.attendues).toBe(6);
    expect(r.score).toBe(100);
  });

  it('plafonne la fenêtre à trente jours', () => {
    const config = { userStartDate: new Date(MAINTENANT - 400 * JOUR).toISOString() };
    expect(scoreRegularite(seances(10), config, MAINTENANT).fenetre).toBe(30);
  });

  it('plafonne le score à 100', () => {
    const config = { userStartDate: new Date(MAINTENANT - JOUR).toISOString() };
    expect(scoreRegularite(seances(50), config, MAINTENANT).score).toBe(100);
  });

  it('distingue « rien à mesurer » d\'un relâchement', () => {
    // Un zéro se lit comme un abandon ; l'absence totale de séances n'en est pas un.
    const r = scoreRegularite([], {}, MAINTENANT);
    expect(r.score).toBeNull();
    expect(r.attendues).toBeGreaterThan(0);
  });

  it('vaut bien zéro quand des séances existent mais sont toutes anciennes', () => {
    const vieilles = [{ timestamp: new Date(MAINTENANT - 200 * JOUR).toISOString() }];
    expect(scoreRegularite(vieilles, {}, MAINTENANT).score).toBe(0);
  });
});

describe('synthetiserClassement', () => {
  const base = {
    coursConfig: cursusAvec([{ nom: 'DS', note: 12, coefficient: 1 }]),
    historique: [{ type: 'CM', action: 'Révisé (J7)', timestamp: new Date(MAINTENANT).toISOString() }],
    config: { userStartDate: new Date(MAINTENANT - JOUR).toISOString() },
    rankingBaseline: { globalMean: 50, globalSD: 15, subjects: { 'Algèbre': { mean: 10, sd: 3 } } },
    intelligence: null,
  };

  it('combine les trois composantes selon leur poids', () => {
    const r = synthetiserClassement(base, MAINTENANT);
    const attendu = 60 * POIDS.notes + 100 * POIDS.retention + r.regularite.score * POIDS.regularite;
    expect(r.scoreGlobal).toBeCloseTo(attendu, 5);
  });

  it('redistribue le poids d\'une composante absente au lieu de la compter zéro', () => {
    // Sans notes, l'ancien calcul multipliait 0 par 0,4 : le score global
    // plafonnait à 60 pour quelqu'un dont tout le reste était parfait.
    const sansNotes = { ...base, coursConfig: cursusAvec([]) };
    const r = synthetiserClassement(sansNotes, MAINTENANT);
    expect(r.notes.score).toBeNull();
    expect(r.composantesManquantes).toBe(1);
    expect(r.scoreGlobal).toBeGreaterThan(60);
  });

  it('rend un rang null tant qu\'aucune moyenne de référence n\'existe', () => {
    // La page affichait « Top 50 % » — la valeur par défaut du calcul — comme
    // s'il s'agissait d'un résultat mesuré.
    const r = synthetiserClassement({ ...base, rankingBaseline: null }, MAINTENANT);
    expect(r.rang).toBeNull();
    expect(r.scoreGlobal).not.toBeNull();
  });

  it('classe les matières de la mieux placée à la moins bien placée', () => {
    const cursus = cursusAvec([{ nom: 'DS', note: 16, coefficient: 1 }]);
    cursus.licences[0].semestres[0].ues[0].matieres.push({
      nom: 'Analyse', coefficient: 1, evaluations: [{ nom: 'DS', note: 6, coefficient: 1 }],
    });
    const r = synthetiserClassement({
      ...base,
      coursConfig: cursus,
      rankingBaseline: { subjects: { 'Algèbre': { mean: 10, sd: 3 }, 'Analyse': { mean: 10, sd: 3 } } },
    }, MAINTENANT);

    expect(r.parMatiere.map(m => m.nom)).toEqual(['Algèbre', 'Analyse']);
    expect(r.parMatiere[0].rang).toBeLessThan(r.parMatiere[1].rang);
  });

  it('rend un score global null quand rien n\'est mesurable', () => {
    const r = synthetiserClassement({
      coursConfig: { licences: [] }, historique: [], config: {}, rankingBaseline: null, intelligence: null,
    }, MAINTENANT);
    expect(r.scoreGlobal).toBeNull();
    expect(r.rang).toBeNull();
  });
});

describe('formaterRang', () => {
  /*
   * `rangDepuisPercentile` pose un plancher à 0,1 pour ne jamais prétendre à un
   * rang nul. L'affichage à zéro décimale le ramenait pourtant à « 0 % de
   * tête » — un score de 89/100 s'annonçait donc « dans les 0 % de tête ».
   */
  it('garde une décimale sous le pour-cent', () => {
    expect(formaterRang(0.1)).toBe('0,1');
    expect(formaterRang(0.4)).toBe('0,4');
  });

  it('arrondit au-dessus du pour-cent', () => {
    expect(formaterRang(12.4)).toBe('12');
    expect(formaterRang(1)).toBe('1');
    expect(formaterRang(99.6)).toBe('100');
  });

  it('ne rend jamais « 0 » pour un rang atteignable', () => {
    expect(formaterRang(rangDepuisPercentile(100))).not.toBe('0');
  });

  it('supporte une valeur absente', () => {
    expect(formaterRang(null)).toBe('—');
    expect(formaterRang(undefined)).toBe('—');
    expect(formaterRang(NaN)).toBe('—');
  });
});
