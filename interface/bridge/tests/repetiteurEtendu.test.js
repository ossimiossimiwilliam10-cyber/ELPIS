import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { consulter } from '../moteur/repetiteur';
import { reconnaitre, matieresCitees } from '../moteur/repetiteur/intentions';
import {
  mesurerAbsences, mesurerSeries, tempsLibreDuJour,
  epreuvesDeclarees, mesurerTravail, etatAbsence,
} from '../moteur/repetiteur/connaissances';
import { citer, reglementLisible } from '../moteur/repetiteur/reglement';
import { normaliserLangue, voletExploitable } from '../moteur/langues';
import { dateLisible, echeanceJustificatif } from '../moteur/repetiteur/reponses';
import { saveCours } from '../moteur/cours';
import { saveConfig } from '../moteur/config';
import { saveHistorique } from '../moteur/historique';
import { getTodayString } from '../moteur/intelligence';
const { db } = require('../db/setup');

/**
 * Le Répétiteur au-delà de son premier périmètre.
 *
 * Ce fichier couvre les intentions ajoutées après la cartographie du moteur, et
 * surtout les quatre erreurs qu'elle a mises au jour dans du code déjà en
 * service. Chacune produisait une phrase juste en apparence :
 *
 *   - les absences étaient lues dans un champ `statut` que les données ne
 *     portent pas, si bien qu'une absence non justifiée passait pour « sans
 *     statut » et recevait une phrase rassurante ;
 *   - les dates d'épreuve étaient cherchées dans `examDates` alors que
 *     l'interface les écrit dans `evaluations[].date` — le Répétiteur aurait
 *     répondu « aucune date » pour toujours ;
 *   - « physique expérimentale » désignait « Méthodes mathématiques pour la
 *     physique », soit un chiffre exact attribué à la mauvaise matière ;
 *   - « que dois-je faire demain » recevait le programme d'aujourd'hui.
 *
 * Aucune ne se voyait à la lecture. C'est pour cela qu'elles sont testées.
 */

const AUJOURDHUI = getTodayString();
const formater = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ilYA = (n) => {
  const [a, m, j] = AUJOURDHUI.split('-').map(Number);
  const d = new Date(a, m - 1, j, 12, 0, 0);
  d.setDate(d.getDate() - n);
  return formater(d);
};
const dans = (n) => ilYA(-n);

const vider = () => db.exec(
  'DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config; DELETE FROM projets;'
);
afterAll(vider);

/** Cursus minimal mais complet : deux UE, trois matières, des épreuves datées. */
const cursus = () => ({
  licences: [{
    nom: 'L2 Physique',
    semestres: [{
      nom: 'Semestre 3', dateFin: dans(120),
      ues: [
        {
          nom: 'UE 1', ects: 12,
          matieres: [
            {
              nom: 'Mécanique 3', coefficient: 2, cm_h: 24, td_h: 18, tp_h: 0,
              ankiDeckName: 'Physique::Méca',
              evaluations: [
                { nom: 'Contrôle 1', coefficient: 1, note: null, type: 'AC', date: dans(20), statut: 'present', dureeMinutes: 60 },
                { nom: 'Examen', coefficient: 2, note: null, type: 'SC', date: dans(60), statut: 'present', dureeMinutes: 120 },
              ],
              listeCM: [{ titre: 'Ch1', jActuel: 7, derniereRevision: ilYA(3), prochaineRevisionDate: dans(4) }],
              listeTD: [{ titre: 'TD1', nombrePratiques: 1 }], listeTP: [], listeAnnales: [],
            },
            {
              nom: 'Mécanique 4 : Mécanique des fluides', coefficient: 1, cm_h: 12,
              evaluations: [], listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
            },
          ],
        },
        {
          nom: 'UE 2', ects: 6,
          matieres: [{
            nom: 'Électronique', coefficient: 2, cm_h: 20, td_h: 20,
            evaluations: [{ nom: 'CC', coefficient: 1, note: null, type: 'AC', date: null, statut: 'present', dureeMinutes: 30 }],
            listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
          }],
        },
      ],
    }],
  }],
});

const configDeBase = (extra = {}) => saveConfig({
  maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 3,
  bedtime: '23:00', wakeTime: '07:00',
  restDays: [], skippedRestDays: [],
  studyStartDate: dans(8),
  fixedCommitments: [{ day: 'Lundi', start: '08:00', end: '10:00', matiereLinked: 'Mécanique 3' }],
  ...extra,
});

