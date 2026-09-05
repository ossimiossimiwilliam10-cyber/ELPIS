import { describe, it, expect } from 'vitest';
import {
  ETAPES, planifierTP, etapeCourante, dureeEtape, motifLisible, samediPrecedent, joursEntre,
} from '../moteur/tp';

// Le TP a lieu le jeudi 18 mars 2027 ; le samedi qui précède est le 13.
const TP_JEUDI = new Date(2027, 2, 18, 10);
const jour = (n, heure = 10) => new Date(2027, 2, n, heure).getTime();

/** TP daté, ayant franchi `faites` étapes. */
const tp = (faites, extra = {}) => ({
  titre: 'TP 3 — Circuits RLC',
  dateTP: '18-03-2027',
  nombrePratiques: faites,
  ...extra,
});

describe('samediPrecedent', () => {
  it('remonte au samedi qui précède la séance', () => {
    expect(samediPrecedent(TP_JEUDI).getDate()).toBe(13);
    expect(samediPrecedent(TP_JEUDI).getDay()).toBe(6);
  });

  it('ne renvoie jamais le jour même', () => {
    const samedi = new Date(2027, 2, 20); // le TP tombe un samedi
    expect(samediPrecedent(samedi).getDate()).toBe(13);
  });
});

describe('etapeCourante', () => {
  it('suit le nombre de passages', () => {
    expect(etapeCourante(tp(0)).cle).toBe('decouverte');
    expect(etapeCourante(tp(2)).cle).toBe('verification');
    expect(etapeCourante(tp(4)).cle).toBe('seance');
  });

  it('rend null une fois le cycle bouclé', () => {
    expect(etapeCourante(tp(5))).toBeNull();
  });
});

describe('planifierTP — fenêtre de préparation', () => {
  it('ne propose rien tant que le week-end précédent n\'est pas arrivé', () => {
    // Une découverte trois semaines à l'avance laisse le sujet se refroidir.
    expect(planifierTP(tp(0), jour(5))).toBeNull();
    expect(planifierTP(tp(0), jour(12))).toBeNull();
  });

  it('ouvre la préparation le samedi précédent', () => {
    const plan = planifierTP(tp(0), jour(13));
    expect(plan.etape.cle).toBe('decouverte');
    expect(plan.motif).toBe('PREPARATION');
    expect(plan.joursAvant).toBe(5);
  });

  it('enchaîne la planification le même jour que la découverte', () => {
    // C'est le cœur de la méthode : simuler le TP dans la foulée de sa lecture.
    const plan = planifierTP(tp(1, { dernierePratique: '2027-03-13' }), jour(13, 15));
    expect(plan.etape.cle).toBe('planification');
  });

  it('refuse une seconde découverte le même jour', () => {
    expect(planifierTP(tp(0, { dernierePratique: '2027-03-13' }), jour(13, 15))).toBeNull();
  });
});

describe('planifierTP — la règle de la tête fraîche', () => {
  it('refuse la vérification le jour de la planification', () => {
    // C'est le point clé de la méthode : ce que la veille laisse passer, le
    // lendemain le voit.
    expect(planifierTP(tp(2, { dernierePratique: '2027-03-13' }), jour(13, 20))).toBeNull();
  });

  it('propose la vérification le lendemain', () => {
    const plan = planifierTP(tp(2, { dernierePratique: '2027-03-13' }), jour(14));
    expect(plan.etape.cle).toBe('verification');
    expect(plan.motif).toBe('VERIFICATION_LENDEMAIN');
  });
});

