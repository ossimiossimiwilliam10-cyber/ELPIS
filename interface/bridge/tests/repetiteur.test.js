import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import { reconnaitre, normaliser, matiereCitee } from '../moteur/repetiteur/intentions';
import { repondre, heures, enumerer } from '../moteur/repetiteur/reponses';
import { consulter } from '../moteur/repetiteur';
import { saveCours } from '../moteur/cours';
import { saveConfig } from '../moteur/config';
import { saveHistorique } from '../moteur/historique';
import { saveProjets } from '../moteur/projets';
const { getTodayString } = require('../moteur/intelligence');
const { db } = require('../db/setup');

/**
 * Le coach répond par calcul, pas par génération.
 *
 * L'ancien envoyait le cursus et l'historique à une API distante — sauf qu'il
 * les lisait dans `data/espoir_cours.json` et `data/espoir_historique.json`,
 * disparus lors du passage à SQLite. Il transmettait `{}` et `[]` : il ne
 * connaissait que le règlement, et rien de l'étudiant.
 *
 * Ces tests vérifient les deux propriétés qui justifient le changement : les
 * chiffres avancés sont ceux des tables, et une question incomprise reçoit un
 * aveu plutôt qu'une réponse plausible.
 */

/*
 * Les dates d'essai suivent la « journée logique » du moteur, pas le calendrier.
 *
 * ELPIS décale minuit de quatre heures : une séance finie à 1 h du matin compte
 * pour la veille. Dater le jeu d'essai avec `toISOString()` — donc en UTC —
 * faisait donc dériver ces tests d'un jour entier entre minuit et 4 h du matin,
 * et d'eux seuls dépendait alors le fait qu'ils passent ou non. Un test qui
 * tombe en panne à 2 h du matin sans qu'une ligne ait bougé ne prouve plus rien.
 *
 * On part donc de la journée logique du moteur et on compte en jours pleins.
 */
const MIDI = Date.now();
const AUJOURDHUI = getTodayString();

const formater = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Journée logique décalée de `n` jours (négatif = dans le futur). */
const ilYA = (n) => {
  const [a, m, j] = AUJOURDHUI.split('-').map(Number);
  const d = new Date(a, m - 1, j, 12, 0, 0);
  d.setDate(d.getDate() - n);
  return formater(d);
};
const dans = (n) => ilYA(-n);

/** Horodatage réel d'une séance, `n` jours en arrière. */
const seanceIlYA = (n) => new Date(MIDI - n * 86400000).toISOString();

const vider = () => db.exec(
  'DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config; DELETE FROM projets;'
);
afterAll(vider);

const cursus = () => ({
  licences: [{
    nom: 'L2 Physique',
    semestres: [{
      nom: 'Semestre 3', dateFin: dans(120),
      ues: [{
        nom: 'UE 1', ects: 12,
        matieres: [
          {
            nom: 'Mécanique 3', coefficient: 2, examDates: [dans(45)],
            evaluations: [{ note: 14, coefficient: 1 }, { note: 16, coefficient: 1 }],
            listeCM: [
              { titre: 'Ch1', jActuel: 7, derniereRevision: ilYA(3), prochaineRevisionDate: ilYA(-4) },
              { titre: 'Ch2', jActuel: 0 },
            ],
            listeTD: [{ titre: 'TD1', nombrePratiques: 2 }, { titre: 'TD2', nombrePratiques: 0 }],
            listeTP: [], listeAnnales: [],
          },
          {
            nom: 'Électronique', coefficient: 2,
            evaluations: [{ note: 8, coefficient: 1 }],
            listeCM: [{ titre: 'Élec 1', jActuel: 0 }],
            listeTD: [], listeTP: [], listeAnnales: [],
          },
        ],
      }],
    }],
  }],
});

beforeEach(() => {
  vider();
  saveConfig({
    maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 4,
    restDays: [ilYA(3), ilYA(10)], skippedRestDays: [], bedtime: '23:00',
    langues: [{ id: 'esp', nom: 'Espagnol', heuresAcquises: 140, cadence: 3, dernieresPratiques: { vocabulaire: ilYA(2) } }],
    absences: [{ id: 'a1', matiere: 'Électronique', date: ilYA(8), statut: 'Non Justifié' }],
  });
  saveCours(cursus());
  saveHistorique([
    { id: 'h1', type: 'CM', titre: 'Ch1', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 60, timestamp: seanceIlYA(1) },
    { id: 'h2', type: 'TD', titre: 'TD1', matiere: 'Mécanique 3', action: 'Terminé', dureeMinutes: 30, timestamp: seanceIlYA(2) },
    { id: 'h3', type: 'CM', titre: 'Élec 1', matiere: 'Électronique', action: 'Terminé', dureeMinutes: 45, timestamp: seanceIlYA(2) },
  ]);
  saveProjets([{ id: 'p1', titre: 'Portfolio', dateFin: '2026-12-20', phases: [{ id: 'f1', nom: 'Maquette', complete: true }, { id: 'f2', nom: 'Intégration', complete: false }] }]);
});