beforeEach(() => {
  vider();
  configDeBase();
  saveCours(cursus());
  saveHistorique([]);
});

/* ------------------------------------------------------ Les erreurs corrigées */

describe('Absences : l’état se lit où il est écrit', () => {
  test('reconnaît les deux formes de saisie', () => {
    // `justifiee` est la forme des saisies anciennes, `statut` celle de la page
    // actuelle. Ne lire que la seconde rendait la première invisible.
    expect(etatAbsence({ justifiee: false })).toBe('non_justifiee');
    expect(etatAbsence({ justifiee: true })).toBe('justifiee');
    expect(etatAbsence({ statut: 'Non Justifié' })).toBe('non_justifiee');
    expect(etatAbsence({ statut: 'Dispensé' })).toBe('dispensee');
    expect(etatAbsence({})).toBe('inconnu');
  });

  test('ne rassure pas sur une absence non justifiée', () => {
    configDeBase({
      absences: [{ id: 'a1', matiere: 'Électronique', date: ilYA(5), justifiee: false }],
    });

    const r = consulter('Mes absences ?');
    expect(r.texte).toContain('1 non justifiée');
    expect(r.texte).toContain('À justifier');
    // La phrase servie jusqu'ici, alors que le délai courait.
    expect(r.texte).not.toMatch(/justificatif est déposé dans les délais/);
  });

  test('chiffre le délai restant et la date butoir', () => {
    configDeBase({
      absences: [{ id: 'a1', matiere: 'Optique', date: ilYA(5), justifiee: false }],
    });
    const a = mesurerAbsences({ absences: [{ id: 'a1', date: ilYA(5), justifiee: false }] });
    expect(a.aJustifierBientot[0].joursPourJustifier).toBe(2);
    expect(consulter('Mes absences ?').texte).toContain('il te reste 2 jours');
  });

  test('signale un délai dépassé plutôt que de le taire', () => {
    configDeBase({
      absences: [{ id: 'a1', matiere: 'Optique', date: ilYA(20), justifiee: false }],
    });
    const r = consulter('Mes absences ?');
    expect(r.texte).toMatch(/dépassé de 13 jours/);
  });

  test('la date butoir tombe sept jours après l’absence', () => {
    expect(echeanceJustificatif('2026-08-25', 7)).toBe('2026-09-01');
  });
});

describe('Épreuves : la date se lit là où l’interface l’écrit', () => {
  test('lit evaluations[].date, et pas seulement examDates', () => {
    // Le Bulletin écrit la date sur l'évaluation ; l'ancien code ne regardait
    // que `matiere.examDates`, resté vide. Le Répétiteur aurait répondu
    // « aucune date » même après la saisie.
    const datees = epreuvesDeclarees(cursus()).filter(e => e.date);
    expect(datees).toHaveLength(2);
    expect(datees.map(e => e.matiere)).toContain('Mécanique 3');
  });

  test('annonce la plus proche, avec son type et son coefficient', () => {
    const r = consulter('Quand est mon prochain examen ?');
    expect(r.texte).toContain('Mécanique 3');
    expect(r.texte).toContain('dans 20 jours');
    expect(r.texte).toContain('Contrôle 1');
  });

  test('décrit ce qui est déclaré quand rien n’est daté', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1,
      evaluations: [{ nom: 'CC1', coefficient: 1, type: 'AC', date: null, dureeMinutes: 60 }],
      listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
    }] }] }] }] });

    const r = consulter('Mes épreuves ?');
    expect(r.texte).toContain('aucune n’est datée');
    expect(r.texte).toContain('trente points sur cent');
  });
});

describe('Matière citée : ne pas se tromper de matière', () => {
  const noms = ['Mécanique 3', 'Mécanique 4 : Mécanique des fluides', 'Physique expérimentale 3', 'Physique expérimentale 4', 'Électronique'];

  test('retient un nom complet sans hésiter', () => {
    expect(matieresCitees('ma moyenne en électronique', noms)).toEqual(['Électronique']);
  });

  test('rend toutes les correspondances quand le repli hésite', () => {
    // Un chiffre exact attribué à la mauvaise matière est pire qu'un aveu.
    const trouvees = matieresCitees('où j’en suis en physique expérimentale', noms);
    expect(trouvees.length).toBeGreaterThan(1);
    expect(trouvees).toContain('Physique expérimentale 3');
    expect(trouvees).toContain('Physique expérimentale 4');
  });

  test('un mot répété dans l’intitulé ne fait pas gagner', () => {
    // « Mécanique 4 : Mécanique des fluides » l'emportait sur « Mécanique 3 »
    // pour la seule raison qu'il répète le mot.
    const trouvees = matieresCitees('ma moyenne en mécanique', noms);
    expect(trouvees).toContain('Mécanique 3');
    expect(trouvees.length).toBeGreaterThan(1);
  });

  test('demande laquelle au lieu de choisir', () => {
    const r = consulter('où j’en suis en mécanique ?');
    expect(r.texte).toContain('Plusieurs matières peuvent correspondre');
    expect(r.texte).toContain('Mécanique 3');
  });
});

