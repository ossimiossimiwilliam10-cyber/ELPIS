import { describe, it, expect } from 'vitest';
import {
  dureeDe, formaterDuree, filtrerParPeriode, serieParJour, repartitionParMatiere,
  joursCouverts, joursActifs, serieEnCours, indicateursCles, retentionDSR,
  metriquesFsrs, courbeOubli, projections, tonNote,
} from './statistiques';

// Midi, pour rester loin de la bascule de journée logique (4 h du matin).
const MIDI = new Date(2026, 8, 15, 12, 0, 0).getTime();
const JOUR = 86400000;

const seance = (extra = {}) => ({
  timestamp: new Date(MIDI).toISOString(),
  type: 'CM',
  titre: 'Groupes',
  matiere: 'Algèbre',
  dureeMinutes: 60,
  ...extra,
});

describe('dureeDe', () => {
  it('retient la durée enregistrée', () => {
    expect(dureeDe({ dureeMinutes: 45 })).toBe(45);
  });

  it('retombe sur 30 min pour l\'historique d\'avant le chronomètre', () => {
    expect(dureeDe({})).toBe(30);
    expect(dureeDe({ dureeMinutes: 0 })).toBe(30);
    expect(dureeDe({ dureeMinutes: 'trente' })).toBe(30);
    expect(dureeDe(null)).toBe(30);
  });
});

describe('formaterDuree', () => {
  it('écrit les minutes seules sous l\'heure', () => {
    expect(formaterDuree(45)).toBe('45 min');
    expect(formaterDuree(0)).toBe('0 min');
  });

  it('écrit heures et minutes au-delà', () => {
    expect(formaterDuree(90)).toBe('1h30');
    expect(formaterDuree(120)).toBe('2h00');
  });

  it('ignore les valeurs absurdes plutôt que d\'afficher NaN', () => {
    expect(formaterDuree(undefined)).toBe('0 min');
    expect(formaterDuree(-10)).toBe('0 min');
  });
});

describe('filtrerParPeriode', () => {
  const historique = [
    seance({ timestamp: new Date(MIDI - 2 * JOUR).toISOString() }),
    seance({ timestamp: new Date(MIDI - 40 * JOUR).toISOString() }),
    seance({ timestamp: 'pas une date' }),
  ];

  it('ne garde que la fenêtre demandée', () => {
    expect(filtrerParPeriode(historique, 7, MIDI)).toHaveLength(1);
    expect(filtrerParPeriode(historique, 90, MIDI)).toHaveLength(2);
  });

  it('rend tout l\'historique quand aucune borne n\'est donnée', () => {
    expect(filtrerParPeriode(historique, null, MIDI)).toHaveLength(3);
  });

  it('écarte les horodatages illisibles au lieu de les compter à zéro', () => {
    expect(filtrerParPeriode(historique, 365, MIDI).some(h => h.timestamp === 'pas une date')).toBe(false);
  });
});

describe('serieParJour', () => {
  it('ventile les minutes par type et par jour', () => {
    const points = serieParJour([
      seance({ type: 'CM', dureeMinutes: 60 }),
      seance({ type: 'TD', dureeMinutes: 30 }),
      seance({ type: 'CM', dureeMinutes: 15, timestamp: new Date(MIDI - JOUR).toISOString() }),
    ], 3, MIDI);

    expect(points).toHaveLength(3);
    expect(points[2]).toMatchObject({ CM: 60, TD: 30, TP: 0, ANNALE: 0 });
    expect(points[1].CM).toBe(15);
  });

  it('produit une journée vide plutôt qu\'un trou dans la courbe', () => {
    const points = serieParJour([], 5, MIDI);
    expect(points).toHaveLength(5);
    expect(points.every(p => p.CM === 0 && p.TD === 0)).toBe(true);
  });

  it('ignore les types hors CM/TD/TP/ANNALE', () => {
    const points = serieParJour([seance({ type: 'PROJET', dureeMinutes: 90 })], 1, MIDI);
    expect(points[0]).toMatchObject({ CM: 0, TD: 0, TP: 0, ANNALE: 0 });
  });
});