describe('Reconnaissance des questions', () => {
  test('ignore accents, casse et ponctuation', () => {
    expect(normaliser('Où en suis-JE ?')).toBe('ou en suis je');
    expect(normaliser("Qu'est-ce que j'ai ?")).toBe('qu est ce que j ai');
  });

  test('reconnaît les formulations courantes', () => {
    const attendu = {
      'Que dois-je faire aujourd’hui ?': 'programme_du_jour',
      'Quelle est ma moyenne ?': 'moyenne',
      "Qu'est-ce qui est en retard ?": 'retard',
      'Où en suis-je ?': 'avancement',
      "Combien d'heures j'ai travaillé ?": 'temps_travaille',
      'Quand est mon prochain examen ?': 'examens',
      'Mes absences ?': 'absences',
      'Comment ça marche ?': 'methode',
      'Bonjour': 'salutation',
    };
    for (const [question, cle] of Object.entries(attendu)) {
      expect(reconnaitre(question)?.cle, question).toBe(cle);
    }
  });

  test('rend null sur une question hors de sa portée', () => {
    // C'est la propriété qui distingue ce coach d'un modèle de langage :
    // il sait qu'il ne sait pas.
    expect(reconnaitre('Explique-moi la relativité générale')).toBeNull();
    expect(reconnaitre('')).toBeNull();
    expect(reconnaitre('azerty qwerty')).toBeNull();
  });

  test('retient la matière citée, même partiellement', () => {
    const noms = ['Mathématiques pour les Sciences Physiques 3', 'Mécanique 3', 'Électronique'];
    expect(matiereCitee('ma moyenne en mécanique 3', noms)).toBe('Mécanique 3');
    expect(matiereCitee('où j’en suis en électronique', noms)).toBe('Électronique');
    expect(matiereCitee('et en mathematiques ?', noms)).toBe('Mathématiques pour les Sciences Physiques 3');
    expect(matiereCitee('et alors ?', noms)).toBeNull();
  });
});

describe('Réponses appuyées sur les données', () => {
  test('donne la moyenne réellement calculée', () => {
    const r = consulter('Quelle est ma moyenne ?');
    expect(r.compris).toBe(true);
    // Mécanique 3 : (14+16)/2 = 15, coef 2 ; Électronique : 8, coef 2.
    // UE = (15×2 + 8×2) / 4 = 11.50
    expect(r.texte).toContain('11.50/20');
    expect(r.texte).toContain('Mécanique 3');
  });

  test('répond sur une matière précise quand elle est citée', () => {
    const r = consulter('Ma moyenne en électronique ?');
    expect(r.texte).toContain('8.00/20');
    expect(r.texte).not.toContain('Mécanique');
  });

  test('chiffre le temps travaillé sur la bonne fenêtre', () => {
    const r = consulter("Combien d'heures j'ai travaillé cette semaine ?");
    // 60 + 30 + 45 = 135 min sur deux journées distinctes.
    expect(r.texte).toContain('2 h 15');
    expect(r.texte).toContain('2 jours');
  });

  test('annonce la prochaine épreuve et le compte à rebours', () => {
    const r = consulter('Quand est mon prochain examen ?');
    expect(r.texte).toContain('Mécanique 3');
    expect(r.texte).toContain('dans 45 jours');
  });

  test('décrit l’avancement d’une matière', () => {
    const r = consulter('Où j’en suis en mécanique 3 ?');
    expect(r.texte).toContain('1 cours abordé sur 2');
  });

  test('rend compte des langues, absences et projets', () => {
    expect(consulter('Mes langues ?').texte).toContain('Espagnol');
    expect(consulter('Mes absences ?').texte).toContain('1 absence');
    expect(consulter('Mes projets ?').texte).toContain('Portfolio');
  });

  test('accorde les états d’absence et n’invente pas de défaillance', () => {
    saveConfig({
      maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 4,
      restDays: [], skippedRestDays: [], bedtime: '23:00',
      absences: [
        { id: 'a1', matiere: 'Électronique', date: ilYA(8), statut: 'Justifié' },
        { id: 'a2', matiere: 'Électronique', date: ilYA(9), statut: 'Justifié' },
        { id: 'a3', matiere: 'Mécanique 3', date: ilYA(4) },
      ],
    });

    const r = consulter('Mes absences ?');
    expect(r.texte).toContain('2 justifiées');
    expect(r.texte).toContain('1 sans état renseigné');
    // Le règlement réserve la défaillance aux épreuves : l'affirmer pour une
    // absence en cours était faux, et c'était le texte affiché jusqu'ici.
    expect(r.texte).not.toContain('défaillance');
  });

  test('accorde correctement les mots invariables', () => {
    // « 3 cours », jamais « 3 courss ».
    expect(consulter('Où en suis-je ?').texte).not.toMatch(/courss/);
  });
});