describe('Demain : la garde', () => {
  test('refuse de donner le programme d’aujourd’hui pour celui de demain', () => {
    const r = consulter('Que dois-je faire demain ?');
    expect(r.intention).toBe('demain');
    expect(r.texte).toContain('Je ne sais pas dire ce que tu auras à faire demain');
  });

  test('couvre aussi « la semaine prochaine » et « après-demain »', () => {
    expect(reconnaitre('mon programme de la semaine prochaine')?.cle).toBe('demain');
    expect(reconnaitre('et après-demain ?')?.cle).toBe('demain');
  });

  test('donne quand même ce qui est réellement daté', () => {
    const r = consulter('Que dois-je faire demain ?');
    expect(r.texte).toContain('Mécanique 3');
    expect(r.texte).toContain('créneaux fixes');
  });
});

describe('Temps travaillé : ne pas inventer de minutes', () => {
  test('une séance sans durée ne vaut pas trente minutes', () => {
    // La table conserve délibérément le zéro ; le remplacer gonflait un total
    // que l'étudiant lit comme une mesure.
    const t = mesurerTravail([
      { timestamp: new Date().toISOString(), dureeMinutes: 0, matiere: 'X' },
      { timestamp: new Date().toISOString(), dureeMinutes: 45, matiere: 'X' },
    ], 7);
    expect(t.minutes).toBe(45);
    expect(t.sansDuree).toBe(1);
  });

  test('le dit dans la réponse au lieu de le masquer', () => {
    saveHistorique([
      { id: 'h1', type: 'CM', titre: 'A', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 60, timestamp: new Date().toISOString() },
      { id: 'h2', type: 'CM', titre: 'B', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 0, timestamp: new Date().toISOString() },
    ]);
    const r = consulter('Combien d’heures j’ai travaillé cette semaine ?');
    expect(r.texte).toContain('1 h');
    expect(r.texte).toMatch(/ne porte aucune durée/);
  });
});

/* ------------------------------------------------------ Les nouvelles réponses */

describe('Ce qui manque à la saisie', () => {
  test('nomme les manques dans l’ordre où ils débloquent le reste', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1, evaluations: [{ nom: 'CC', coefficient: 1, date: null }],
      listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
    }] }] }] }] });

    const r = consulter('Qu’est-ce qui manque ?');
    expect(r.intention).toBe('saisie_incomplete');
    expect(r.texte).toContain('Les chapitres');
    expect(r.texte.indexOf('Les chapitres')).toBeLessThan(r.texte.indexOf('Les dates d’épreuve'));
  });

  test('ne réclame rien quand tout est là', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1, ankiDeckName: 'A',
      evaluations: [{ nom: 'CC', coefficient: 1, date: dans(10) }],
      listeCM: [{ titre: 'Ch1', jActuel: 0, pdfPath: '/a.pdf' }],
      listeTD: [], listeTP: [], listeAnnales: [{ titre: 'An1' }],
    }] }] }] }] });

    expect(consulter('Qu’est-ce qui manque ?').texte).toContain('Ta saisie est complète');
  });
});

describe('La journée', () => {
  test('distingue le repos du week-end de l’anti-épuisement', () => {
    const r = consulter('Pourquoi je n’ai rien à faire aujourd’hui ?');
    expect(r.intention).toBe('pourquoi_repos');
    // Sans signal de fatigue, il ne faut pas laisser croire à une alerte.
    if (r.texte.includes('repos')) {
      expect(r.texte).not.toMatch(/Cause : l’anti-épuisement/);
    }
  });

  test('compte le temps restant depuis la capacité, pas depuis le rapport', () => {
    // `tempsDispoMin` est figé avant la soustraction du travail déjà fait, et
    // vaut zéro les jours de repos : le lire donnerait « 0 min disponible ».
    saveHistorique([
      { id: 'h1', type: 'CM', titre: 'A', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 90, timestamp: new Date().toISOString() },
    ]);
    const t = tempsLibreDuJour({ maxStudyHoursPerDay: 5 }, [
      { timestamp: new Date().toISOString(), dureeMinutes: 90 },
    ]);
    expect(t.capaciteMin).toBe(300);
    expect(t.resteMin).toBe(210);

    expect(consulter('Combien de temps il me reste ?').texte).toContain('3 h 30');
  });

  test('explique une absence du programme sans désigner un motif non constaté', () => {
    const r = consulter('Pourquoi il n’y a pas d’électronique aujourd’hui ?');
    expect(r.intention).toBe('absence_du_programme');
    expect(r.texte).toContain('Électronique');
    expect(r.texte).toContain('aucun chapitre n’est saisi');
  });
});

