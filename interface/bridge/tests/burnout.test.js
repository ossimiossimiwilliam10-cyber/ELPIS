import { describe, it, expect } from 'vitest';
import {
  evaluerFatigue, compterJoursSansRepos, mesurerCharge, compterSeancesTardives,
  dureeSeance, journeeLogique, JOURS_REPOS_FORCE, JOURS_ALERTE, SEANCES_TARDIVES_ALERTE,
} from '../moteur/burnout';

// Midi : loin de la bascule de journée logique, fixée à 4 h du matin.
const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
const JOUR = 86400000;

/** Séance à `n` jours dans le passé, à midi par défaut. */
const seance = (n, extra = {}) => {
  const d = new Date(MAINTENANT - n * JOUR);
  if (extra.heure !== undefined) d.setHours(extra.heure, 0, 0, 0);
  return { type: 'CM', dureeMinutes: 60, timestamp: d.toISOString(), ...extra };
};

/** Série de séances quotidiennes, de aujourd'hui à J−(n−1). */
const serie = (n, minutes = 60) =>
  Array.from({ length: n }, (_, i) => seance(i, { dureeMinutes: minutes }));

/** « AAAA-MM-JJ » de la journée logique située `n` jours en arrière. */
const jourLogique = (n) => journeeLogique(MAINTENANT - n * JOUR);

describe('dureeSeance', () => {
  it('retient la durée enregistrée', () => {
    expect(dureeSeance({ dureeMinutes: 45 })).toBe(45);
  });

  it('applique le repli propre à chaque type', () => {
    expect(dureeSeance({ type: 'ANNALE' }, { defaultDurationAnnales: 90 })).toBe(90);
    expect(dureeSeance({ type: 'TD' }, {})).toBe(20);
    expect(dureeSeance({ type: 'INCONNU' }, {})).toBe(30);
  });
});

describe('compterJoursSansRepos', () => {
  it('compte les journées consécutives travaillées', () => {
    expect(compterJoursSansRepos({}, serie(5), MAINTENANT).jours).toBe(5);
  });

  it('s\'arrête au premier jour de repos déclaré', () => {
    const cfg = { restDays: [jourLogique(3)] };
    expect(compterJoursSansRepos(cfg, serie(10), MAINTENANT).jours).toBe(3);
  });

  it('s\'arrête au premier jour non travaillé', () => {
    const historique = [seance(0), seance(1), seance(3), seance(4)];
    expect(compterJoursSansRepos({}, historique, MAINTENANT).jours).toBe(2);
  });

  it('ne casse pas la série tant que la journée en cours n\'est pas finie', () => {
    const historique = [seance(1), seance(2), seance(3)];
    expect(compterJoursSansRepos({}, historique, MAINTENANT).jours).toBe(4);
  });

  it('signale que le décompte est plafonné', () => {
    // Régression : quarante jours d'affilée s'affichaient comme trente, sans
    // que rien n'indique que la série était plus longue.
    const resultat = compterJoursSansRepos({}, serie(45), MAINTENANT);
    expect(resultat.jours).toBe(30);
    expect(resultat.plafonne).toBe(true);
  });

  it('vaut zéro quand aujourd\'hui est déclaré jour de repos', () => {
    const cfg = { restDays: [jourLogique(0)] };
    expect(compterJoursSansRepos(cfg, serie(10), MAINTENANT).jours).toBe(0);
  });
});

describe('mesurerCharge', () => {
  it('rapporte la charge à l\'ancienneté réelle de l\'historique', () => {
    // Régression : la moyenne divisait toujours par sept. Trois jours à quatre
    // heures donnaient « 1 h 43 par jour » au lieu de « 4 h ».
    const charge = mesurerCharge({}, serie(3, 240), MAINTENANT);
    expect(charge.fenetre).toBe(3);
    expect(charge.moyenneQuotidienne).toBe(240);
  });

  it('plafonne la fenêtre à sept jours', () => {
    const charge = mesurerCharge({}, serie(30, 60), MAINTENANT);
    expect(charge.fenetre).toBe(7);
  });

  it('ne compte que les séances de la semaine écoulée', () => {
    const historique = [seance(1, { dureeMinutes: 60 }), seance(20, { dureeMinutes: 600 })];
    expect(mesurerCharge({}, historique, MAINTENANT).totalMinutes).toBe(60);
  });

  it('ne divise pas par zéro sans historique', () => {
    const charge = mesurerCharge({}, [], MAINTENANT);
    expect(charge.moyenneQuotidienne).toBe(0);
    expect(Number.isFinite(charge.moyenneQuotidienne)).toBe(true);
  });
});