describe('Ce que le coach refuse de faire', () => {
  test('avoue son incompréhension au lieu d’improviser', () => {
    const r = consulter('Explique-moi la mécanique quantique en trois phrases');
    expect(r.compris).toBe(false);
    expect(r.texte).toContain('Je n’ai pas compris');
    expect(r.texte).toContain('Je sais parler de');
  });

  test('énumère ses capacités quand on le lui demande', () => {
    const r = consulter('Que sais-tu faire ?');
    expect(r.intention).toBe('aide');
    expect(r.texte).toContain('tes moyennes');
  });

  test('ne prétend pas connaître des notes absentes', () => {
    expect(saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [
      { nom: 'Analyse', coefficient: 1, listeCM: [{ titre: 'C1', jActuel: 0 }], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] })).toBe(true);
    const r = consulter('Quelle est ma moyenne ?');
    expect(r.texte).toContain('Aucune note n’est saisie');
  });

  test('guide vers la Bibliothèque quand rien n’est saisi', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [
      { nom: 'Analyse', coefficient: 1, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] },
    ] }] }] }] });
    const r = consulter('Que dois-je faire aujourd’hui ?');
    expect(r.texte).toContain('Bibliothèque');
  });
});

describe('Retards', () => {
  /** Cursus réduit à un chapitre dont le retard dépasse largement son cycle. */
  const cursusEnRetard = () => ({
    licences: [{
      nom: 'L', semestres: [{
        nom: 'S', ues: [{
          nom: 'U', ects: 6, matieres: [{
            nom: 'Analyse', coefficient: 1,
            listeCM: [
              { titre: 'Suites', jActuel: 5, derniereRevision: ilYA(30), prochaineRevisionDate: ilYA(25) },
              { titre: 'Séries', jActuel: 7, derniereRevision: ilYA(4), prochaineRevisionDate: ilYA(-3) },
            ],
            listeTD: [], listeTP: [], listeAnnales: [],
          }],
        }],
      }],
    }],
  });

  test('nomme le chapitre décroché et chiffre le retard', () => {
    saveCours(cursusEnRetard());
    const r = consulter("Qu'est-ce qui est en retard ?");
    expect(r.texte).toContain('Suites');
    expect(r.texte).toContain('25 jours de retard');
    // « Séries » n'est pas encore due : elle ne doit pas grossir le compte.
    expect(r.texte).not.toContain('Séries');
  });

  test('reste exact un jour de repos, où le rapport ne mesure plus rien', () => {
    // Le rapport s'interrompt avant de compter les retards les jours de repos.
    // S'y fier ferait répondre « rien n'a décroché » alors qu'un chapitre
    // traîne depuis un mois — le seul mensonge que ce coach doit s'interdire.
    saveCours(cursusEnRetard());
    saveConfig({
      maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 4,
      restDays: [AUJOURDHUI], skippedRestDays: [], bedtime: '23:00',
    });

    const jour = consulter('Que dois-je faire aujourd’hui ?');
    expect(jour.texte).toMatch(/repos/i);

    const r = consulter("Qu'est-ce qui est en retard ?");
    expect(r.texte).toContain('Suites');
    expect(r.texte).not.toMatch(/Rien n’a décroché/);
  });

  test('distingue « rien en retard » de « rien à réviser »', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1,
      listeCM: [{ titre: 'Suites', jActuel: 7, derniereRevision: ilYA(2), prochaineRevisionDate: ilYA(-5) }],
      listeTD: [], listeTP: [], listeAnnales: [],
    }] }] }] }] });

    const r = consulter("Qu'est-ce qui est en retard ?");
    expect(r.texte).toContain('aucune révision n’est arrivée à échéance');
  });

  test('retombe sur la dernière révision quand la date cible manque', () => {
    // Les chapitres saisis avant l'introduction de `prochaineRevisionDate` n'en
    // portent pas : l'orchestrateur repart alors de l'intervalle, et le coach
    // doit compter comme lui.
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1,
      listeCM: [{ titre: 'Suites', jActuel: 4, derniereRevision: ilYA(20) }],
      listeTD: [], listeTP: [], listeAnnales: [],
    }] }] }] }] });

    const r = consulter("Qu'est-ce qui est en retard ?");
    expect(r.texte).toContain('Suites');
    expect(r.texte).toContain('16 jours de retard'); // 20 écoulés − 4 d'intervalle
  });

  test('ne compte pas un chapitre jamais abordé comme un retard', () => {
    saveCours({ licences: [{ nom: 'L', semestres: [{ nom: 'S', ues: [{ nom: 'U', ects: 6, matieres: [{
      nom: 'Analyse', coefficient: 1,
      listeCM: [{ titre: 'Suites', jActuel: 0 }],
      listeTD: [], listeTP: [], listeAnnales: [],
    }] }] }] }] });

    // Un cours jamais ouvert est à découvrir, pas à rattraper.
    expect(consulter("Qu'est-ce qui est en retard ?").texte).toMatch(/Rien n’a décroché/);
  });
});

describe('Mise en forme', () => {
  test('exprime les durées lisiblement', () => {
    expect(heures(45)).toBe('45 min');
    expect(heures(60)).toBe('1 h');
    expect(heures(135)).toBe('2 h 15');
    expect(heures(0)).toBe('0 min');
  });

  test('énumère à la française', () => {
    expect(enumerer(['a'])).toBe('a');
    expect(enumerer(['a', 'b'])).toBe('a et b');
    expect(enumerer(['a', 'b', 'c'])).toBe('a, b et c');
  });
});