describe('Le cursus', () => {
  test('décrit la structure telle qu’elle est déclarée', () => {
    const r = consulter('Quelle est la structure de mon cursus ?');
    expect(r.texte).toContain('3 matières');
    expect(r.texte).toContain('2 UE');
    expect(r.texte).toContain('18 ECTS');
  });

  test('donne les coefficients, et les ECTS de l’UE', () => {
    const r = consulter('Quel coefficient a l’électronique ?');
    expect(r.texte).toContain('coefficient 2');
    expect(r.texte).toContain('6 ECTS');
  });

  test('additionne les volumes horaires de la maquette', () => {
    const r = consulter('Combien d’heures de cours ?');
    expect(r.texte).toContain('56 h de CM');
    expect(r.texte).toContain('38 h de TD');
  });

  test('restitue les créneaux fixes et ce qu’ils impliquent', () => {
    const r = consulter('Mon emploi du temps ?');
    expect(r.texte).toContain('Lundi 08:00–10:00');
    expect(r.texte).toContain('Mécanique 3');
    expect(r.texte).toContain('2 h');
  });

  test('compte les jours avant la reprise', () => {
    expect(consulter('C’est quand la rentrée ?').texte).toContain('dans 8 jours');
  });
});

describe('Le rythme', () => {
  test('mesure la série record et la série en cours séparément', () => {
    const seances = [0, 1, 2, 6, 7].map((n, i) => ({
      id: `h${i}`, type: 'CM', titre: 'X', matiere: 'Mécanique 3', action: 'Terminé',
      dureeMinutes: 30, timestamp: new Date(`${ilYA(n)}T12:00:00`).toISOString(),
    }));
    saveHistorique(seances);

    const s = mesurerSeries(seances);
    expect(s.record).toBe(3);
    expect(s.enCours).toBe(3);
    expect(consulter('Ma plus longue série ?').texte).toContain('3 jours consécutifs');
  });

  test('explique l’écart avec le badge plutôt que de le contredire', () => {
    // Le badge 🔥 de la barre latérale compte autrement : il s'incrémente à
    // chaque tâche validée et ne retombe qu'à l'ouverture suivante de
    // l'application. Quand les deux nombres divergent, se taire donnerait au
    // Répétiteur l'air de contredire l'écran d'à côté.
    configDeBase({ currentStreak: 6, lastActiveDate: ilYA(2) });
    saveHistorique([
      { id: 'h1', type: 'CM', titre: 'X', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 30, timestamp: new Date(`${ilYA(9)}T12:00:00`).toISOString() },
    ]);

    const r = consulter('Ma plus longue série ?');
    expect(r.texte).toContain('Aucune série en cours');
    expect(r.texte).toContain('Le badge 🔥 affiche 6 jours');
    expect(r.texte).toContain('recompté sur tes séances enregistrées');
  });

  test('ne mentionne pas le badge quand les deux s’accordent', () => {
    configDeBase({ currentStreak: 0 });
    saveHistorique([
      { id: 'h1', type: 'CM', titre: 'X', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 30, timestamp: new Date(`${ilYA(9)}T12:00:00`).toISOString() },
    ]);
    expect(consulter('Ma plus longue série ?').texte).not.toContain('badge');
  });

  test('ne confond pas « rien enregistré » et « rien fait »', () => {
    saveHistorique([
      { id: 'h1', type: 'CM', titre: 'X', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 30, timestamp: new Date(`${ilYA(5)}T12:00:00`).toISOString() },
    ]);
    const r = consulter('Qu’est-ce que j’ai fait hier ?');
    // La nuance tient dans la phrase elle-même : elle dit ce qui est constaté
    // (rien n'est enregistré) puis écarte explicitement la conclusion qu'on en
    // tirerait spontanément (qu'il n'aurait pas travaillé).
    expect(r.texte).toContain('aucune séance n’a été validée dans l’application');
    expect(r.texte).toContain('pas nécessairement que tu n’as pas travaillé');
  });

  test('avoue l’absence de mesure au lieu de rassurer sur la fatigue', () => {
    // Sans séance récente, « tu vas bien » serait une conclusion tirée du vide.
    const r = consulter('Est-ce que je suis en surcharge ?');
    expect(r.texte).toContain('je ne peux rien mesurer');
    expect(r.texte).toContain('c’est l’absence de mesure, pas un constat');
  });
});

