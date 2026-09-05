import { describe, it, expect, afterEach } from 'vitest';
import { getMatiereAverage, matiereDefaillante, buildExamUrgencyMap, buildWorkloadForecast } from '../moteur/intelligence';
import { parcourirMatieres } from '../moteur/repetiteur/connaissances';
import { loadConfig } from '../moteur/config';
import { saveCours, loadCours } from '../moteur/cours';
import { construireVelocites } from '../moteur/velocite';
import { definirSource } from '../moteur/stockage';
import { pointsCouverture, contexteDepuisExercice } from '../moteur/priorite';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
import { consulter, reconnaitre } from '../moteur/repetiteur';
import { compterJoursSansRepos, evaluerFatigue } from '../moteur/burnout';
import { buildTimeOptimizationMap, getTodayString } from '../moteur/intelligence';

/**
 * Une même donnée, une seule valeur.
 *
 * Les défauts réunis ici se ressemblaient tous : deux endroits du code
 * répondaient à la même question et n'étaient pas d'accord. Aucun ne
 * provoquait d'erreur — c'est bien le problème. Un plantage se voit ; deux
 * chiffres différents pour la même matière se croient.
 *
 * Ils étaient tous dormants au moment de la correction : le cursus ne contient
 * encore ni note, ni chapitre, ni date d'épreuve. Ils se seraient réveillés
 * l'un après l'autre à mesure que l'année se remplit — c'est-à-dire au pire
 * moment. D'où ces tests, qui les tiennent fermés.
 */

const CONFIG_MINIMALE = {
  bedtime: '23:00', wakeUpTime: '07:00', maxSubjectsPerDay: 3,
  restDays: [], skippedRestDays: [], fixedCommitments: [], langues: [], absences: [],
};

/** Branche le moteur sur des documents en mémoire, le temps d'un test. */
function avecDocuments({ config = CONFIG_MINIMALE, cours = { licences: [] } } = {}) {
  definirSource({
    lireConfig: () => JSON.parse(JSON.stringify(config)),
    ecrireConfig: () => {},
    lireCours: () => JSON.parse(JSON.stringify(cours)),
    ecrireCours: () => {},
    lireHistorique: () => [],
    ecrireHistorique: () => {},
    lireProjets: () => [],
    ecrireProjets: () => {},
  });
}

afterEach(() => definirSource(null));

describe('La moyenne d’une matière', () => {
  /*
   * Le bulletin appliquait le règlement, le moteur l'ignorait. Les deux
   * affichaient une moyenne, sans jamais dire qu'ils ne comptaient pas pareil.
   */

  it('ne compte pas une épreuve neutralisée, même si une note y traîne', () => {
    // Une absence justifiée conserve parfois la note saisie avant que le statut
    // ne change. Elle valait 14 au bulletin et 9 au moteur.
    const m = { evaluations: [
      { note: 14, coefficient: 1 },
      { note: 4, coefficient: 1, statut: 'excuse' },
    ] };
    expect(getMatiereAverage(m).avg).toBe(14);
  });

  it('écarte la note d’une épreuve défaillante du calcul', () => {
    const m = { evaluations: [
      { note: 14, coefficient: 1 },
      { note: 2, coefficient: 1, statut: 'defaillant' },
    ] };
    expect(getMatiereAverage(m).avg).toBe(14);
  });

  it('signale la défaillance au lieu de la taire', () => {
    /*
     * Le moteur alimente des calculs de priorité : il doit rendre un nombre et
     * ne peut pas porter le « DEF » du bulletin. Il porte donc le fait à côté,
     * pour que personne ne prenne une matière défaillante pour une matière
     * simplement pas encore évaluée.
     */
    const m = { evaluations: [
      { note: 14, coefficient: 1 },
      { note: null, coefficient: 1, statut: 'defaillant' },
    ] };
    expect(getMatiereAverage(m).defaillant).toBe(true);
    expect(matiereDefaillante(m)).toBe(true);
  });

  it('n’invente pas de zéro quand rien n’est calculable', () => {
    // Attribuer 0 à une matière uniquement défaillante ferait entrer un chiffre
    // faux dans les priorités. On rend `null`, comme pour une matière vierge.
    const m = { evaluations: [{ note: null, coefficient: 1, statut: 'defaillant' }] };
    expect(getMatiereAverage(m)).toBeNull();
    expect(matiereDefaillante(m)).toBe(true);
  });

  it('reste silencieuse sur une matière sans note', () => {
    expect(getMatiereAverage({ evaluations: [] })).toBeNull();
    expect(matiereDefaillante({ evaluations: [] })).toBe(false);
  });
});