describe('compterSeancesTardives', () => {
  it('relève les séances entamées après le coucher', () => {
    const seances = [seance(0, { heure: 23 }), seance(1, { heure: 14 })];
    expect(compterSeancesTardives({ bedtime: '22:00' }, seances)).toBe(1);
  });

  it('compte aussi le milieu de la nuit', () => {
    const seances = [seance(0, { heure: 2 })];
    expect(compterSeancesTardives({ bedtime: '23:00' }, seances)).toBe(1);
  });

  it('retombe sur 23 h sans heure de coucher réglée', () => {
    expect(compterSeancesTardives({}, [seance(0, { heure: 23 })])).toBe(1);
    expect(compterSeancesTardives({}, [seance(0, { heure: 22 })])).toBe(0);
  });
});

describe('evaluerFatigue', () => {
  it('ne signale rien sur un rythme mesuré', () => {
    const r = evaluerFatigue({}, serie(3, 120), MAINTENANT);
    expect(r.riskLevel).toBe('none');
    expect(r.signaux).toEqual([]);
    expect(r.shouldForceRest).toBe(false);
  });

  it('impose le repos après une très longue série', () => {
    const r = evaluerFatigue({}, serie(JOURS_REPOS_FORCE, 60), MAINTENANT);
    expect(r.riskLevel).toBe('high');
    expect(r.shouldForceRest).toBe(true);
    expect(r.reason).toMatch(/jours consécutifs/);
  });

  it('impose le repos sur une série longue et chargée', () => {
    const r = evaluerFatigue({}, serie(15, 400), MAINTENANT);
    expect(r.riskLevel).toBe('high');
    expect(r.shouldForceRest).toBe(true);
  });

  it('alerte sans imposer sur une série moyenne', () => {
    const r = evaluerFatigue({}, serie(JOURS_ALERTE, 60), MAINTENANT);
    expect(r.riskLevel).toBe('medium');
    expect(r.shouldForceRest).toBe(false);
  });

  it('cumule les signaux au lieu de les masquer', () => {
    // Régression : les conditions s'excluaient. Dix jours sans repos et cinq
    // séances nocturnes n'affichaient que le premier motif, alors que le
    // second est celui sur lequel il est le plus facile d'agir.
    const historique = [
      ...serie(JOURS_ALERTE, 60),
      seance(0, { heure: 1 }), seance(1, { heure: 1 }), seance(2, { heure: 1 }),
    ];
    const r = evaluerFatigue({ bedtime: '23:00' }, historique, MAINTENANT);

    const cles = r.signaux.map(s => s.cle);
    expect(cles).toContain('serie-longue');
    expect(cles).toContain('seances-tardives');
    expect(r.reason).toMatch(/après ton heure de coucher/);
  });

  it('signale les séances tardives même isolées', () => {
    const historique = Array.from({ length: SEANCES_TARDIVES_ALERTE }, (_, i) => seance(i, { heure: 2 }));
    const r = evaluerFatigue({ bedtime: '23:00' }, historique, MAINTENANT);
    expect(r.riskLevel).toBe('low');
    expect(r.lateSessionCount).toBe(SEANCES_TARDIVES_ALERTE);
  });

  it('annonce une série plafonnée sans la faire passer pour exacte', () => {
    const r = evaluerFatigue({}, serie(45, 60), MAINTENANT);
    expect(r.daysWithoutRestCapped).toBe(true);
    expect(r.reason).toMatch(/plus de 30 jours/);
  });

  it('conserve les champs attendus par l\'orchestrateur et l\'interface', () => {
    const r = evaluerFatigue({}, serie(5, 90), MAINTENANT);
    for (const champ of ['riskLevel', 'shouldForceRest', 'reason', 'daysWithoutRest', 'avgDailyMinutes', 'lateSessionCount']) {
      expect(r).toHaveProperty(champ);
    }
    expect(Number.isNaN(r.avgDailyMinutes)).toBe(false);
  });

  it('survit à une configuration et un historique absents', () => {
    const r = evaluerFatigue(undefined, undefined, MAINTENANT);
    expect(r.riskLevel).toBe('none');
    expect(r.avgDailyMinutes).toBe(0);
  });
});