describe('Le règlement : citer, pas conclure', () => {
  test('lit le fichier et le découpe en sections', () => {
    expect(reglementLisible()).toBe(true);
    expect(citer('reglement_assiduite')).toHaveLength(1);
  });

  test('cite le texte sur l’assiduité', () => {
    const r = consulter('La présence en TD est obligatoire ?');
    expect(r.intention).toBe('reglement_assiduite');
    expect(r.texte).toContain('travaux pratiques');
    expect(r.texte).toContain('la scolarité fait foi');
  });

  test('cite la progression pour le passage en L3', () => {
    const r = consulter('Est-ce que je passe en L3 ?');
    expect(r.intention).toBe('reglement_progression');
    expect(r.texte).toContain('AJAC');
  });

  test('ne prétend pas trancher un cas particulier', () => {
    const r = consulter('Comment marche la compensation ?');
    expect(r.texte).toContain('pas mon interprétation');
  });
});

describe('Langues : déclarée ne veut pas dire planifiable', () => {
  test('lit la forme ancienne, à plat, autant que la forme imbriquée', () => {
    // Une version antérieure de la page posait `livre` et `lienGrammaire` à la
    // racine de la langue ; la page actuelle écrit `grammaire.livre`. Ne lire
    // que la seconde rendait les fiches anciennes inexploitables : la langue
    // était déclarée, et aucune séance n'était jamais proposée.
    const ancienne = { id: 'esp', nom: 'Espagnol', cadence: 3, livre: 'Bescherelle', lienGrammaire: 'https://exemple.org/es' };
    const l = normaliserLangue(ancienne);
    expect(l.grammaire.livre).toBe('Bescherelle');
    expect(l.grammaire.liens.length).toBe(1);
    expect(voletExploitable(ancienne, 'grammaire')).toBe(true);
  });

  test('la forme imbriquée l’emporte sur l’ancienne', () => {
    const mixte = {
      id: 'esp', nom: 'Espagnol', cadence: 3,
      livre: 'Ancien livre',
      grammaire: { livre: 'Nouveau livre' },
    };
    expect(normaliserLangue(mixte).grammaire.livre).toBe('Nouveau livre');
  });

  test('annonce qu’une langue sans matière ne sera jamais proposée', () => {
    configDeBase({
      langues: [
        { id: 'esp', nom: 'Espagnol', cadence: 3, heuresAcquises: 140, livre: 'Bescherelle' },
        { id: 'jap', nom: 'Japonais', cadence: 2, heuresAcquises: 20 },
      ],
    });

    const r = consulter('Mes langues ?');
    // L'espagnol tient par sa grammaire ; le japonais n'a rien du tout.
    expect(r.texte).toContain('Japonais');
    expect(r.texte).toContain('Aucune séance ne peut être planifiée');
    expect(r.texte).toContain('Ajoute un paquet Anki, un livre ou un lien');
  });

  test('signale les volets sans matière d’une langue par ailleurs active', () => {
    configDeBase({
      langues: [{ id: 'esp', nom: 'Espagnol', cadence: 3, heuresAcquises: 140, livre: 'Bescherelle' }],
    });

    const r = consulter('Mes langues ?');
    expect(r.texte).toContain('Volets actifs : Grammaire');
    expect(r.texte).toMatch(/ces volets ne seront jamais proposés/);
  });
});

describe('Mise en forme', () => {
  test('accorde les pluriels irréguliers', () => {
    expect(consulter('Mon emploi du temps ?').texte).toContain('créneau');
    expect(consulter('Mon emploi du temps ?').texte).not.toContain('créneaus');
  });

  test('écrit le premier du mois en toutes lettres', () => {
    expect(dateLisible('2026-09-01')).toBe('1er septembre 2026');
    expect(dateLisible('2026-09-07')).toBe('7 septembre 2026');
  });
});