describe('L’inventaire du cursus vu par le Répétiteur', () => {
  /*
   * Le Répétiteur et l'ordonnanceur parcourent le même cursus. Ils ne le
   * filtraient pas pareil : le premier réclamait du travail sur des matières
   * que le second avait cessé de proposer.
   */

  const cursusAvec = (semestres) => ({ licences: [{ nom: 'L2 Physique', semestres }] });
  const matiere = (nom, extra = {}) => ({ nom, coefficient: 1, evaluations: [], listeCM: [], listeTD: [], listeTP: [], listeAnnales: [], ...extra });

  it('ignore un semestre dont la date de fin est passée', () => {
    const crs = cursusAvec([
      { nom: 'Semestre 3', dateFin: '2020-01-16', ues: [{ nom: 'UE 1', ects: 6, matieres: [matiere('Mécanique 3')] }] },
      { nom: 'Semestre 4', dateFin: '2099-05-28', ues: [{ nom: 'UE 2', ects: 6, matieres: [matiere('Mécanique 4')] }] },
    ]);
    const noms = parcourirMatieres(crs).map(x => x.matiere.nom);
    expect(noms).toEqual(['Mécanique 4']);
  });

  it('ignore une matière dispensée', () => {
    const crs = cursusAvec([{
      nom: 'Semestre 4', dateFin: '2099-05-28',
      ues: [{ nom: 'UE 1', ects: 6, matieres: [matiere('Anglais', { dispense: true }), matiere('Optique')] }],
    }]);
    expect(parcourirMatieres(crs).map(x => x.matiere.nom)).toEqual(['Optique']);
  });

  it('ignore une licence archivée', () => {
    const crs = { licences: [{ nom: 'L1', archived: true, semestres: [
      { nom: 'Semestre 1', dateFin: '2099-01-01', ues: [{ nom: 'UE 1', matieres: [matiere('Maths 1')] }] },
    ] }] };
    expect(parcourirMatieres(crs)).toHaveLength(0);
  });

  it('supporte un cursus absent sans se plaindre', () => {
    expect(parcourirMatieres(null)).toEqual([]);
    expect(parcourirMatieres({ licences: [] })).toEqual([]);
  });
});

describe('La capacité quotidienne', () => {
  /*
   * Deux champs pour une seule notion : `capaciteQuotidienneH`, le seul que
   * l'interface règle, et `maxStudyHoursPerDay`, le seul que l'ordonnanceur
   * lise. Ils coïncidaient par hasard. Le jour où le curseur bougeait, la
   * journée planifiée ne bougeait pas.
   */

  it('fait suivre le réglage de l’interface jusqu’à l’ordonnanceur', () => {
    for (const heures of [3, 5, 6, 7.5]) {
      avecDocuments({ config: { ...CONFIG_MINIMALE, capaciteQuotidienneH: heures } });
      expect(loadConfig().maxStudyHoursPerDay).toBe(heures);
    }
  });

  it('garde l’ancien champ quand aucune capacité n’est déclarée', () => {
    // Une configuration d'avant le curseur ne doit pas se retrouver rabotée.
    avecDocuments({ config: { ...CONFIG_MINIMALE, maxStudyHoursPerDay: 6 } });
    expect(loadConfig().maxStudyHoursPerDay).toBe(6);
  });

  it('ne se laisse pas dicter une capacité absurde', () => {
    avecDocuments({ config: { ...CONFIG_MINIMALE, capaciteQuotidienneH: 99 } });
    expect(loadConfig().maxStudyHoursPerDay).toBeLessThanOrEqual(24);
  });
});

describe('L’urgence d’un examen', () => {
  /*
   * Faute d'épreuve datée, l'urgence retombait sur la fin du semestre. La
   * borne est légitime — rien ne s'évalue après — mais ce n'est pas une date
   * d'examen. À six semaines de la fin du semestre, les dix-neuf matières
   * auraient annoncé « Examen à venir » le même jour, avec le même
   * multiplicateur : une urgence que tout le monde partage ne hiérarchise rien.
   */

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const cursus = (dateFin, evaluations) => ({ licences: [{ nom: 'L2', semestres: [{
    nom: 'Semestre 3', dateFin,
    ues: [{ nom: 'UE 1', ects: 6, matieres: [{ nom: 'Optique', coefficient: 1, evaluations }] }],
  }] }] });

  it('marque comme estimée la date tirée de la fin du semestre', () => {
    const carte = buildExamUrgencyMap(cursus(dans(40), []));
    expect(carte.optique.estimee).toBe(true);
  });

  it('n’en tire aucune urgence, même à trois jours de la fin', () => {
    // C'est ici que l'ancien calcul basculait à 3× pour toutes les matières.
    const carte = buildExamUrgencyMap(cursus(dans(3), []));
    expect(carte.optique.multiplier).toBe(1.0);
  });

  it('garde toute son urgence à une épreuve réellement déclarée', () => {
    // La date exacte dépend de la journée logique, décalée de quatre heures :
    // ce qui compte ici est qu'une épreuve datée pousse, quand la borne ne
    // pousse pas.
    const carte = buildExamUrgencyMap(cursus(dans(120), [{ nom: 'DS1', date: dans(3) }]));
    expect(carte.optique.estimee).toBe(false);
    expect(carte.optique.multiplier).toBeGreaterThan(1.0);
    expect(carte.optique.daysToExam).toBeLessThan(10);
  });

  it('ignore une épreuve déjà passée et retombe sur la borne', () => {
    const carte = buildExamUrgencyMap(cursus(dans(120), [{ nom: 'DS1', date: dans(5), note: 12 }]));
    expect(carte.optique.estimee).toBe(true);
    expect(carte.optique.multiplier).toBe(1.0);
  });
});