describe('planifierTP — la veille et le jour J', () => {
  it('garde la révision finale pour la veille', () => {
    expect(planifierTP(tp(3), jour(15))).toBeNull();
    const plan = planifierTP(tp(3), jour(17));
    expect(plan.etape.cle).toBe('revision');
    expect(plan.motif).toBe('REVISION_VEILLE');
    expect(plan.urgence).toBe('haute');
  });

  it('rattrape la veille ce qui n\'a pas été fait', () => {
    const plan = planifierTP(tp(1), jour(17));
    expect(plan.etape.cle).toBe('planification');
    expect(plan.motif).toBe('RATTRAPAGE_VEILLE');
  });

  it('propose la séance le jour même', () => {
    // L'ancien système faisait disparaître le TP après la quatrième étape,
    // alors que c'est le jour de la séance que le rendu se joue.
    const plan = planifierTP(tp(4), jour(18));
    expect(plan.etape.cle).toBe('seance');
    expect(plan.urgence).toBe('immediate');
    expect(plan.retard).toBe(0);
  });

  it('signale une préparation incomplète le jour de la séance', () => {
    const plan = planifierTP(tp(1), jour(18));
    expect(plan.etape.cle).toBe('seance');
    expect(plan.retard).toBe(3);
  });

  it('cesse de proposer un TP passé', () => {
    expect(planifierTP(tp(2), jour(19))).toBeNull();
  });

  it('cesse une fois le cycle bouclé', () => {
    expect(planifierTP(tp(5), jour(17))).toBeNull();
  });
});

describe('planifierTP — TP sans date connue', () => {
  const sansDate = (faites) => ({ titre: 'TP', nombrePratiques: faites });

  it('retombe sur une préparation de week-end', () => {
    const samedi = jour(13); // 13 mars 2027 est un samedi
    const plan = planifierTP(sansDate(0), samedi);
    expect(plan.motif).toBe('PREPARATION_WEEKEND');
  });

  it('ne propose rien en semaine', () => {
    expect(planifierTP(sansDate(0), jour(17))).toBeNull();
  });

  it('s\'arrête après la vérification, faute de date de séance', () => {
    expect(planifierTP(sansDate(3), jour(13))).toBeNull();
  });

  it('ignore une date illisible', () => {
    const plan = planifierTP({ nombrePratiques: 0, dateTP: 'la semaine prochaine' }, jour(13));
    expect(plan.motif).toBe('PREPARATION_WEEKEND');
  });
});

describe('dureeEtape', () => {
  it('applique les durées configurées', () => {
    const cfg = { defaultDurationTP_Etape2: 200 };
    expect(dureeEtape(2, cfg)).toBe(200);
    expect(dureeEtape(1, {})).toBe(45);
    expect(dureeEtape(5, {})).toBe(120);
  });

  it('préfère le temps réellement constaté', () => {
    const mesure = { tempsMoyenEtapes: [50, 210, null, null] };
    expect(dureeEtape(2, {}, mesure)).toBe(210);
    expect(dureeEtape(3, {}, mesure)).toBe(90);
  });
});

describe('motifLisible', () => {
  it('dit ce qui reste à faire le jour de la séance', () => {
    expect(motifLisible({ motif: 'SEANCE_AUJOURD_HUI', retard: 2 })).toMatch(/2 étapes/);
    expect(motifLisible({ motif: 'SEANCE_AUJOURD_HUI', retard: 0 })).toMatch(/tout est prêt/);
  });

  it('annonce le délai avant la séance', () => {
    expect(motifLisible({ motif: 'PREPARATION', joursAvant: 5 })).toMatch(/dans 5 jours/);
  });

  it('reste muet sur un plan absent', () => {
    expect(motifLisible(null)).toBeNull();
  });
});

describe('joursEntre', () => {
  it('compte des journées entières, quelle que soit l\'heure', () => {
    expect(joursEntre(jour(13, 23), jour(18, 1))).toBe(5);
  });

  it('devient négatif pour une date passée', () => {
    expect(joursEntre(jour(19), jour(18))).toBe(-1);
  });
});

describe('ETAPES', () => {
  it('décrit les cinq temps dans l\'ordre', () => {
    expect(ETAPES.map(e => e.cle)).toEqual([
      'decouverte', 'planification', 'verification', 'revision', 'seance',
    ]);
    expect(ETAPES.every(e => e.nom && e.intention)).toBe(true);
  });
});