describe('repartitionParMatiere', () => {
  it('classe les matières par temps décroissant', () => {
    const parts = repartitionParMatiere([
      seance({ matiere: 'Analyse', dureeMinutes: 30 }),
      seance({ matiere: 'Algèbre', dureeMinutes: 120 }),
    ]);
    expect(parts.map(p => p.name)).toEqual(['Algèbre', 'Analyse']);
    expect(parts[0].value).toBe(2);
  });

  it('regroupe le surplus au lieu de le faire disparaître', () => {
    // Régression : le camembert était tronqué au top 5 en silence, donc le
    // total affiché ne correspondait pas au temps réellement travaillé.
    const historique = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((m, i) =>
      seance({ matiere: m, dureeMinutes: (10 - i) * 60 }));

    const parts = repartitionParMatiere(historique, 5);
    expect(parts).toHaveLength(6);
    expect(parts[5].estRegroupement).toBe(true);
    expect(parts[5].name).toBe('2 autres matières');
    expect(parts[5].minutes).toBe(5 * 60 + 4 * 60);
  });

  it('ne regroupe rien quand tout tient', () => {
    const parts = repartitionParMatiere([seance()], 5);
    expect(parts.some(p => p.estRegroupement)).toBe(false);
  });

  it('ignore les séances sans matière', () => {
    expect(repartitionParMatiere([seance({ matiere: null })])).toHaveLength(0);
  });
});

describe('joursCouverts', () => {
  it('rend la période demandée quand elle est bornée', () => {
    expect(joursCouverts([], 30, MIDI)).toBe(30);
  });

  it('mesure l\'ancienneté réelle sur « tout l\'historique »', () => {
    // Régression : la moyenne journalière divisait toujours par 90 jours, donc
    // deux ans d'activité donnaient un chiffre plusieurs fois trop élevé.
    const historique = [seance({ timestamp: new Date(MIDI - 730 * JOUR).toISOString() })];
    expect(joursCouverts(historique, null, MIDI)).toBe(730);
  });

  it('ne divise jamais par zéro', () => {
    expect(joursCouverts([], null, MIDI)).toBe(1);
    expect(joursCouverts([seance()], null, MIDI)).toBe(1);
  });
});

describe('joursActifs et serieEnCours', () => {
  it('compte une seule journée même avec plusieurs séances', () => {
    expect(joursActifs([seance(), seance(), seance()]).size).toBe(1);
  });

  it('compte les journées consécutives', () => {
    const historique = [0, 1, 2].map(i => seance({ timestamp: new Date(MIDI - i * JOUR).toISOString() }));
    expect(serieEnCours(historique, MIDI)).toBe(3);
  });

  it('ne casse pas la série tant que la journée en cours n\'est pas finie', () => {
    // Rien n'a encore été fait aujourd'hui : la série d'hier tient toujours.
    const historique = [1, 2].map(i => seance({ timestamp: new Date(MIDI - i * JOUR).toISOString() }));
    expect(serieEnCours(historique, MIDI)).toBe(2);
  });

  it('s\'arrête au premier jour manqué', () => {
    const historique = [0, 1, 3, 4].map(i => seance({ timestamp: new Date(MIDI - i * JOUR).toISOString() }));
    expect(serieEnCours(historique, MIDI)).toBe(2);
  });

  it('vaut zéro sans historique', () => {
    expect(serieEnCours([], MIDI)).toBe(0);
  });
});

describe('indicateursCles', () => {
  it('résume la période', () => {
    const historique = [
      seance({ dureeMinutes: 60 }),
      seance({ dureeMinutes: 30, timestamp: new Date(MIDI - JOUR).toISOString(), matiere: 'Analyse' }),
    ];
    const cles = indicateursCles(historique, 30, MIDI);

    expect(cles.totalHeures).toBe(1.5);
    expect(cles.joursActifs).toBe(2);
    expect(cles.joursCouverts).toBe(30);
    expect(cles.regularite).toBe(7); // 2 / 30
    expect(cles.matierePhare).toBe('Algèbre');
    expect(cles.serie).toBe(2);
  });

  it('rend une moyenne journalière lisible', () => {
    const historique = [seance({ dureeMinutes: 210 })];
    expect(indicateursCles(historique, 7, MIDI).moyenneQuotidienne).toBe('30 min');
  });

  it('survit à un historique vide', () => {
    const cles = indicateursCles([], 7, MIDI);
    expect(cles.totalHeures).toBe(0);
    expect(cles.matierePhare).toBeNull();
    expect(cles.regularite).toBe(0);
  });
});

describe('retentionDSR', () => {
  it('vaut 100 % au moment de la révision', () => {
    expect(retentionDSR(0, 10)).toBe(1);
  });

  it('vaut 90 % après un intervalle égal à la stabilité', () => {
    // R(S) = (1 + 1/9)⁻¹ = 0.9 : c'est la définition même de la stabilité FSRS.
    expect(retentionDSR(10, 10)).toBeCloseTo(0.9, 4);
    expect(retentionDSR(1, 1)).toBeCloseTo(0.9, 4);
  });

  it('décroît d\'autant plus lentement que la stabilité est grande', () => {
    expect(retentionDSR(30, 21)).toBeGreaterThan(retentionDSR(30, 3));
  });

  it('ne divise pas par zéro sur une carte neuve', () => {
    expect(Number.isFinite(retentionDSR(5, 0))).toBe(true);
  });
});