describe('Ce qu’une tâche dit d’elle-même', () => {

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('ne déclare pas « jamais travaillé » un chapitre qui porte une date de révision', () => {
    /*
     * Le libellé se déduisait du seul compteur de passages. Ce compteur peut
     * manquer — donnée ancienne, import, carte refusée par FSRS — sur un
     * chapitre pourtant révisé, et l'étudiant lisait alors le contraire de ce
     * qu'il avait fait.
     */
    const jamais = pointsCouverture(0, false);
    expect(jamais.detail.libelle).toBe('Jamais travaillé');

    const dejaVu = pointsCouverture(0, true);
    expect(dejaVu.detail).toBeNull();
  });

  it('compte les répétitions portées par la carte FSRS', () => {
    // `repetitions` est la copie que tient l'interface ; la source est la carte.
    const ctx = contexteDepuisExercice({ derniereRevision: dans(-10), fsrsCard: { reps: 4 } }, { nom: 'Optique' });
    expect(ctx.nombrePratiques).toBe(4);
  });

  it('n’annonce pas une note en danger à une matière sans note', () => {
    /*
     * La projection fusionne notes, maîtrise et rétention. Sans note et sans
     * chapitre maîtrisé, elle vaut 0 sur 20 — avec un intervalle immense. Le
     * programme du jour en tirait « URGENCE_NOTE » : au premier jour d'une
     * année, toutes les matières auraient été déclarées en crise à la fois.
     */
    const cursus = (evaluations) => ({ licences: [{ nom: 'L2', semestres: [{
      nom: 'S3', dateFin: dans(120),
      ues: [{ nom: 'UE 1', ects: 6, matieres: [{
        nom: 'Optique', coefficient: 2, evaluations,
        listeTD: [], listeTP: [], listeAnnales: [],
        listeCM: [{ titre: 'Ch1', jActuel: 5, derniereRevision: dans(-20), prochaineRevisionDate: dans(-10), repetitions: 2 }],
      }] }],
    }] }] });

    const raisonsAvec = (evaluations) => {
      avecDocuments({
        config: { ...CONFIG_MINIMALE, capaciteQuotidienneH: 5, studyStartDate: dans(-30) },
        cours: cursus(evaluations),
      });
      const r = genererRapportQuotidien(0, false, null);
      return (r.tachesDuJour || []).flatMap(t => t.raisons || []);
    };

    expect(raisonsAvec([])).not.toContain('URGENCE_NOTE');
    expect(raisonsAvec([{ nom: 'DS1', note: 3, coefficient: 1 }])).toContain('URGENCE_NOTE');
  });
});

describe('Ce que le programme d’un jour affirme sans preuve', () => {
  /*
   * Deux affirmations tirées du vide, sur le même écran.
   *
   * Les ratios de complétion valent 1 quand la liste est vide — lisible comme
   * « rien à faire » côté ordonnancement, mais lu comme « tout est fait » par le
   * verdict de maîtrise. Et l'urgence d'examen retombait sur la fin du semestre
   * même là où le libellé EXAMEN_PROCHE, lui, avait été corrigé : la même
   * donnée servait deux lectures, une seule avait été réparée.
   */

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const raisonsPour = ({ dateFin, evaluations = [], listeCM = [], listeTD = [] }) => {
    avecDocuments({
      config: { ...CONFIG_MINIMALE, capaciteQuotidienneH: 5, studyStartDate: dans(-30), enableAnnales: true },
      cours: { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', dateFin, ues: [{ nom: 'UE 1', ects: 6, matieres: [{
        nom: 'Optique', coefficient: 2, evaluations, listeCM, listeTD, listeTP: [],
        listeAnnales: [{ titre: 'Annale 2024', datePrevue: dans(-5) }],
      }] }] }] }] },
    });
    return (genererRapportQuotidien(0, false, null).tachesDuJour || []).flatMap(t => t.raisons || []);
  };

  it('ne crie pas « examen imminent » quand aucune épreuve n’est datée', () => {
    // À trois semaines de la fin du semestre, les dix-neuf matières auraient
    // toutes été déclarées imminentes le même jour.
    expect(raisonsPour({ dateFin: dans(15) })).not.toContain('EXAMEN_IMMINENT');
  });

  it('crie « examen imminent » quand une épreuve est réellement déclarée', () => {
    const raisons = raisonsPour({ dateFin: dans(15), evaluations: [{ nom: 'DS1', date: dans(10) }] });
    expect(raisons).toContain('EXAMEN_IMMINENT');
  });

  it('ne déclare pas maîtrisée une matière où rien n’est saisi', () => {
    // Aucun chapitre, aucun TD : il n'y a rien à maîtriser.
    expect(raisonsPour({ dateFin: dans(200) })).not.toContain('MAITRISE_ATTEINTE');
  });

  it('reconnaît la maîtrise quand il y a bien quelque chose de fait', () => {
    const raisons = raisonsPour({
      dateFin: dans(200),
      listeCM: [
        { titre: 'Ch1', jActuel: 5, derniereRevision: dans(-3), repetitions: 4 },
        { titre: 'Ch2', jActuel: 5, derniereRevision: dans(-4), repetitions: 3 },
      ],
      listeTD: [
        { titre: 'TD1', dernierePratique: dans(-2), nombrePratiques: 1 },
        { titre: 'TD2', dernierePratique: dans(-1), nombrePratiques: 1 },
      ],
    });
    expect(raisons.some(r => r === 'MAITRISE_ATTEINTE' || r === 'DEFI_PRECOCE')).toBe(true);
  });
});

