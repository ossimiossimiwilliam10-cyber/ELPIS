import { describe, it, expect } from 'vitest';
import {
  construireProjections, construireCarteProjections, projeterMatiere,
  moyennePonderee, collecterNotes, analyserTendance, fusionner,
  regressionLineaire, ecartType, CORRECTION_TENDANCE_MAX,
} from '../moteur/projection';

const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
const JOUR = 86400000;

/** « AAAA-MM-JJ » à `n` jours dans le passé. */
const ilYA = (n) => {
  const d = new Date(MAINTENANT - n * JOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const matiereAvec = (champs) => ({ nom: 'Algèbre', ...champs });

const cursusAvec = (matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

describe('regressionLineaire', () => {
  it('retrouve une droite exacte', () => {
    const r = regressionLineaire([0, 1, 2, 3], [2, 4, 6, 8]);
    expect(r.pente).toBeCloseTo(2, 6);
    expect(r.origine).toBeCloseTo(2, 6);
    expect(r.r2).toBeCloseTo(1, 6);
  });

  it('donne un R² nul sur un nuage sans structure', () => {
    const r = regressionLineaire([0, 1, 2, 3], [5, 5, 5, 5]);
    expect(r.pente).toBe(0);
    expect(r.r2).toBe(0);
  });

  it('ne divise pas par zéro quand toutes les abscisses coïncident', () => {
    const r = regressionLineaire([2, 2, 2], [1, 5, 9]);
    expect(Number.isFinite(r.pente)).toBe(true);
    expect(r.pente).toBe(0);
  });
});

describe('ecartType', () => {
  it('mesure la dispersion d\'un échantillon', () => {
    expect(ecartType([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it('vaut zéro sous deux valeurs', () => {
    expect(ecartType([3])).toBe(0);
    expect(ecartType([])).toBe(0);
  });
});

describe('collecterNotes', () => {
  it('réunit évaluations et annales travaillées', () => {
    const notes = collecterNotes(matiereAvec({
      evaluations: [{ note: 14, coefficient: 2, date: ilYA(10) }],
      listeAnnales: [{ derniereNote: 11, nombrePratiques: 1, dernierePratique: ilYA(5) }],
    }), MAINTENANT);

    expect(notes).toHaveLength(2);
    expect(notes[0].source).toBe('evaluation');
    expect(notes[1].source).toBe('annale');
  });

  it('donne moins de poids à une annale blanche qu\'à une épreuve officielle', () => {
    const notes = collecterNotes(matiereAvec({
      evaluations: [{ note: 14, coefficient: 1 }],
      listeAnnales: [{ derniereNote: 11, nombrePratiques: 1 }],
    }), MAINTENANT);
    expect(notes.find(n => n.source === 'annale').coefficient).toBeLessThan(
      notes.find(n => n.source === 'evaluation').coefficient,
    );
  });

  it('ignore une annale jamais travaillée', () => {
    const notes = collecterNotes(matiereAvec({
      listeAnnales: [{ derniereNote: 11, nombrePratiques: 0 }],
    }), MAINTENANT);
    expect(notes).toHaveLength(0);
  });

  it('écarte les notes illisibles au lieu de propager NaN', () => {
    const notes = collecterNotes(matiereAvec({
      evaluations: [{ note: null }, { note: '' }, { note: 'absent' }, { note: 12 }],
    }), MAINTENANT);
    expect(notes).toHaveLength(1);
    expect(notes[0].valeur).toBe(12);
  });

  it('trie du plus ancien au plus récent', () => {
    const notes = collecterNotes(matiereAvec({
      evaluations: [{ note: 8, date: ilYA(1) }, { note: 16, date: ilYA(90) }],
    }), MAINTENANT);
    expect(notes.map(n => n.valeur)).toEqual([16, 8]);
  });
});

describe('moyennePonderee', () => {
  it('respecte les coefficients, comme le bulletin', () => {
    // Régression : les coefficients étaient collectés puis ignorés — la note
    // projetée divergeait de la moyenne affichée dans le Bulletin.
    const notes = [
      { valeur: 10, date: MAINTENANT, coefficient: 1 },
      { valeur: 16, date: MAINTENANT, coefficient: 3 },
    ];
    expect(moyennePonderee(notes, MAINTENANT).moyenne).toBeCloseTo(14.5, 6);
  });

  it('donne plus de poids à une note récente', () => {
    const notes = [
      { valeur: 5, date: MAINTENANT - 180 * JOUR, coefficient: 1 },
      { valeur: 15, date: MAINTENANT, coefficient: 1 },
    ];
    expect(moyennePonderee(notes, MAINTENANT).moyenne).toBeGreaterThan(12);
  });

  it('accumule du poids à mesure que les notes arrivent', () => {
    const une = moyennePonderee([{ valeur: 12, date: MAINTENANT, coefficient: 1 }], MAINTENANT);
    const cinq = moyennePonderee(
      Array.from({ length: 5 }, () => ({ valeur: 12, date: MAINTENANT, coefficient: 1 })),
      MAINTENANT,
    );
    expect(cinq.poidsTotal).toBeGreaterThan(une.poidsTotal);
    expect(cinq.moyenne).toBeCloseTo(une.moyenne, 6);
  });

  it('rend null sans aucune note', () => {
    expect(moyennePonderee([], MAINTENANT)).toEqual({ moyenne: null, poidsTotal: 0 });
  });
});

describe('analyserTendance', () => {
  const serie = (valeurs) => valeurs.map((valeur, i) => ({
    valeur, date: MAINTENANT - (valeurs.length - i) * 10 * JOUR, source: 'evaluation',
  }));

  it('reste muette sous trois notes', () => {
    expect(analyserTendance(serie([8, 12])).significative).toBe(false);
  });

  it('reconnaît une progression nette', () => {
    const t = analyserTendance(serie([8, 10, 12, 14]));
    expect(t.pente).toBeGreaterThan(0);
    expect(t.significative).toBe(true);
  });

  it('ne retient pas une tendance sur un nuage dispersé', () => {
    const t = analyserTendance(serie([8, 16, 9, 15, 10]));
    expect(t.significative).toBe(false);
  });

  it('signale une note qui s\'écarte franchement du reste', () => {
    const t = analyserTendance(serie([12, 12, 1, 12, 12]));
    expect(t.anomalies.length).toBeGreaterThan(0);
    expect(t.anomalies[0].valeur).toBe(1);
  });
});

describe('fusionner', () => {
  it('penche vers la source la plus précise', () => {
    const r = fusionner([
      { valeur: 10, precision: 1 },
      { valeur: 20, precision: 9 },
    ]);
    expect(r.valeur).toBeCloseTo(19, 6);
    expect(r.precision).toBe(10);
  });

  it('additionne les précisions', () => {
    const r = fusionner([{ valeur: 12, precision: 2 }, { valeur: 12, precision: 3 }]);
    expect(r.precision).toBe(5);
  });

  it('ignore les sources vides', () => {
    const r = fusionner([{ valeur: null, precision: 5 }, { valeur: 14, precision: 2 }]);
    expect(r.valeur).toBe(14);
  });

  it('rend null quand rien n\'est exploitable', () => {
    expect(fusionner([{ valeur: null, precision: 0 }])).toEqual({ valeur: null, precision: 0 });
  });
});

describe('projeterMatiere', () => {
  it('ne projette rien sans la moindre donnée', () => {
    // Régression : une matière inconnue était projetée à 10/20 — une valeur
    // inventée présentée comme une estimation.
    const p = projeterMatiere(matiereAvec({}), null, null, MAINTENANT);
    expect(p.projected).toBeNull();
    expect(p.sources).toEqual([]);
  });

  it('suit les notes quand elles sont nombreuses', () => {
    const evaluations = Array.from({ length: 6 }, (_, i) => ({
      note: 16, coefficient: 1, date: ilYA(i * 5),
    }));
    const p = projeterMatiere(matiereAvec({ evaluations }), null, null, MAINTENANT);
    expect(p.projected).toBeGreaterThan(15);
    expect(p.sources).toContain('notes');
  });

  it('resserre l\'intervalle à mesure que les notes s\'accumulent', () => {
    const avecUne = projeterMatiere(
      matiereAvec({ evaluations: [{ note: 12, coefficient: 1 }] }), null, null, MAINTENANT);
    const avecHuit = projeterMatiere(
      matiereAvec({ evaluations: Array.from({ length: 8 }, () => ({ note: 12, coefficient: 1 })) }),
      null, null, MAINTENANT);
    expect(avecHuit.confidenceInterval).toBeLessThan(avecUne.confidenceInterval);
  });

  it('projette à partir de la progression quand aucune note n\'existe', () => {
    const p = projeterMatiere(
      matiereAvec({}),
      { 'algèbre': { masteredCMs: 8, totalCMs: 10 } },
      null,
      MAINTENANT,
    );
    expect(p.projected).toBeCloseTo(16, 0);
    expect(p.sources).toEqual(['maitrise']);
  });

  it('complète les notes avec la rétention Anki sans les écraser', () => {
    // Régression : la rétention remplaçait 40 % de la projection, ce qui
    // tirait vers le bas une matière pourtant bien notée.
    const evaluations = Array.from({ length: 6 }, () => ({ note: 18, coefficient: 1 }));
    const sans = projeterMatiere(matiereAvec({ evaluations }), null, null, MAINTENANT);
    const avec = projeterMatiere(matiereAvec({ evaluations }), null,
      { retentionBySubject: { 'Algèbre': 70 } }, MAINTENANT);

    expect(avec.projected).toBeLessThan(sans.projected);
    expect(avec.projected).toBeGreaterThan(16);
    expect(avec.sources).toContain('retention');
  });

  it('borne la correction de tendance', () => {
    // Régression : la pente était extrapolée sur trente jours sans limite, ce
    // qui pouvait ajouter dix points à une matière n'ayant que trois notes.
    const evaluations = [0, 1, 2, 3].map(i => ({ note: 4 + i * 5, coefficient: 1, date: ilYA(30 - i * 10) }));
    const p = projeterMatiere(matiereAvec({ evaluations }), null, null, MAINTENANT);
    const base = moyennePonderee(collecterNotes(matiereAvec({ evaluations }), MAINTENANT), MAINTENANT).moyenne;

    expect(p.trendSignificant).toBe(true);
    expect(Math.abs(p.projected - base)).toBeLessThanOrEqual(CORRECTION_TENDANCE_MAX + 0.1);
  });

  it('reste dans l\'échelle de notation', () => {
    const hautes = Array.from({ length: 10 }, () => ({ note: 20, coefficient: 5 }));
    expect(projeterMatiere(matiereAvec({ evaluations: hautes }), null, null, MAINTENANT).projected).toBeLessThanOrEqual(20);

    const basses = Array.from({ length: 10 }, () => ({ note: 0, coefficient: 5 }));
    expect(projeterMatiere(matiereAvec({ evaluations: basses }), null, null, MAINTENANT).projected).toBeGreaterThanOrEqual(0);
  });

  it('ne produit jamais NaN', () => {
    const cas = [
      matiereAvec({}),
      matiereAvec({ evaluations: [] }),
      matiereAvec({ evaluations: [{ note: 12 }], listeAnnales: [] }),
      matiereAvec({ evaluations: [{ note: 12, coefficient: 0 }] }),
    ];
    for (const m of cas) {
      const p = projeterMatiere(m, null, null, MAINTENANT);
      expect(Number.isNaN(p.projected)).toBe(false);
      expect(Number.isNaN(p.confidenceInterval)).toBe(false);
    }
  });
});

describe('construireProjections', () => {
  it('parcourt tout le cursus actif', () => {
    const carte = construireProjections(cursusAvec([
      matiereAvec({ nom: 'Algèbre', evaluations: [{ note: 14, coefficient: 1 }] }),
      matiereAvec({ nom: 'Analyse', evaluations: [{ note: 8, coefficient: 1 }] }),
    ]), null, null, MAINTENANT);

    expect(Object.keys(carte).sort()).toEqual(['algèbre', 'analyse']);
  });

  it('ignore une licence ou un semestre archivé', () => {
    const cursus = cursusAvec([matiereAvec({ evaluations: [{ note: 14 }] })]);
    cursus.licences[0].semestres[0].archived = 'true';
    expect(construireProjections(cursus, null, null, MAINTENANT)).toEqual({});
  });

  it('survit à un cursus vide ou absent', () => {
    expect(construireProjections(null, null, null, MAINTENANT)).toEqual({});
    expect(construireProjections({ licences: [] }, null, null, MAINTENANT)).toEqual({});
  });
});

describe('construireCarteProjections', () => {
  it('omet les matières sans donnée plutôt que de les porter à null', () => {
    // Régression : `null < 5` vaut `true` en JavaScript — une matière inconnue
    // déclenchait l'alerte « note critique » réservée aux vraies difficultés.
    const carte = construireCarteProjections(cursusAvec([
      matiereAvec({ nom: 'Algèbre', evaluations: [{ note: 14, coefficient: 1 }] }),
      matiereAvec({ nom: 'Inconnue' }),
    ]), null, null, MAINTENANT);

    expect(carte['algèbre']).toBeGreaterThan(0);
    expect('inconnue' in carte).toBe(false);
  });

  it('rend des nombres, pas des objets', () => {
    const carte = construireCarteProjections(
      cursusAvec([matiereAvec({ evaluations: [{ note: 14, coefficient: 1 }] })]),
      null, null, MAINTENANT);
    expect(typeof carte['algèbre']).toBe('number');
  });
});