describe('metriquesFsrs', () => {
  const cursus = (listeCM) => ({
    licences: [{ semestres: [{ ues: [{ nom: 'UE A', matieres: [{ nom: 'Algèbre', listeCM }] }] }] }],
  });

  it('classe les cours par maturité de mémoire', () => {
    const m = metriquesFsrs(cursus([
      { fsrsCard: { stability: 1 } },
      { fsrsCard: { stability: 10 } },
      { fsrsCard: { stability: 40 } },
    ]), MIDI);

    expect(m.total).toBe(3);
    expect(m.maturite.map(n => n.value)).toEqual([1, 1, 1]);
    expect(m.stabiliteMoyenne).toBe(17);
  });

  it('compte une carte jamais révisée comme intacte', () => {
    const m = metriquesFsrs(cursus([{ fsrsCard: { stability: 5 } }]), MIDI);
    expect(m.retentionMoyenne).toBe(100);
  });

  it('applique l\'oubli au temps écoulé depuis la dernière révision', () => {
    const m = metriquesFsrs(cursus([
      { fsrsCard: { stability: 10, last_review: new Date(MIDI - 10 * JOUR).toISOString() } },
    ]), MIDI);
    expect(m.retentionMoyenne).toBeCloseTo(90, 0);
  });

  it('rend null sans aucune carte, pour ne pas afficher une section vide', () => {
    expect(metriquesFsrs(cursus([{ titre: 'sans carte' }]), MIDI)).toBeNull();
    expect(metriquesFsrs(null, MIDI)).toBeNull();
  });
});

describe('courbeOubli', () => {
  it('trace les repères et la courbe personnelle', () => {
    const c = courbeOubli(12);
    expect(c.reperes.some(r => r.estMien)).toBe(true);
    expect(c.points[0].jours).toBe(0);
    expect(c.points.length).toBeGreaterThan(60);
  });

  it('ne double pas un repère confondu avec la courbe personnelle', () => {
    const c = courbeOubli(7);
    expect(c.reperes.filter(r => Math.abs(r.s - 7) < 0.5)).toHaveLength(1);
  });

  it('rend null sur une stabilité inexploitable', () => {
    expect(courbeOubli(0)).toBeNull();
    expect(courbeOubli(NaN)).toBeNull();
  });
});

describe('projections', () => {
  const coursConfig = {
    licences: [{
      semestres: [{
        ues: [
          { nom: 'UE Mathématiques fondamentales', matieres: [{ nom: 'Algèbre' }, { nom: 'Analyse' }] },
          { nom: 'UE Physique', matieres: [{ nom: 'Mécanique' }] },
        ],
      }],
    }],
  };

  const intelligence = {
    projectedScoreMap: { 'algèbre': 16, 'analyse': 8, 'mécanique': 12 },
    velocityMap: { 'analyse': { isSlowLearner: true, masteredCMs: 2, totalCMs: 10 } },
  };

  it('trie les matières de la meilleure à la plus fragile', () => {
    const p = projections(intelligence, coursConfig);
    expect(p.matieres.map(m => m.matiere)).toEqual(['algèbre', 'mécanique', 'analyse']);
    expect(p.moyenne).toBe(12);
  });

  it('moyenne les matières par UE pour le radar', () => {
    const p = projections(intelligence, coursConfig);
    expect(p.radar).toEqual([
      { subject: 'UE Mathématiques fon…', valeur: 12, fullMark: 20 },
      { subject: 'UE Physique', valeur: 12, fullMark: 20 },
    ]);
  });

  it('remonte le signal de progression lente', () => {
    const p = projections(intelligence, coursConfig);
    const analyse = p.matieres.find(m => m.matiere === 'analyse');
    expect(analyse).toMatchObject({ apprentissageLent: true, cmMaitrises: 2, cmTotal: 10 });
  });

  it('rend null tant que l\'orchestrateur n\'a rien projeté', () => {
    expect(projections(null, coursConfig)).toBeNull();
    expect(projections({ projectedScoreMap: {} }, coursConfig)).toBeNull();
    expect(projections(intelligence, null)).toBeNull();
  });
});

describe('tonNote', () => {
  it('associe un ton à chaque palier', () => {
    expect(tonNote(16)).toBe('succes');
    expect(tonNote(11)).toBe('attention');
    expect(tonNote(6)).toBe('danger');
    expect(tonNote(null)).toBe('neutre');
  });
});