describe('La prévision de charge', () => {
  /*
   * Elle n'est affichée nulle part aujourd'hui, et c'est la seule raison pour
   * laquelle personne n'a vu ses chiffres. Ils étaient faux de trois façons :
   * les jours sans travail étaient absents de la série alors que le résultat
   * était étiqueté sur des jours de calendrier, une durée nulle déclarée valait
   * trente minutes, et l'intervalle de confiance à 95 % pouvait être de largeur
   * nulle — c'est-à-dire annoncer une certitude.
   */

  const JOUR = 86400000;
  /*
   * Midi, toujours.
   *
   * La journée logique du moteur est décalée de quatre heures : une séance
   * horodatée à 1 h du matin appartient à la veille. Un horodatage qui porte
   * l'heure courante fait donc basculer les fixtures d'un jour selon l'heure à
   * laquelle la suite tourne — et un test qui ne passe qu'en journée ne prouve
   * rien la nuit.
   */
  const aMidi = (n) => {
    const d = new Date(Date.now() - n * JOUR);
    d.setHours(12, 0, 0, 0);
    return d;
  };
  const ilYA = (n) => aMidi(n).toISOString();
  const sommeSemaine = (f) => f.reduce((a, x) => a + x.forecastMinutes, 0);

  it('se tait quand elle n’a rien à dire', () => {
    expect(buildWorkloadForecast([], {})).toEqual([]);
    expect(buildWorkloadForecast(null, {})).toEqual([]);
    // Moins de trois jours observés : pas de quoi extrapoler une semaine.
    expect(buildWorkloadForecast([{ timestamp: ilYA(1), dureeMinutes: 60 }], {})).toEqual([]);
  });

  it('ne multiplie plus par sept une séance hebdomadaire', () => {
    /*
     * Le cas qui donnait 21 h annoncées pour une semaine qui en vaut 3 : la
     * série ne contenait que les samedis, tassés les uns contre les autres,
     * et le résultat était ensuite étalé sur sept jours de calendrier.
     */
    const samedis = [];
    for (let s = 0; s < 8; s++) samedis.push({ timestamp: ilYA(7 * s + 1), dureeMinutes: 180, type: 'CM' });

    const heures = sommeSemaine(buildWorkloadForecast(samedis, {})) / 60;
    expect(heures).toBeLessThan(6);   // 21 h autrefois
    expect(heures).toBeGreaterThan(1);
  });

  it('prévoit zéro les jours où l’étudiant ne travaille jamais', () => {
    const semaine = [];
    for (let j = 1; j <= 28; j++) {
      const d = aMidi(j);
      if (d.getDay() !== 0 && d.getDay() !== 6) semaine.push({ timestamp: d.toISOString(), dureeMinutes: 120, type: 'CM' });
    }
    const f = buildWorkloadForecast(semaine, {});
    const weekEnd = f.filter(x => { const d = new Date(x.date + 'T12:00:00'); return d.getDay() === 0 || d.getDay() === 6; });

    expect(weekEnd.length).toBeGreaterThan(0);
    for (const jour of weekEnd) expect(jour.forecastMinutes).toBe(0);
    expect(f.every(x => x.saisonnier)).toBe(true);
  });

  it('n’annonce jamais un intervalle de confiance de largeur nulle', () => {
    // Trois jours rigoureusement identiques : « 60 min, entre 60 et 60 », à 95 %.
    const plats = [1, 2, 3].map(j => ({ timestamp: ilYA(j), dureeMinutes: 60, type: 'CM' }));
    const f = buildWorkloadForecast(plats, {});
    expect(f.length).toBe(7);
    for (const jour of f) expect(jour.ci_upper - jour.ci_lower).toBeGreaterThan(0);
  });

  it('ne transforme pas une durée nulle déclarée en trente minutes', () => {
    const zeros = [1, 2, 3, 4].map(j => ({ timestamp: ilYA(j), dureeMinutes: 0, type: 'CM' }));
    expect(sommeSemaine(buildWorkloadForecast(zeros, {}))).toBe(0);
  });

  it('se sert des durées réglées quand la séance n’en porte pas', () => {
    // Le paramètre `cfg` était accepté puis ignoré : les réglages de l'étudiant
    // ne servaient nulle part ici, alors que l'ordonnanceur s'en sert.
    const sansDuree = [1, 2, 3, 4, 5, 6, 7].map(j => ({ timestamp: ilYA(j), type: 'TD' }));
    const avecReglage = buildWorkloadForecast(sansDuree, { defaultDurationTD: 90 });
    const parDefaut = buildWorkloadForecast(sansDuree, {});
    expect(sommeSemaine(avecReglage)).toBeGreaterThan(sommeSemaine(parDefaut));
  });

  it('dit sur combien d’observations elle repose', () => {
    const serie = [1, 2, 3, 4, 5].map(j => ({ timestamp: ilYA(j), dureeMinutes: 90, type: 'CM' }));
    const f = buildWorkloadForecast(serie, {});
    expect(f[0].joursObserves).toBeGreaterThanOrEqual(5);
    expect(typeof f[0].observationsCeJour).toBe('number');
  });
});

