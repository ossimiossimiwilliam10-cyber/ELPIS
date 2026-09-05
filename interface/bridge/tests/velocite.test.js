import { describe, it, expect } from 'vitest';
import {
  construireVelocites, mesurerMatiere, estMaitrise, stabiliteDe, retentionDSR,
  dureeLissee, tendanceSeances, indexerHistorique, derniereRevision,
  STABILITE_MATURE, SEANCES_AVANT_ALERTE,
} from '../moteur/velocite';

const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
const JOUR = 86400000;

/** « JJ-MM-AAAA » à `n` jours dans le passé — format des dates du cursus. */
const ilYA = (n) => {
  const d = new Date(MAINTENANT - n * JOUR);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const cours = (extra = {}) => ({ titre: 'CM', ...extra });
const acquis = (stabilite = 40) => cours({ fsrsCard: { stability: stabilite, reps: 3 }, derniereRevision: ilYA(1) });
const seance = (extra = {}) => ({
  matiere: 'Algèbre', type: 'CM', dureeMinutes: 60,
  timestamp: new Date(MAINTENANT).toISOString(), ...extra,
});

const cursusAvec = (matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

describe('stabiliteDe', () => {
  it('lit la stabilité FSRS quand elle existe', () => {
    expect(stabiliteDe(cours({ fsrsCard: { stability: 34.2 } }))).toBeCloseTo(34.2, 5);
  });

  it('se rabat sur l\'intervalle des cours d\'avant la migration', () => {
    expect(stabiliteDe(cours({ jActuel: 12 }))).toBe(12);
  });

  it('distingue « jamais travaillé » d\'une stabilité nulle', () => {
    expect(stabiliteDe(cours())).toBeNull();
    expect(stabiliteDe(cours({ fsrsCard: { stability: 0 } }))).toBeNull();
  });
});

describe('estMaitrise', () => {
  it('juge sur la stabilité, pas sur la difficulté ressentie', () => {
    // Régression : la maîtrise se lisait sur `easeFactor >= 2.5`, un champ de
    // compatibilité recalculé depuis la difficulté FSRS — il mesurait donc à
    // quel point le cours paraît facile, pas ce qui en est retenu.
    expect(estMaitrise(cours({ fsrsCard: { stability: 40 }, easeFactor: 1.4 }))).toBe(true);
    expect(estMaitrise(cours({ fsrsCard: { stability: 2 }, easeFactor: 3.2 }))).toBe(false);
  });

  it('accepte le seuil de maturité', () => {
    expect(estMaitrise(cours({ fsrsCard: { stability: STABILITE_MATURE } }))).toBe(true);
    expect(estMaitrise(cours({ fsrsCard: { stability: STABILITE_MATURE - 0.1 } }))).toBe(false);
  });

  it('garde le repli pour les cours sans aucune trace FSRS', () => {
    expect(estMaitrise(cours({ easeFactor: 2.6, repetitions: 2 }))).toBe(true);
    expect(estMaitrise(cours({ easeFactor: 2.6, repetitions: 0 }))).toBe(false);
    expect(estMaitrise(cours())).toBe(false);
  });
});

describe('retentionDSR', () => {
  it('applique la même courbe que le reste de l\'application', () => {
    // Régression : ce module utilisait R = e^(−t/S) quand tout le reste
    // applique R(t) = (1 + t/(9·S))⁻¹ — deux mémoires différentes coexistaient.
    expect(retentionDSR(0, 10)).toBe(1);
    expect(retentionDSR(10, 10)).toBeCloseTo(0.9, 4);
    expect(retentionDSR(30, 21)).toBeGreaterThan(retentionDSR(30, 3));
  });

  it('ne divise pas par zéro sur une carte neuve', () => {
    expect(Number.isFinite(retentionDSR(5, 0))).toBe(true);
  });
});

describe('dureeLissee', () => {
  it('donne le plus de poids à la séance la plus récente', () => {
    const lissee = dureeLissee([{ dureeMinutes: 120 }, { dureeMinutes: 30 }]);
    expect(lissee).toBeLessThan(120);
    expect(lissee).toBeGreaterThan(30);
  });

  it('retombe sur 30 min pour l\'historique d\'avant le chronomètre', () => {
    expect(dureeLissee([{}])).toBe(30);
  });

  it('rend null sans aucune séance', () => {
    expect(dureeLissee([])).toBeNull();
  });
});

describe('tendanceSeances', () => {
  const serie = (durees) => durees.map(dureeMinutes => ({ dureeMinutes }));

  it('reste muette sous trois séances', () => {
    expect(tendanceSeances(serie([120, 30]))).toBe('stable');
  });

  it('reconnaît un raccourcissement net', () => {
    expect(tendanceSeances(serie([120, 90, 60, 30]))).toBe('accelerating');
  });

  it('reconnaît un allongement net', () => {
    expect(tendanceSeances(serie([30, 60, 90, 120]))).toBe('decelerating');
  });

  it('ne conclut rien sur des durées erratiques', () => {
    expect(tendanceSeances(serie([30, 120, 40, 110, 35]))).toBe('stable');
  });
});

describe('indexerHistorique et derniereRevision', () => {
  it('regroupe les séances par matière', () => {
    const index = indexerHistorique([
      seance({ matiere: 'Algèbre' }),
      seance({ matiere: 'Analyse' }),
      seance({ matiere: 'Algèbre' }),
      seance({ matiere: null }),
    ]);
    expect(index.get('Algèbre')).toHaveLength(2);
    expect(index.get('Analyse')).toHaveLength(1);
  });

  it('retient la révision la plus récente', () => {
    const t = derniereRevision([
      cours({ derniereRevision: ilYA(30) }),
      cours({ derniereRevision: ilYA(2) }),
    ]);
    expect(MAINTENANT - t).toBeLessThan(3 * JOUR);
  });

  it('rend null quand aucun cours n\'a été révisé', () => {
    expect(derniereRevision([cours(), cours()])).toBeNull();
    expect(derniereRevision([])).toBeNull();
  });
});

describe('mesurerMatiere', () => {
  it('compte les cours acquis sur leur stabilité', () => {
    const m = { nom: 'Algèbre', listeCM: [acquis(40), acquis(25), cours({ fsrsCard: { stability: 4 } })] };
    const r = mesurerMatiere(m, [], {}, MAINTENANT);
    expect(r.masteredCMs).toBe(2);
    expect(r.totalCMs).toBe(3);
    expect(r.youngCMs).toBe(1);
  });

  it('rapporte les passages aux seuls cours acquis', () => {
    // Régression : toutes les séances de la matière étaient divisées par le
    // nombre d'acquis, y compris celles passées sur les cours en cours
    // d'apprentissage. Le ratio gonflait donc à mesure qu'on travaillait, et
    // une matière normale finissait signalée comme « lente ».
    const m = {
      nom: 'Algèbre',
      listeCM: [
        cours({ fsrsCard: { stability: 40, reps: 2 }, derniereRevision: ilYA(1) }),
        cours({ fsrsCard: { stability: 2, reps: 9 } }),
      ],
    };
    const r = mesurerMatiere(m, Array.from({ length: 11 }, () => seance()), {}, MAINTENANT);
    expect(r.avgSessionsToMaster).toBe(2);
    expect(r.isSlowLearner).toBe(false);
  });

  it('signale une matière qui demande beaucoup de passages', () => {
    const m = { nom: 'Analyse', listeCM: [cours({ fsrsCard: { stability: 30, reps: 8 }, derniereRevision: ilYA(1) })] };
    const r = mesurerMatiere(m, [], {}, MAINTENANT);
    expect(r.avgSessionsToMaster).toBeGreaterThan(SEANCES_AVANT_ALERTE);
    expect(r.isSlowLearner).toBe(true);
  });

  it('distingue une rétention inconnue d\'une rétention nulle', () => {
    // Régression : sans révision, le délai valait 999 jours et la rétention
    // tombait à zéro — une matière neuve était présentée comme oubliée.
    const jamais = mesurerMatiere({ nom: 'Neuve', listeCM: [cours()] }, [], {}, MAINTENANT);
    expect(jamais.estimatedRetention).toBeNull();
    expect(jamais.stabilityDays).toBeNull();

    const revisee = mesurerMatiere({ nom: 'Vue', listeCM: [acquis(30)] }, [], {}, MAINTENANT);
    expect(revisee.estimatedRetention).toBeGreaterThan(0.9);
  });

  it('lit la stabilité FSRS au lieu de la ré-estimer', () => {
    const m = { nom: 'Algèbre', listeCM: [acquis(30), acquis(50)] };
    expect(mesurerMatiere(m, [], {}, MAINTENANT).stabilityDays).toBe(40);
  });

  it('prévoit une date d\'achèvement pour les cours restants', () => {
    const m = {
      nom: 'Algèbre',
      listeCM: [acquis(40), cours(), cours()],
    };
    const r = mesurerMatiere(m, [seance()], { maxStudyHoursPerDay: 4 }, MAINTENANT);
    expect(r.forecastMasteryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.estimatedRemainingMinutes).toBeGreaterThan(0);
  });

  it('ne prévoit rien quand tout est acquis', () => {
    const m = { nom: 'Algèbre', listeCM: [acquis(40)] };
    const r = mesurerMatiere(m, [], {}, MAINTENANT);
    expect(r.forecastMasteryDate).toBeNull();
    expect(r.estimatedRemainingMinutes).toBe(0);
  });

  it('totalise le temps passé, tous types confondus', () => {
    const r = mesurerMatiere({ nom: 'Algèbre', listeCM: [] }, [
      seance({ type: 'CM', dureeMinutes: 60 }),
      seance({ type: 'TD', dureeMinutes: 30 }),
      // Sans durée enregistrée, une séance compte pour 30 min.
      seance({ type: 'ANNALE', dureeMinutes: undefined }),
    ], {}, MAINTENANT);
    expect(r.totalStudyMinutes).toBe(120);
  });

  it('ne produit jamais NaN', () => {
    const cas = [
      { nom: 'Vide' },
      { nom: 'SansCM', listeCM: [] },
      { nom: 'Bruit', listeCM: [cours({ fsrsCard: { stability: 'oui' } })] },
    ];
    for (const m of cas) {
      const r = mesurerMatiere(m, [], {}, MAINTENANT);
      for (const [cle, valeur] of Object.entries(r)) {
        if (typeof valeur === 'number') {
          expect(Number.isNaN(valeur), `${m.nom}.${cle}`).toBe(false);
        }
      }
    }
  });
});

describe('construireVelocites', () => {
  it('couvre chaque matière active', () => {
    const carte = construireVelocites(
      cursusAvec([{ nom: 'Algèbre', listeCM: [acquis()] }, { nom: 'Analyse', listeCM: [] }]),
      [seance()], {}, MAINTENANT,
    );
    expect(Object.keys(carte).sort()).toEqual(['algèbre', 'analyse']);
  });

  it('ignore une licence ou un semestre archivé', () => {
    const cursus = cursusAvec([{ nom: 'Algèbre', listeCM: [acquis()] }]);
    cursus.licences[0].semestres[0].archived = 'true';
    expect(construireVelocites(cursus, [], {}, MAINTENANT)).toEqual({});
  });

  it('fonctionne sans historique', () => {
    const carte = construireVelocites(cursusAvec([{ nom: 'Algèbre', listeCM: [acquis()] }]), null, {}, MAINTENANT);
    expect(carte['algèbre'].masteredCMs).toBe(1);
    expect(carte['algèbre'].totalStudyMinutes).toBe(0);
  });

  it('survit à un cursus absent', () => {
    expect(construireVelocites(null, [], {}, MAINTENANT)).toEqual({});
    expect(construireVelocites({ licences: [] }, [], {}, MAINTENANT)).toEqual({});
  });
});
