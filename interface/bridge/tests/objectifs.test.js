import { describe, it, test, expect } from 'vitest';
import {
  CAPS, CAP_DEFAUT, CAPACITE_MIN, CAPACITE_MAX,
  capDe, capaciteRetenue, budgetQuotidien, joursTravailles, semainesTenues,
  evaluerPaliers, engagementsHebdo, etatObjectifs, partStabilite,
} from '../moteur/objectifs';

const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
const JOUR = 86400000;

const seance = (joursAvant, extra = {}) => ({
  matiere: 'Mécanique 3', type: 'CM', dureeMinutes: 60,
  timestamp: new Date(MAINTENANT - joursAvant * JOUR).toISOString(), ...extra,
});

/** Une séance par jour sur les `n` derniers jours. */
const assidu = (n) => Array.from({ length: n }, (_, i) => seance(i));

const cursusAvec = (matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

const cours = (stabilite) => ({ titre: 'CM', fsrsCard: { stability: stabilite } });

describe('capDe', () => {
  it('reconnaît les trois régimes', () => {
    expect(capDe('consolider').joursParSemaine).toBe(4);
    expect(capDe('progresser').joursParSemaine).toBe(5);
    expect(capDe('viser-haut').joursParSemaine).toBe(6);
  });

  it('retombe sur le régime par défaut', () => {
    expect(capDe(undefined)).toBe(CAPS[CAP_DEFAUT]);
    expect(capDe('inconnu')).toBe(CAPS[CAP_DEFAUT]);
  });

  it('donne à chaque régime une répartition qui totalise 100 %', () => {
    for (const [nom, cap] of Object.entries(CAPS)) {
      const somme = cap.repartition.decouverte + cap.repartition.entretien + cap.repartition.entrainement;
      expect(somme, nom).toBeCloseTo(1, 6);
    }
  });

  it('fait croître l\'entraînement avec l\'ambition, pas le nombre d\'heures', () => {
    // C'est le principe de la refonte : viser haut ne veut pas dire travailler
    // plus longtemps, mais consacrer plus de temps à la mise en application.
    expect(CAPS['viser-haut'].repartition.entrainement)
      .toBeGreaterThan(CAPS.progresser.repartition.entrainement);
    expect(CAPS.progresser.repartition.entrainement)
      .toBeGreaterThan(CAPS.consolider.repartition.entrainement);
  });
});

describe('capaciteRetenue', () => {
  it('respecte la capacité déclarée', () => {
    expect(capaciteRetenue({ capaciteQuotidienneH: 3 })).toBe(3);
  });

  it('borne à ce qu\'un humain peut tenir', () => {
    expect(capaciteRetenue({ capaciteQuotidienneH: 20 })).toBe(CAPACITE_MAX);
    expect(capaciteRetenue({ capaciteQuotidienneH: 0 })).toBe(CAPACITE_MIN);
  });

  it('ignore une saisie inexploitable', () => {
    expect(capaciteRetenue({ capaciteQuotidienneH: 'beaucoup' })).toBe(2.5);
    expect(capaciteRetenue({})).toBe(2.5);
  });
});

describe('budgetQuotidien', () => {
  it('ne dépend que de la capacité déclarée', () => {
    // Régression majeure : la charge était calculée à partir de la note visée,
    // puis divisée par les jours restants — tout retard l'augmentait, jusqu'à
    // dix heures par jour. Elle découle maintenant de ce que l'étudiant a dit
    // pouvoir donner, et de rien d'autre.
    const a = budgetQuotidien({ capaciteQuotidienneH: 2, cap: 'consolider' });
    const b = budgetQuotidien({ capaciteQuotidienneH: 2, cap: 'viser-haut' });
    expect(a.total).toBe(120);
    expect(b.total).toBe(120);
  });

  it('répartit le temps selon l\'ambition', () => {
    const viser = budgetQuotidien({ capaciteQuotidienneH: 4, cap: 'viser-haut' });
    const consolider = budgetQuotidien({ capaciteQuotidienneH: 4, cap: 'consolider' });
    expect(viser.entrainement).toBeGreaterThan(consolider.entrainement);
    expect(viser.decouverte).toBeLessThan(consolider.decouverte);
  });

  it('conserve le total après répartition', () => {
    const b = budgetQuotidien({ capaciteQuotidienneH: 3, cap: 'progresser' });
    expect(b.decouverte + b.entretien + b.entrainement).toBeCloseTo(b.total, 0);
  });
});

describe('joursTravailles', () => {
  it('compte les journées distinctes', () => {
    expect(joursTravailles(assidu(5), 7, MAINTENANT)).toBe(5);
  });

  it('ne compte qu\'une fois plusieurs séances du même jour', () => {
    expect(joursTravailles([seance(0), seance(0), seance(0)], 7, MAINTENANT)).toBe(1);
  });

  it('ignore ce qui précède la fenêtre', () => {
    expect(joursTravailles([seance(20), seance(1)], 7, MAINTENANT)).toBe(1);
  });
});

describe('semainesTenues', () => {
  it('compte les semaines consécutives à l\'engagement', () => {
    expect(semainesTenues(assidu(21), 5, MAINTENANT)).toBe(3);
  });

  it('s\'arrête à la première semaine manquée', () => {
    // Deux semaines pleines, puis une semaine à deux jours seulement.
    const historique = [...assidu(14), seance(15), seance(16)];
    expect(semainesTenues(historique, 5, MAINTENANT)).toBe(2);
  });

  it('vaut zéro sans historique', () => {
    expect(semainesTenues([], 5, MAINTENANT)).toBe(0);
  });
});

describe('partStabilite', () => {
  it('mesure la part des cours ancrés', () => {
    const cursus = cursusAvec([{ nom: 'M', listeCM: [cours(30), cours(30), cours(2), cours(1)] }]);
    expect(partStabilite(cursus, 21)).toBe(0.5);
  });

  it('accepte les cours d\'avant la migration FSRS', () => {
    const cursus = cursusAvec([{ nom: 'M', listeCM: [{ titre: 'CM', jActuel: 25 }] }]);
    expect(partStabilite(cursus, 21)).toBe(1);
  });

  it('rend null sans aucun cours, plutôt que zéro', () => {
    expect(partStabilite(cursusAvec([{ nom: 'M', listeCM: [] }]), 21)).toBeNull();
  });
});

describe('evaluerPaliers', () => {
  const cursusPlein = cursusAvec([{
    nom: 'Mécanique 3',
    listeCM: [cours(30), cours(30)],
    listeTD: Array.from({ length: 8 }, (_, i) => ({ titre: `TD${i}`, nombrePratiques: 0 })),
  }]);

  it('n\'affiche qu\'un seul palier en cours à la fois', () => {
    const r = evaluerPaliers({ cap: 'progresser' }, assidu(3), cursusPlein, MAINTENANT);
    expect(r.enCours).not.toBeNull();
    expect(r.enCours.franchi).toBe(false);
  });

  it('franchit le premier palier dès trois journées', () => {
    const r = evaluerPaliers({}, assidu(3), cursusPlein, MAINTENANT);
    expect(r.paliers.find(p => p.cle === 'demarrage').franchi).toBe(true);
  });

  it('mesure la progression du palier en cours', () => {
    const r = evaluerPaliers({}, assidu(2), cursusPlein, MAINTENANT);
    const demarrage = r.paliers.find(p => p.cle === 'demarrage');
    expect(demarrage.franchi).toBe(false);
    expect(demarrage.progression).toBeCloseTo(2 / 3, 3);
  });

  it('reconnaît une réserve d\'exercices constituée', () => {
    const r = evaluerPaliers({}, [], cursusPlein, MAINTENANT);
    expect(r.paliers.find(p => p.cle === 'reserve').franchi).toBe(true);
  });

  it('ne compte pas comme réserve un exercice déjà travaillé', () => {
    const cursus = cursusAvec([{
      nom: 'M', listeCM: [],
      listeTD: Array.from({ length: 8 }, () => ({ titre: 'TD', nombrePratiques: 2 })),
    }]);
    const r = evaluerPaliers({}, [], cursus, MAINTENANT);
    expect(r.paliers.find(p => p.cle === 'reserve').franchi).toBe(false);
  });

  it('mesure la couverture de toutes les matières', () => {
    const cursus = cursusAvec([{ nom: 'Mécanique 3', listeCM: [] }, { nom: 'Optique 2', listeCM: [] }]);
    const r = evaluerPaliers({}, [seance(1, { matiere: 'Mécanique 3' })], cursus, MAINTENANT);
    const couverture = r.paliers.find(p => p.cle === 'couverture');
    expect(couverture.valeur).toBe(1);
    expect(couverture.cible).toBe(2);
  });

  it('ne dépend d\'aucune note', () => {
    // Les paliers décrivent l'état du travail, observable bien avant les
    // résultats : c'est ce qui permet de progresser sans attendre janvier.
    const avecNotes = cursusAvec([{
      nom: 'M', listeCM: [cours(30)],
      evaluations: [{ nom: 'DS', note: 4, coefficient: 1 }],
    }]);
    const sansNotes = cursusAvec([{ nom: 'M', listeCM: [cours(30)] }]);
    expect(evaluerPaliers({}, assidu(5), avecNotes, MAINTENANT).franchis)
      .toBe(evaluerPaliers({}, assidu(5), sansNotes, MAINTENANT).franchis);
  });

  it('survit à un cursus vide', () => {
    const r = evaluerPaliers({}, [], { licences: [] }, MAINTENANT);
    expect(r.total).toBeGreaterThan(0);
    expect(r.franchis).toBe(0);
  });
});

describe('engagementsHebdo', () => {
  it('mesure la semaine par rapport à l\'engagement du régime', () => {
    const e = engagementsHebdo({ cap: 'progresser', capaciteQuotidienneH: 2 }, assidu(5), MAINTENANT);
    expect(e.joursVises).toBe(5);
    expect(e.joursTenus).toBe(5);
    expect(e.joursAtteints).toBe(true);
    expect(e.reussie).toBe(true);
  });

  it('valide la semaine sur la régularité, même si le volume est court', () => {
    // C'est la régularité qui construit la mémoire : une semaine assidue mais
    // un peu légère reste une semaine réussie.
    const courtes = Array.from({ length: 5 }, (_, i) => seance(i, { dureeMinutes: 20 }));
    const e = engagementsHebdo({ cap: 'progresser', capaciteQuotidienneH: 2 }, courtes, MAINTENANT);
    expect(e.minutesAtteintes).toBe(false);
    expect(e.reussie).toBe(true);
  });

  it('ne valide pas une semaine irrégulière, même très chargée', () => {
    const bachotage = [seance(0, { dureeMinutes: 600 }), seance(1, { dureeMinutes: 600 })];
    const e = engagementsHebdo({ cap: 'progresser', capaciteQuotidienneH: 2 }, bachotage, MAINTENANT);
    expect(e.minutesAtteintes).toBe(true);
    expect(e.reussie).toBe(false);
  });
});

describe('etatObjectifs', () => {
  it('rassemble régime, budget, engagements et progression', () => {
    const etat = etatObjectifs(
      { cap: 'viser-haut', capaciteQuotidienneH: 3 },
      assidu(6),
      cursusAvec([{ nom: 'M', listeCM: [cours(30)] }]),
      MAINTENANT,
    );
    expect(etat.cap.cle).toBe('viser-haut');
    expect(etat.capacite).toBe(3);
    expect(etat.budget.total).toBe(180);
    expect(etat.engagements.joursVises).toBe(6);
    expect(etat.progression.paliers.length).toBeGreaterThan(0);
  });

  it('fonctionne sans aucune configuration', () => {
    const etat = etatObjectifs(undefined, undefined, undefined, MAINTENANT);
    expect(etat.cap.cle).toBe(CAP_DEFAUT);
    expect(Number.isFinite(etat.budget.total)).toBe(true);
  });
});

describe('Fenêtre des jours travaillés', () => {
  /*
   * Une fenêtre exprimée en `maintenant - N × 24 h` enjambe N + 1 journées
   * calendaires : sept jours glissants contiennent huit dates distinctes.
   * L'écran affichait « Cette semaine : 8 / 5 jours », et l'engagement se
   * déclarait tenu sur cette seule arithmétique.
   */
  const MIDI = new Date('2026-09-16T12:00:00').getTime();
  const JOUR = 86400000;

  /** Une séance par jour, sur `n` jours consécutifs jusqu'à aujourd'hui. */
  const seancesQuotidiennes = (n) => Array.from({ length: n }, (_, i) => ({
    id: `h${i}`, type: 'CM', matiere: 'Analyse', dureeMinutes: 30,
    timestamp: new Date(MIDI - i * JOUR).toISOString(),
  }));

  test('ne compte jamais plus de jours que la fenêtre n’en contient', () => {
    const etat = etatObjectifs({ cap: 'progresser' }, seancesQuotidiennes(30), undefined, MIDI);
    expect(etat.engagements.joursTenus).toBeLessThanOrEqual(7);
  });

  test('compte exactement les jours travaillés de la semaine', () => {
    // Trois jours travaillés parmi les sept derniers.
    const seances = [0, 2, 4].map(i => ({
      id: `h${i}`, type: 'CM', matiere: 'Analyse', dureeMinutes: 30,
      timestamp: new Date(MIDI - i * JOUR).toISOString(),
    }));
    expect(etatObjectifs({ cap: 'progresser' }, seances, undefined, MIDI).engagements.joursTenus).toBe(3);
  });

  test('ignore une séance antérieure à la fenêtre', () => {
    const seances = [{
      id: 'vieux', type: 'CM', matiere: 'Analyse', dureeMinutes: 30,
      timestamp: new Date(MIDI - 20 * JOUR).toISOString(),
    }];
    expect(etatObjectifs({ cap: 'progresser' }, seances, undefined, MIDI).engagements.joursTenus).toBe(0);
  });
});