describe('Pourquoi une matière n’est pas au programme', () => {
  /*
   * Deux défauts se cumulaient sur cette seule question.
   *
   * Le premier tenait au routage : les motifs ignorent l'ordre des mots, et
   * « pourquoi tu me proposes ça » est plus long que « tu ne me proposes pas ».
   * La question négative recevait donc l'explication du programme retenu — une
   * réponse cohérente, chiffrée, et qui ne portait pas sur ce qu'on demandait.
   *
   * Le second tenait à l'ordonnanceur : il écartait ses candidats par une
   * demi-douzaine de refus muets. Avec dix-neuf matières et un quota de trois
   * par jour, seize sont écartées chaque matin. Le Répétiteur ne pouvait
   * qu'avouer son ignorance sur une cause pourtant déterministe.
   */

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const NOMS = ['Mécanique 3', 'Optique 2', 'Thermodynamique', 'Électronique', 'Maths 3'];

  function cursusCharge() {
    const matieres = NOMS.map(n => ({
      nom: n, coefficient: 2, evaluations: [], listeTD: [], listeTP: [], listeAnnales: [],
      listeCM: [
        { titre: `${n} ch1`, jActuel: 5, derniereRevision: dans(-20), prochaineRevisionDate: dans(-10), repetitions: 2 },
        { titre: `${n} ch2`, jActuel: 5, derniereRevision: dans(-18), prochaineRevisionDate: dans(-8), repetitions: 2 },
      ],
    }));
    return { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', dateFin: dans(120), ues: [{ nom: 'UE 1', ects: 60, matieres }] }] }] };
  }

  const brancher = () => avecDocuments({
    config: { ...CONFIG_MINIMALE, capaciteQuotidienneH: 8, maxSubjectsPerDay: 2, studyStartDate: dans(-30) },
    cours: cursusCharge(),
  });

  it('distingue « pourquoi tu me proposes ça » de « pourquoi tu ne me le proposes pas »', () => {
    expect(reconnaitre('pourquoi tu me proposes Électronique ?').cle).toBe('pourquoi');
    expect(reconnaitre('pourquoi tu ne me proposes pas Optique 2 ?').cle).toBe('absence_du_programme');
    expect(reconnaitre('pourquoi Optique 2 n’est pas au programme ?').cle).toBe('absence_du_programme');
  });

  it('ne détourne pas la question du repos vers une matière', () => {
    // « pourquoi pas de repos ? » partait chercher une matière nommée « repos ».
    expect(reconnaitre('pourquoi pas de repos ?').cle).toBe('pourquoi_repos');
  });

  it('le rapport garde la trace de ce qu’il a écarté, et pourquoi', () => {
    brancher();
    const r = genererRapportQuotidien(0, false, null);

    expect(Array.isArray(r.candidatsEcartes)).toBe(true);
    expect(r.candidatsEcartes.length).toBeGreaterThan(0);
    for (const c of r.candidatsEcartes) {
      expect(typeof c.motif).toBe('string');
      expect(c.motif.length).toBeGreaterThan(0);
    }
    // Un candidat finalement retenu ne figure pas parmi les écartés.
    const retenus = new Set((r.tachesDuJour || []).map(t => `${t.matiere}|${t.titre}`));
    for (const c of r.candidatsEcartes) {
      expect(retenus.has(`${c.matiere}|${c.titre}`)).toBe(false);
    }
  });

  it('le Répétiteur nomme la règle qui a sorti la matière', () => {
    brancher();
    const r = genererRapportQuotidien(0, false, null);
    const ecartee = (r.candidatsEcartes || [])[0];
    expect(ecartee).toBeTruthy();

    const texte = consulter(`pourquoi tu ne me proposes pas ${ecartee.matiere} ?`).texte;
    expect(texte).toContain(ecartee.matiere);
    expect(texte).toMatch(/écarté/);
    // Et surtout : plus d'aveu d'ignorance là où la cause est connue.
    expect(texte).not.toMatch(/je ne peux pas te le dire avec certitude/i);
  });
});

describe('Renommer une matière', () => {
  /*
   * L'historique désigne la matière par son nom, en chaîne, et tous les
   * rapprochements du moteur sont des égalités strictes. Renommer une matière —
   * un clic dans sa fiche, aucun avertissement — détachait donc tout son passé :
   * trente heures mesurées devenaient zéro. Pas « inconnu » : zéro. Un accent,
   * une majuscule ou une espace finale suffisaient.
   *
   * L'identifiant de la matière, lui, ne bouge pas : c'est par lui qu'on
   * reconnaît un renommage.
   */

  const ID_A = '00000000-0000-4000-8000-00000000000a';
  const ID_B = '00000000-0000-4000-8000-00000000000b';

  const cursusAvec = (matieres) => ({
    licences: [{ id: 'L', nom: 'L2', semestres: [{ id: 'S', nom: 'S3', dateFin: '2099-01-01',
      ues: [{ id: 'U', nom: 'UE 1', matieres }] }] }],
  });

  const matiere = (id, nom) => ({
    id, nom, coefficient: 2, evaluations: [],
    listeCM: [{ titre: 'Ch1', jActuel: 5, derniereRevision: '2026-08-20', repetitions: 3 }],
    listeTD: [], listeTP: [], listeAnnales: [],
  });

  /** Une source en mémoire qui garde ses écritures, comme le fait l'appareil. */
  function appareilAvec(cursusInitial, journalInitial) {
    const etat = { cursus: cursusInitial, journal: journalInitial };
    definirSource({
      lireConfig: () => ({}), ecrireConfig: () => {},
      lireCours: () => JSON.parse(JSON.stringify(etat.cursus)),
      ecrireCours: (c) => { etat.cursus = JSON.parse(JSON.stringify(c)); },
      lireHistorique: () => JSON.parse(JSON.stringify(etat.journal)),
      ecrireHistorique: (h) => { etat.journal = JSON.parse(JSON.stringify(h)); },
      lireProjets: () => [], ecrireProjets: () => {},
    });
    return etat;
  }

  const seances = (nom, combien) => Array.from({ length: combien }, (_, i) => ({
    timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    matiere: nom, type: 'CM', dureeMinutes: 90,
  }));

  const minutesMesurees = (journal) => {
    const v = construireVelocites(loadCours(), journal);
    const cle = Object.keys(v)[0];
    return cle ? v[cle].totalStudyMinutes : 0;
  };

  it('fait suivre l’historique à la matière renommée', () => {
    const etat = appareilAvec(cursusAvec([matiere(ID_A, 'Mécanique 3')]), seances('Mécanique 3', 20));
    expect(minutesMesurees(etat.journal)).toBe(1800);

    saveCours(cursusAvec([matiere(ID_A, 'Mécanique 3 (S3)')]));

    expect(etat.journal.every(h => h.matiere === 'Mécanique 3 (S3)')).toBe(true);
    expect(minutesMesurees(etat.journal)).toBe(1800);
  });

  it('suit aussi un simple accent ou une majuscule', () => {
    // Ce sont les renommages les plus probables, et ils détachaient tout autant.
    for (const nouveau of ['Mecanique 3', 'mécanique 3', 'Mécanique 3 ']) {
      const etat = appareilAvec(cursusAvec([matiere(ID_A, 'Mécanique 3')]), seances('Mécanique 3', 5));
      saveCours(cursusAvec([matiere(ID_A, nouveau)]));
      expect(minutesMesurees(etat.journal)).toBe(450);
    }
  });

  it('refuse de déplacer un historique devenu ambigu', () => {
    /*
     * Deux matières portent le même nom ; l'une est renommée. La migration se
     * fait sur le nom : elle emporterait aussi l'historique de l'autre. Mieux
     * vaut laisser en place et le dire que déplacer à l'aveugle.
     */
    const etat = appareilAvec(
      cursusAvec([matiere(ID_A, 'Optique'), matiere(ID_B, 'Optique')]),
      seances('Optique', 4),
    );
    saveCours(cursusAvec([matiere(ID_A, 'Optique avancée'), matiere(ID_B, 'Optique')]));

    expect(etat.journal.every(h => h.matiere === 'Optique')).toBe(true);
  });

  it('ne touche à rien quand aucun nom ne change', () => {
    const etat = appareilAvec(cursusAvec([matiere(ID_A, 'Optique')]), seances('Optique', 3));
    const avant = JSON.stringify(etat.journal);
    saveCours(cursusAvec([matiere(ID_A, 'Optique')]));
    expect(JSON.stringify(etat.journal)).toBe(avant);
  });

  it('laisse tranquille l’historique d’une matière disparue du cursus', () => {
    // Une matière retirée n'est pas une matière renommée : son passé reste
    // sous son nom, et le Répétiteur peut dire qu'il ne le rattache à rien.
    const etat = appareilAvec(cursusAvec([matiere(ID_A, 'Optique')]), seances('Chimie', 3));
    saveCours(cursusAvec([matiere(ID_A, 'Optique renommée')]));
    expect(etat.journal.every(h => h.matiere === 'Chimie')).toBe(true);
  });
});

describe('Le repos déclaré puis travaillé', () => {
  /*
   * La série se cassait sur la seule déclaration de repos. Poser un dimanche
   * puis y travailler trois heures remettait le compteur à zéro, et le repos
   * imposé au bout de vingt-et-un jours ne se déclenchait alors plus jamais :
   * la veille anti-épuisement était désarmée pour exactement l'étudiant qui
   * pose une pause et la grille.
   */

  const JOUR = 86400000;
  const MAINTENANT = new Date(2026, 8, 15, 12).getTime();
  const jourLogique = (n) => {
    const d = new Date(MAINTENANT - n * JOUR);
    d.setHours(d.getHours() - 4);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** 36 jours d'affilée, avec une charge particulière le jour déclaré repos. */
  const serie = (minutesAuRepos, indexRepos = 20, longueur = 36) =>
    Array.from({ length: longueur }, (_, i) => {
      const d = new Date(MAINTENANT - i * JOUR);
      d.setHours(12, 0, 0, 0);
      return { type: 'CM', matiere: 'X', dureeMinutes: i === indexRepos ? minutesAuRepos : 120, timestamp: d.toISOString() };
    });

  const cfg = { restDays: [jourLogique(20)], skippedRestDays: [], capaciteQuotidienneH: 5 };

  it('ne compte pas comme repos une journée réellement travaillée', () => {
    const troisHeures = serie(180);
    expect(compterJoursSansRepos(cfg, troisHeures, MAINTENANT).jours).toBeGreaterThan(20);
    expect(evaluerFatigue(cfg, troisHeures, MAINTENANT).shouldForceRest).toBe(true);
  });

  it('laisse une journée légère rester du repos', () => {
    // Trente minutes d'Anki un dimanche n'annulent pas une journée de pause :
    // le tout-ou-rien se tromperait dans l'autre sens.
    const trenteMinutes = serie(30);
    expect(compterJoursSansRepos(cfg, trenteMinutes, MAINTENANT).jours).toBe(20);
    expect(evaluerFatigue(cfg, trenteMinutes, MAINTENANT).shouldForceRest).toBe(false);
  });

  it('respecte un repos déclaré et réellement chômé', () => {
    const chome = serie(120).filter((_, i) => i !== 20);
    expect(compterJoursSansRepos(cfg, chome, MAINTENANT).jours).toBe(20);
  });
});

describe('Les heures de travail les plus efficaces', () => {
  /*
   * La fonction calculait honnêtement les six heures les plus chargées de
   * l'étudiant — puis les jetait : pour le chronotype « intermédiaire », qui
   * couvre presque tout le monde, les fenêtres étaient écrites en dur. Les
   * matières difficiles étaient servies à 8 h, une heure où rien n'est jamais
   * travaillé, et 17 h — deuxième heure la plus chargée — passait pour légère.
   */

  const historiquePour = (parHeure) => {
    const sortie = [];
    let j = 1;
    for (const [heure, minutes] of Object.entries(parHeure)) {
      const d = new Date();
      d.setDate(d.getDate() - (j++));
      d.setHours(Number(heure), 0, 0, 0);
      sortie.push({ timestamp: d.toISOString(), matiere: 'X', type: 'CM', dureeMinutes: minutes });
    }
    return sortie;
  };

  it('place le travail lourd dans le pic réellement mesuré', () => {
    const m = buildTimeOptimizationMap(
      historiquePour({ 8: 10, 9: 20, 10: 245, 11: 245, 12: 120, 13: 263, 14: 200, 15: 315, 16: 200, 17: 219 }),
      {},
    );
    expect(m.optimalWindows.heavy.start).toBeGreaterThanOrEqual(m.peakStart);
    expect(m.optimalWindows.heavy.start).toBeLessThan(m.peakStart + 6);
  });

  it('suit l’étudiant quand ses heures changent', () => {
    const matin = buildTimeOptimizationMap(historiquePour({ 6: 200, 7: 220, 8: 240, 9: 210, 10: 180, 11: 90 }), {});
    const soir = buildTimeOptimizationMap(historiquePour({ 15: 90, 16: 180, 17: 210, 18: 240, 19: 220, 20: 200 }), {});
    expect(soir.optimalWindows.heavy.start).toBeGreaterThan(matin.optimalWindows.heavy.start);
  });

  it('rend des bornes utilisables par l’ordonnanceur', () => {
    // Il compare `currentHour >= start && < end` : les bornes doivent être
    // croissantes et rester dans la journée.
    const m = buildTimeOptimizationMap(historiquePour({ 18: 200, 19: 220, 20: 240, 21: 210, 22: 180, 23: 90 }), {});
    for (const f of Object.values(m.optimalWindows)) {
      expect(f.start).toBeGreaterThanOrEqual(0);
      expect(f.end).toBeLessThanOrEqual(24);
      expect(f.end).toBeGreaterThan(f.start);
    }
  });
});

describe('Le temps travaillé aujourd’hui', () => {
  /*
   * Le tableau de bord affichait deux chiffres pour la même journée, à quelques
   * centimètres l'un de l'autre : la carte d'accueil sommait les durées
   * enregistrées, la barre de progression lisait un total où le moteur avait
   * glissé des replis par type. Cinq séances dont quatre sans durée : 45 minutes
   * d'un côté, 3 h 05 de l'autre.
   */

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const CURSUS = () => ({ licences: [{ nom: 'L2', semestres: [{ nom: 'S3', dateFin: dans(120), ues: [{ nom: 'UE 1', ects: 6, matieres: [{
    nom: 'Optique', coefficient: 2, evaluations: [], listeTD: [], listeTP: [], listeAnnales: [],
    listeCM: [{ titre: 'Ch1', jActuel: 5, derniereRevision: dans(-20), prochaineRevisionDate: dans(-10), repetitions: 2 }],
  }] }] }] }] });

  it('sépare ce qui est mesuré de ce qui est estimé', () => {
    // Midi de la journée logique : le décalage de nuit déplacerait des séances
    // datées de l'heure courante.
    const [Y, M, D] = getTodayString().split('-').map(Number);
    const midi = new Date(Y, M - 1, D, 12, 0, 0, 0).toISOString();
    const config = { ...CONFIG_MINIMALE, capaciteQuotidienneH: 8, studyStartDate: dans(-30) };

    definirSource({
      lireConfig: () => JSON.parse(JSON.stringify(config)),
      ecrireConfig: () => {},
      lireCours: () => CURSUS(),
      ecrireCours: () => {},
      lireHistorique: () => ([
        { timestamp: midi, matiere: 'Optique', type: 'CM', dureeMinutes: 45 },
        { timestamp: midi, matiere: 'Optique', type: 'CM' },
        { timestamp: midi, matiere: 'Optique', type: 'TD' },
        { timestamp: midi, matiere: 'Optique', type: 'ANKI' },
        { timestamp: midi, matiere: 'Optique', type: 'ANNALE' },
      ]),
      ecrireHistorique: () => {},
      lireProjets: () => [],
      ecrireProjets: () => {},
    });

    const r = genererRapportQuotidien(0, false, null);

    // Ce que l'étudiant lit comme « travaillé » : la mesure seule.
    expect(r.tempsDejaTravailleMin).toBe(45);
    // Et ce qui a été deviné, nommé pour ce qu'il est.
    expect(r.tempsEstimeSansDureeMin).toBeGreaterThan(0);
    expect(r.seancesSansDuree).toBe(4);
  });
});

describe('La découverte garantie', () => {
  /*
   * Une place est réservée chaque jour à une matière jamais abordée, pour que
   * le cursus tourne au lieu de se figer sur ses premières matières. Cette
   * place était réservée, mais pas honorée : le vivier est parcouru par
   * priorité décroissante, tous les chapitres jamais ouverts ont exactement la
   * même priorité, et l'ordre entre eux se décidait donc sur leur rang
   * d'insertion. Le budget partait aux premières matières du cursus, et le
   * chapitre de la matière dont c'était le tour était écarté.
   *
   * Mesuré sur le cursus réel à trois heures par jour, un mois enchaîné :
   * quatre matières touchées sur dix-neuf sans ce passage prioritaire, onze
   * avec.
   */

  const dans = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** Beaucoup de matières, toutes vierges : elles ont toutes la même priorité. */
  const chapitreNeuf = (nom, i) => ({
    titre: `${nom} — chapitre ${i + 1}`, jActuel: 0, derniereRevision: '', easeFactor: 2.5, repetitions: 0,
  });

  function cursusVierge(noms) {
    const matieres = noms.map(nom => ({
      nom, coefficient: 2, evaluations: [],
      listeCM: [chapitreNeuf(nom, 0), chapitreNeuf(nom, 1)],
      listeTD: [], listeTP: [], listeAnnales: [],
    }));
    return { licences: [{ nom: 'L2', semestres: [{ nom: 'S3', dateFin: dans(120), ues: [{ nom: 'UE 1', ects: 30, matieres }] }] }] };
  }

  const NOMS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

  /*
   * Un jour de programme. La capacité laisse la place à exactement un chapitre
   * neuf : cinq heures, dont la moitié au plus réservée aux révisions dues et
   * une place pour la reprise du jour. C'est le cas intéressant — s'il y avait
   * de la place pour tout le monde, la question de savoir qui passe d'abord ne
   * se poserait pas.
   */
  function programmeDuJour(cours) {
    avecDocuments({
      config: {
        ...CONFIG_MINIMALE,
        capaciteQuotidienneH: 5,
        defaultDurationNewCM: 120,
        maxSubjectsPerDay: 3,
        studyStartDate: dans(-30),
      },
      cours,
    });
    return genererRapportQuotidien(0, false, null);
  }

  it('sert une matière jamais abordée, et pas seulement les premières du cursus', () => {
    const cours = cursusVierge(NOMS);
    // Les trois premières matières ont déjà été travaillées et ont une révision
    // en retard : elles dominent le classement, et sans place réservée elles
    // rafleraient la journée.
    for (const nom of ['Alpha', 'Beta', 'Gamma']) {
      const m = cours.licences[0].semestres[0].ues[0].matieres.find(x => x.nom === nom);
      m.listeCM[0].repetitions = 2;
      m.listeCM[0].jActuel = 7;
      m.listeCM[0].derniereRevision = dans(-9);
      m.listeCM[0].prochaineRevisionDate = dans(-2);
    }

    const r = programmeDuJour(cours);
    const servies = new Set((r.tachesDuJour || []).map(t => t.matiere));
    const jamaisAbordees = new Set(NOMS.slice(3));

    expect([...servies].some(m => jamaisAbordees.has(m))).toBe(true);
  });

  it('ne laisse jamais une journée vide quand du travail est dû', () => {
    /*
     * Journée courte et chapitres coûteux : aucun chapitre neuf ne tient dans
     * ce que les révisions dues laissent, et les places de matières partaient
     * toutes à des matières dont le seul candidat était un de ces chapitres.
     * Résultat mesuré : 180 minutes disponibles, onze candidats, et un
     * programme entièrement vide.
     */
    const cours = cursusVierge(NOMS);
    for (const nom of ['Alpha', 'Beta', 'Gamma']) {
      const m = cours.licences[0].semestres[0].ues[0].matieres.find(x => x.nom === nom);
      m.listeCM[0].repetitions = 2;
      m.listeCM[0].jActuel = 7;
      m.listeCM[0].derniereRevision = dans(-9);
      m.listeCM[0].prochaineRevisionDate = dans(-2);
    }

    avecDocuments({
      config: {
        ...CONFIG_MINIMALE,
        capaciteQuotidienneH: 3,
        defaultDurationNewCM: 120,
        maxSubjectsPerDay: 3,
        studyStartDate: dans(-30),
      },
      cours,
    });
    const r = genererRapportQuotidien(0, false, null);

    expect((r.tachesDuJour || []).length).toBeGreaterThan(0);
    // Et ce sont les révisions dues qui sont repêchées, pas du matériau neuf.
    expect((r.tachesDuJour || []).every(t => !t.isNew)).toBe(true);
    // Le temps annoncé correspond à ce qui est proposé.
    const requis = (r.tachesDuJour || []).reduce((a, t) => a + (t.dureeMinutes || 0), 0);
    expect(r.tempsRequisMin).toBe(requis);
  });

  it('ne réserve rien quand toutes les matières ont déjà été abordées', () => {
    const cours = cursusVierge(NOMS);
    for (const m of cours.licences[0].semestres[0].ues[0].matieres) {
      m.listeCM[0].repetitions = 2;
      m.listeCM[0].jActuel = 7;
      m.listeCM[0].derniereRevision = dans(-9);
      m.listeCM[0].prochaineRevisionDate = dans(-2);
    }
    // Rien de neuf à garantir : le programme reste produit, sans panne.
    const r = programmeDuJour(cours);
    expect(r.error).toBeUndefined();
    expect(Array.isArray(r.tachesDuJour)).toBe(true);
  });

  it('ne dépense pas plus que la journée déclarée', () => {
    // Le passage prioritaire change l'ordre, jamais le budget.
    const r = programmeDuJour(cursusVierge(NOMS));
    const requis = (r.tachesDuJour || []).reduce((a, t) => a + (t.dureeMinutes || 0), 0);
    expect(requis).toBeLessThanOrEqual(r.tempsDispoMin);
  });
});
