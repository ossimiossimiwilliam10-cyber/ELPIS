const { loadCours } = require('../cours');
const { loadConfig } = require('../config');
const { loadHistorique } = require('../historique');
const { loadProjets } = require('../projets');
const { etatLangues } = require('../langues');
const { getMatiereAverage, isSemesterArchived, matiereDefaillante } = require('../intelligence');
const { getCapitalisedUEs } = require('../scoring');
const { genererRapportQuotidien } = require('../orchestrateur');
const { normalizeDateStr, parseDateLocal } = require('../utils');

/**
 * Ce que le Répétiteur sait, à l'instant où on l'interroge.
 *
 * L'ancien coach envoyait le cursus et l'historique à une API distante — sauf
 * qu'il les lisait dans `data/espoir_cours.json` et `data/espoir_historique.json`,
 * des fichiers disparus lors du passage à SQLite. Il transmettait donc `{}` et
 * `[]` : il ne connaissait que le règlement de la licence, et rien de
 * l'étudiant. Chaque réponse était une conversation générique, facturée à
 * l'appel, sur des données inexistantes.
 *
 * Ce module lit les vraies tables. Il ne produit que des faits vérifiables —
 * aucune formulation, aucune interprétation : c'est le rôle de `reponses.js`.
 * Un chiffre faux ici est un chiffre faux partout, donc rien n'est deviné : ce
 * qui manque vaut `null`, et la réponse le dira.
 */

const JOUR = 86400000;

/** Journée logique d'un horodatage, décalage de nuit compris (4 h). */
function journeeLogique(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 4);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Toutes les matières du cursus actif, avec leur chemin.
 *
 * Les filtres sont ceux de `buildTaskPools`, et ce n'est pas un détail : le
 * Répétiteur ne parcourait ici que `archived`, quand l'ordonnanceur écarte en
 * plus les semestres dont la date de fin est passée, les UE déjà capitalisées
 * et les matières dispensées. Le Répétiteur aurait donc réclamé du travail sur
 * des matières que le planning avait cessé de proposer — un semestre 3 encore
 * cité en février, une UE validée présentée comme du retard. Deux inventaires
 * du même cursus qui ne s'accordent pas valent moins qu'un seul.
 */
function parcourirMatieres(crs) {
  const sortie = [];
  for (const licence of (crs?.licences || [])) {
    if (licence.archived) continue;
    const capitalisees = getCapitalisedUEs(licence);
    for (const semestre of (licence.semestres || [])) {
      if (isSemesterArchived(semestre)) continue;
      for (const ue of (semestre.ues || [])) {
        if (capitalisees.has(ue.nom)) continue;
        for (const matiere of (ue.matieres || [])) {
          if (matiere.dispense) continue;
          sortie.push({ matiere, ue, semestre, licence });
        }
      }
    }
  }
  return sortie;
}

/** Listes de contenu d'une matière, par type. */
const listesDe = (m) => ([
  { type: 'CM', items: m?.listeCM || [] },
  { type: 'TD', items: m?.listeTD || [] },
  { type: 'TP', items: m?.listeTP || [] },
  { type: 'ANNALE', items: m?.listeAnnales || [] },
]);

/** Un cours est « abordé » dès qu'il a été révisé une fois. */
const cmAborde = (cm) => Boolean(cm?.derniereRevision) || Number(cm?.jActuel) > 0;

/** Volume de contenu et part déjà travaillée. */
function mesurerCouverture(crs) {
  let cours = 0, coursAbordes = 0, exercices = 0, exercicesFaits = 0;

  for (const { matiere } of parcourirMatieres(crs)) {
    for (const cm of (matiere.listeCM || [])) {
      cours++;
      if (cmAborde(cm)) coursAbordes++;
    }
    for (const cle of ['listeTD', 'listeTP', 'listeAnnales']) {
      for (const exo of (matiere[cle] || [])) {
        exercices++;
        if (Number(exo?.nombrePratiques) > 0) exercicesFaits++;
      }
    }
  }

  const total = cours + exercices;
  const faits = coursAbordes + exercicesFaits;
  return {
    cours, coursAbordes, exercices, exercicesFaits,
    total, faits,
    part: total > 0 ? Math.round((faits / total) * 100) : null,
  };
}

/** Moyenne d'une matière, ou `null` si aucune note n'est saisie. */
function moyenneDe(matiere) {
  const r = getMatiereAverage(matiere);
  return r && Number.isFinite(r.avg) ? Math.round(r.avg * 100) / 100 : null;
}

/** Moyennes par matière, par UE et générale, pondérées comme le règlement l'exige. */
function mesurerNotes(crs) {
  const matieres = [];
  const ues = new Map();

  for (const { matiere, ue } of parcourirMatieres(crs)) {
    const moyenne = moyenneDe(matiere);
    if (moyenne === null) continue;

    const coef = matiere.coefficient !== undefined ? Number(matiere.coefficient) : 1;
    // La défaillance voyage avec la moyenne : le bulletin affiche DEF là où ce
    // chiffre existe, et le Répétiteur ne doit pas annoncer l'un en taisant l'autre.
    matieres.push({ nom: matiere.nom, moyenne, coefficient: coef, ue: ue.nom, defaillante: matiereDefaillante(matiere) });

    if (!Number.isFinite(coef) || coef <= 0) continue;
    const cumul = ues.get(ue.nom) || { nom: ue.nom, ects: Number(ue.ects) || 0, somme: 0, poids: 0 };
    cumul.somme += moyenne * coef;
    cumul.poids += coef;
    ues.set(ue.nom, cumul);
  }

  const parUE = [...ues.values()]
    .filter(u => u.poids > 0)
    .map(u => ({ nom: u.nom, ects: u.ects, moyenne: Math.round((u.somme / u.poids) * 100) / 100 }));

  const poidsTotal = parUE.reduce((a, u) => a + u.ects, 0);
  const generale = poidsTotal > 0
    ? Math.round((parUE.reduce((a, u) => a + u.moyenne * u.ects, 0) / poidsTotal) * 100) / 100
    : null;

  return {
    matieres: matieres.sort((a, b) => b.moyenne - a.moyenne),
    parUE,
    generale,
    nbNotees: matieres.length,
  };
}

/** Temps travaillé et régularité sur une fenêtre de journées logiques. */
function mesurerTravail(historique, jours, maintenant = Date.now()) {
  const fenetre = new Set();
  for (let i = 0; i < Math.max(1, jours); i++) fenetre.add(journeeLogique(maintenant - i * JOUR));

  let minutes = 0;
  let sansDuree = 0;
  const joursActifs = new Set();
  const parMatiere = new Map();

  for (const h of (historique || [])) {
    const t = new Date(h?.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const jour = journeeLogique(t);
    if (!fenetre.has(jour)) continue;

    // Une séance sans durée enregistrée ne vaut pas trente minutes. La table
    // conserve délibérément le zéro ; le remplacer ici gonflerait un total que
    // l'étudiant lit comme une mesure. On la compte comme séance, pas comme
    // temps, et `sansDuree` permet de le dire.
    const duree = Number(h.dureeMinutes);
    const m = Number.isFinite(duree) && duree > 0 ? duree : 0;
    if (m === 0) sansDuree++;
    minutes += m;
    joursActifs.add(jour);
    if (h.matiere && m > 0) parMatiere.set(h.matiere, (parMatiere.get(h.matiere) || 0) + m);
  }

  const classement = [...parMatiere.entries()]
    .map(([nom, min]) => ({ nom, minutes: min }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    fenetreJours: Math.max(1, jours),
    minutes,
    sansDuree,
    heures: Math.round((minutes / 60) * 10) / 10,
    joursActifs: joursActifs.size,
    parMatiere: classement,
    seances: (historique || []).filter(h => fenetre.has(journeeLogique(new Date(h?.timestamp).getTime()))).length,
  };
}

/**
 * Retards de révision, mesurés directement sur le cursus.
 *
 * Le rapport du jour porte déjà ces chiffres — mais il s'interrompt avant de
 * les calculer les jours de repos. S'y fier aurait fait répondre « rien n'a
 * décroché » un dimanche où trois chapitres traînent depuis un mois : la seule
 * forme de mensonge que ce Répétiteur doit rendre impossible.
 *
 * Le calcul reprend celui de l'orchestrateur, pour que les deux ne puissent pas
 * diverger : la date de prochaine révision fait foi quand elle existe, sinon
 * l'écart depuis la dernière révision moins l'intervalle prévu. Est « en
 * souffrance » un chapitre dont le retard dépasse son propre intervalle — deux
 * jours de retard sur un cycle de sept ne sont pas un décrochage, deux jours sur
 * un cycle d'un jour en sont un.
 */
function mesurerRetards(crs, config, maintenant = Date.now()) {
  const aujourdHui = parseDateLocal(journeeLogique(maintenant));
  const dureeRevision = Number(config?.defaultDurationRevCM) || 30;
  const dues = [];

  for (const { matiere } of parcourirMatieres(crs)) {
    for (const cm of (matiere.listeCM || [])) {
      if (!cm.derniereRevision) continue; // Jamais abordé : à découvrir, pas en retard.

      const intervalle = Number(cm.jActuel) || 0;
      let retard = null;

      const cible = parseDateLocal(normalizeDateStr(cm.prochaineRevisionDate));
      if (cible && !Number.isNaN(cible.getTime())) {
        const ecart = Math.floor((aujourdHui - cible) / JOUR);
        if (ecart >= 0) retard = ecart;
      } else {
        const revision = parseDateLocal(normalizeDateStr(cm.derniereRevision));
        if (!revision || Number.isNaN(revision.getTime())) continue;
        const ecoules = Math.floor((aujourdHui - revision) / JOUR);
        if (intervalle > 0 && ecoules >= intervalle) retard = ecoules - intervalle;
        else if (intervalle === 0 && ecoules > 0) retard = ecoules;
      }

      if (retard === null) continue;

      const duree = Number(cm.tempsMoyen) > 0 ? Number(cm.tempsMoyen) : dureeRevision;
      dues.push({
        titre: cm.titre, matiere: matiere.nom,
        joursEnRetard: retard, intervalle, dureeMinutes: Math.round(duree),
        enSouffrance: intervalle > 0 && retard > intervalle,
      });
    }
  }

  const enSouffrance = dues
    .filter(d => d.enSouffrance)
    .sort((a, b) => b.joursEnRetard - a.joursEnRetard);

  return {
    dues: dues.length,
    minutesDues: dues.reduce((a, d) => a + d.dureeMinutes, 0),
    enSouffrance,
    minutesEnSouffrance: enSouffrance.reduce((a, d) => a + d.dureeMinutes, 0),
    retardMax: enSouffrance.reduce((m, d) => Math.max(m, d.joursEnRetard), 0),
  };
}

/**
 * Épreuves déclarées, datées ou non.
 *
 * La date d'une épreuve vit dans `evaluations[].date` — c'est là que la page
 * Bulletin l'écrit, et c'est de là que `buildExamUrgencyMap` tire l'urgence qui
 * pèse pour trente points sur cent dans le classement des révisions. Le Répétiteur,
 * lui, ne lisait que `matiere.examDates`, alimenté par une colonne héritée : il
 * répondait « aucune date n'est renseignée » aujourd'hui, et aurait continué de
 * le répondre après la saisie, pendant que le planificateur, lui, en tenait
 * compte. Deux sources pour une même question, dont une muette.
 *
 * On lit donc la même source que le moteur, `examDates` ne servant plus que de
 * repli pour les saisies anciennes.
 */
function epreuvesDeclarees(crs, maintenant = Date.now()) {
  const aujourdHui = parseDateLocal(journeeLogique(maintenant));
  const sortie = [];

  for (const { matiere, ue, semestre } of parcourirMatieres(crs)) {
    for (const ev of (Array.isArray(matiere.evaluations) ? matiere.evaluations : [])) {
      const d = parseDateLocal(normalizeDateStr(ev.date));
      const datee = Boolean(d) && !Number.isNaN(d.getTime());
      sortie.push({
        matiere: matiere.nom,
        ue: ue.nom,
        semestre: semestre.nom,
        nom: ev.nom || 'Épreuve',
        type: ev.type || null,
        coefficient: Number(ev.coefficient) || 0,
        dureeMinutes: Number(ev.dureeMinutes) || null,
        note: Number.isFinite(Number(ev.note)) && ev.note !== null ? Number(ev.note) : null,
        statut: ev.statut || null,
        date: datee ? normalizeDateStr(ev.date) : null,
        joursRestants: datee ? Math.round((d - aujourdHui) / JOUR) : null,
      });
    }

    // Repli : anciennes saisies portant la date au niveau de la matière.
    for (const brute of (Array.isArray(matiere.examDates) ? matiere.examDates : [])) {
      const d = parseDateLocal(normalizeDateStr(brute));
      if (!d || Number.isNaN(d.getTime())) continue;
      sortie.push({
        matiere: matiere.nom, ue: ue.nom, semestre: semestre.nom,
        nom: 'Examen', type: null, coefficient: 0, dureeMinutes: null,
        note: null, statut: null,
        date: normalizeDateStr(brute),
        joursRestants: Math.round((d - aujourdHui) / JOUR),
      });
    }
  }

  return sortie;
}

/** Prochaines échéances datées, les plus proches d'abord. */
function prochainsExamens(crs, maintenant = Date.now()) {
  return epreuvesDeclarees(crs, maintenant)
    .filter(e => e.joursRestants !== null && e.joursRestants >= 0)
    .sort((a, b) => a.joursRestants - b.joursRestants);
}

/** État de chaque langue déclarée. */
/**
 * État de chaque langue déclarée, et surtout : peut-elle être planifiée ?
 *
 * Une langue déclarée n'est pas une langue planifiable. Il faut, pour chaque
 * volet, de quoi travailler — un paquet Anki ou un lien pour le vocabulaire, un
 * livre ou un lien pour la grammaire, un lien pour la conversation. Sans cela le
 * planificateur passe son chemin, sans rien dire, et l'étudiant croit ses langues
 * suivies alors qu'aucune séance ne sera jamais proposée. C'est le genre de
 * silence que ce module existe pour rompre.
 */
function mesurerLangues(config, maintenant = Date.now()) {
  let etats = [];
  try {
    etats = etatLangues(config, journeeLogique(maintenant), loadHistorique());
  } catch {
    etats = [];
  }

  return (config?.langues || []).map(l => {
    const pratiques = l.dernieresPratiques || {};
    const derniere = Object.values(pratiques)
      .map(d => parseDateLocal(normalizeDateStr(d)))
      .filter(d => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => b - a)[0];

    const etat = etats.find(e => e.id === l.id || e.nom === l.nom) || null;
    const volets = Array.isArray(etat?.volets) ? etat.volets : [];

    return {
      nom: l.nom,
      heuresAcquises: Number(l.heuresAcquises) || 0,
      cadence: Number(l.cadence) || 0,
      derniereSeanceJours: derniere
        ? Math.round((parseLocalMidi(maintenant) - derniere) / JOUR)
        : null,
      planifiable: Boolean(etat?.configuree),
      voletsExploitables: volets.filter(v => v.exploitable).map(v => v.libelle || v.cle),
      voletsManquants: volets.filter(v => !v.exploitable).map(v => v.libelle || v.cle),
      voletDu: volets.find(v => v.du && v.exploitable)?.libelle || null,
    };
  });
}

const parseLocalMidi = (t) => parseDateLocal(journeeLogique(t));

/** Délai réglementaire pour déposer un justificatif, en jours. */
const DELAI_JUSTIFICATIF_JOURS = 7;

/**
 * État d'une absence, quelle que soit la forme sous laquelle elle a été saisie.
 *
 * Deux formes coexistent en base : `justifiee` (un booléen, forme des saisies
 * anciennes) et `statut` (une chaîne, forme de la page actuelle). Le Répétiteur ne
 * lisait que la seconde — il rangeait donc les deux absences réelles de
 * l'étudiant dans « statut non renseigné », en concluait qu'aucune n'était
 * injustifiée, et servait la phrase rassurante « tant qu'un justificatif est
 * déposé dans les délais… » alors que celle du 25 août ne l'est pas et que son
 * délai est écoulé. C'est exactement le mensonge que ce Répétiteur doit rendre
 * impossible.
 */
function etatAbsence(a) {
  const statut = String(a && a.statut ? a.statut : '').trim();
  if (statut === 'Justifié') return 'justifiee';
  if (statut === 'Dispensé') return 'dispensee';
  if (statut === 'En Attente') return 'en_attente';
  if (statut === 'Non Justifié') return 'non_justifiee';
  if (a && a.justifiee === true) return 'justifiee';
  if (a && a.justifiee === false) return 'non_justifiee';
  return 'inconnu';
}

/** Jours restants pour justifier (négatif si le délai est écoulé), ou null. */
function joursPourJustifier(dateStr, maintenant = Date.now()) {
  const d = parseDateLocal(normalizeDateStr(dateStr));
  if (!d || Number.isNaN(d.getTime())) return null;
  const aujourdHui = parseDateLocal(journeeLogique(maintenant));
  return DELAI_JUSTIFICATIF_JOURS - Math.round((aujourdHui - d) / JOUR);
}

/** Libellés accordés, du singulier au pluriel. */
const LIBELLE_ABSENCE = {
  justifiee: ['justifiée', 'justifiées'],
  dispensee: ['dispensée', 'dispensées'],
  en_attente: ['en attente de justificatif', 'en attente de justificatif'],
  non_justifiee: ['non justifiée', 'non justifiées'],
  inconnu: ['sans état renseigné', 'sans état renseigné'],
};

/** Absences déclarées, avec leur état réel et le délai qui court. */
function mesurerAbsences(config, maintenant = Date.now()) {
  const liste = (config && config.absences ? config.absences : []).map(a => {
    const etat = etatAbsence(a);
    const restants = joursPourJustifier(a.date, maintenant);
    const attendUnJustificatif = etat === 'non_justifiee' || etat === 'en_attente' || etat === 'inconnu';
    return {
      ...a,
      etat,
      joursPourJustifier: restants,
      aJustifier: attendUnJustificatif,
      horsDelai: attendUnJustificatif && restants !== null && restants < 0,
    };
  });

  const parEtat = {};
  for (const a of liste) parEtat[a.etat] = (parEtat[a.etat] || 0) + 1;

  return {
    total: liste.length,
    parEtat,
    liste,
    nonJustifiees: liste.filter(a => a.etat === 'non_justifiee').length,
    horsDelai: liste.filter(a => a.horsDelai),
    aJustifierBientot: liste
      .filter(a => a.aJustifier && !a.horsDelai && a.joursPourJustifier !== null)
      .sort((a, b) => a.joursPourJustifier - b.joursPourJustifier),
    delaiJours: DELAI_JUSTIFICATIF_JOURS,
  };
}

/* ------------------------------------------------- Ce que le cursus contient */

/** Structure déclarée : licences, semestres, UE, matières, volumes horaires. */
function structureCursus(crs) {
  const licences = [];
  let nbUE = 0, nbMatieres = 0;
  let cmH = 0, tdH = 0, tpH = 0, ectsTotal = 0;

  for (const licence of (crs?.licences || [])) {
    if (licence.archived) continue;
    const semestres = [];

    for (const semestre of (licence.semestres || [])) {
      if (semestre.archived) continue;
      const ues = (semestre.ues || []).map(ue => {
        const matieres = ue.matieres || [];
        nbUE++;
        nbMatieres += matieres.length;
        ectsTotal += Number(ue.ects) || 0;
        for (const m of matieres) {
          cmH += Number(m.cm_h) || 0;
          tdH += Number(m.td_h) || 0;
          tpH += Number(m.tp_h) || 0;
        }
        return {
          nom: ue.nom,
          ects: Number(ue.ects) || null,
          matieres: matieres.map(m => ({
            nom: m.nom,
            coefficient: m.coefficient !== undefined && m.coefficient !== null ? Number(m.coefficient) : null,
            cm_h: Number(m.cm_h) || 0,
            td_h: Number(m.td_h) || 0,
            tp_h: Number(m.tp_h) || 0,
          })),
        };
      });

      semestres.push({
        nom: semestre.nom,
        dateFin: semestre.dateFin ? normalizeDateStr(semestre.dateFin) : null,
        ues,
        ects: ues.reduce((a, u) => a + (u.ects || 0), 0),
      });
    }

    licences.push({ nom: licence.nom, semestres });
  }

  return { licences, nbUE, nbMatieres, ectsTotal, heures: { cm: cmH, td: tdH, tp: tpH } };
}

/**
 * Ce qui manque à la saisie, matière par matière.
 *
 * C'est la seule question à laquelle un cursus vide répond utilement : plutôt
 * que d'annoncer des zéros, elle nomme ce qu'il faut entrer pour que le reste
 * se mette à fonctionner. L'ordre suit les dépendances réelles du moteur — les
 * chapitres débloquent la couverture, les dates débloquent l'urgence d'examen,
 * les paquets débloquent la routine Anki.
 */
function mesurerSaisie(crs, config, maintenant = Date.now()) {
  const matieres = parcourirMatieres(crs);
  const sansChapitre = [];
  const sansExercice = [];
  const sansAnnale = [];
  const sansDeck = [];
  const sansCoefficient = [];
  let chapitres = 0, chapitresSansDocument = 0;

  for (const { matiere } of matieres) {
    const cm = matiere.listeCM || [];
    chapitres += cm.length;
    for (const c of cm) {
      if (!c.pdfPath && !c.fichePdfPath && !(c.pdfPaths || []).length) chapitresSansDocument++;
    }
    if (cm.length === 0) sansChapitre.push(matiere.nom);
    if ((matiere.listeTD || []).length === 0 && (matiere.listeTP || []).length === 0) sansExercice.push(matiere.nom);
    if ((matiere.listeAnnales || []).length === 0) sansAnnale.push(matiere.nom);
    if (!matiere.ankiDeckName) sansDeck.push(matiere.nom);
    const coef = matiere.coefficient;
    if (coef === undefined || coef === null || !Number.isFinite(Number(coef))) sansCoefficient.push(matiere.nom);
  }

  const epreuves = epreuvesDeclarees(crs, maintenant);

  return {
    nbMatieres: matieres.length,
    chapitres,
    chapitresSansDocument,
    sansChapitre,
    sansExercice,
    sansAnnale,
    sansDeck,
    sansCoefficient,
    epreuves: epreuves.length,
    epreuvesDatees: epreuves.filter(e => e.date).length,
    notesSaisies: epreuves.filter(e => e.note !== null).length,
    languesDeclarees: (config?.langues || []).length,
  };
}

/* ------------------------------------------------------- Le rythme constaté */

/** Journées logiques distinctes où une séance a été enregistrée, triées. */
function journeesTravaillees(historique) {
  const jours = new Set();
  for (const h of (historique || [])) {
    const t = new Date(h?.timestamp).getTime();
    if (Number.isFinite(t)) jours.add(journeeLogique(t));
  }
  return [...jours].sort();
}

/**
 * Séries de jours travaillés consécutifs.
 *
 * « Série en cours » se compte à rebours depuis aujourd'hui : elle vaut zéro
 * dès que la journée d'hier est vide, même si l'avant-veille était pleine. Le
 * dire évite que l'étudiant recompte et trouve autre chose.
 */
function mesurerSeries(historique, maintenant = Date.now()) {
  const jours = journeesTravaillees(historique);
  if (jours.length === 0) return { record: 0, enCours: 0, joursTravailles: 0, debutRecord: null, finRecord: null };

  const enJour = (str) => {
    const [a, m, j] = str.split('-').map(Number);
    return new Date(a, m - 1, j, 12, 0, 0).getTime();
  };

  let record = 1, courante = 1, debutRecord = jours[0], finRecord = jours[0], debutCourante = jours[0];
  for (let i = 1; i < jours.length; i++) {
    const consecutif = Math.round((enJour(jours[i]) - enJour(jours[i - 1])) / JOUR) === 1;
    courante = consecutif ? courante + 1 : 1;
    if (!consecutif) debutCourante = jours[i];
    if (courante > record) { record = courante; debutRecord = debutCourante; finRecord = jours[i]; }
  }

  // Série en cours : à rebours depuis aujourd'hui (ou hier, si rien n'est
  // encore enregistré aujourd'hui — la journée n'est pas finie).
  const presents = new Set(jours);
  let enCours = 0;
  let curseur = parseDateLocal(journeeLogique(maintenant));
  if (!presents.has(journeeLogique(maintenant))) curseur = new Date(curseur.getTime() - JOUR);
  while (presents.has(`${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, '0')}-${String(curseur.getDate()).padStart(2, '0')}`)) {
    enCours++;
    curseur = new Date(curseur.getTime() - JOUR);
  }

  return { record, enCours, joursTravailles: jours.length, debutRecord, finRecord };
}

/** Dernière séance enregistrée, et son ancienneté en journées logiques. */
function derniereSeance(historique, maintenant = Date.now()) {
  let meilleure = null;
  for (const h of (historique || [])) {
    const t = new Date(h?.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    if (!meilleure || t > meilleure.t) meilleure = { t, entree: h };
  }
  if (!meilleure) return null;

  const jour = journeeLogique(meilleure.t);
  const ecart = Math.round((parseDateLocal(journeeLogique(maintenant)) - parseDateLocal(jour)) / JOUR);
  return {
    jour,
    ilYAJours: ecart,
    titre: meilleure.entree.titre || null,
    matiere: meilleure.entree.matiere || null,
    type: meilleure.entree.type || null,
    dureeMinutes: Number(meilleure.entree.dureeMinutes) || 0,
  };
}

/** Séances d'une journée logique donnée. */
function seancesDuJour(historique, jour) {
  return (historique || []).filter(h => {
    const t = new Date(h?.timestamp).getTime();
    return Number.isFinite(t) && journeeLogique(t) === jour;
  });
}

/**
 * Temps encore disponible aujourd'hui.
 *
 * Le rapport porte bien un `tempsDispoMin`, mais il est figé avant que le temps
 * déjà travaillé n'en soit retranché, et il vaut zéro les jours de repos — où
 * l'orchestrateur s'interrompt avant de le calculer. Le lire donnerait « 0 min
 * disponible » un dimanche, ce qui se comprendrait comme « tu n'as plus de
 * temps » alors que cela signifie « aucun programme n'a été produit ».
 * On repart donc de la capacité déclarée.
 */
function tempsLibreDuJour(config, historique, maintenant = Date.now()) {
  const heures = Number(config?.maxStudyHoursPerDay);
  const capaciteMin = Number.isFinite(heures) && heures > 0 ? Math.round(heures * 60) : null;
  const faites = seancesDuJour(historique, journeeLogique(maintenant));
  const travailleMin = faites.reduce((a, h) => {
    const d = Number(h.dureeMinutes);
    return a + (Number.isFinite(d) && d > 0 ? d : 0);
  }, 0);

  return {
    capaciteMin,
    travailleMin,
    resteMin: capaciteMin === null ? null : Math.max(0, capaciteMin - travailleMin),
    seances: faites.length,
    source: 'maxStudyHoursPerDay',
  };
}

/** Jours (calendaires) jusqu'à la date de reprise déclarée, ou null. */
function joursAvantRentree(config, maintenant = Date.now()) {
  const d = parseDateLocal(normalizeDateStr(config?.studyStartDate));
  if (!d || Number.isNaN(d.getTime())) return null;
  const aujourdHui = parseDateLocal(journeeLogique(maintenant));
  return {
    date: normalizeDateStr(config.studyStartDate),
    jours: Math.round((d - aujourdHui) / JOUR),
  };
}

/** Engagements d'emploi du temps déclarés, groupés par jour. */
function emploiDuTempsFixe(config) {
  const liste = (config?.fixedCommitments || []).map(c => ({
    jour: c.day || null,
    debut: c.start || null,
    fin: c.end || null,
    matiere: c.matiereLinked || null,
    minutes: minutesEntre(c.start, c.end),
  }));
  return {
    liste,
    minutesParSemaine: liste.reduce((a, c) => a + (c.minutes || 0), 0),
  };
}

/** Durée en minutes entre deux heures « HH:MM », ou null. */
function minutesEntre(debut, fin) {
  const lire = (h) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = lire(debut), b = lire(fin);
  return a === null || b === null || b <= a ? null : b - a;
}

/**
 * Le tableau complet, tel que le Répétiteur le consulte pour répondre.
 *
 * Le rapport du jour est demandé à l'orchestrateur : c'est la même source que
 * l'écran d'accueil, donc le Répétiteur ne peut pas dire autre chose que ce que
 * l'étudiant voit.
 */
function rassembler(maintenant = Date.now()) {
  const crs = loadCours();
  const config = loadConfig();
  const historique = loadHistorique();
  const projets = loadProjets();

  let rapport = null;
  try {
    rapport = genererRapportQuotidien(0, false);
  } catch (e) {
    rapport = null;
  }

  const matieres = parcourirMatieres(crs).map(({ matiere, ue, semestre }) => ({
    nom: matiere.nom,
    ue: ue.nom,
    semestre: semestre.nom,
    coefficient: matiere.coefficient !== undefined ? Number(matiere.coefficient) : 1,
    moyenne: moyenneDe(matiere),
    cours: (matiere.listeCM || []).length,
    coursAbordes: (matiere.listeCM || []).filter(cmAborde).length,
    exercices: listesDe(matiere).filter(l => l.type !== 'CM').reduce((a, l) => a + l.items.length, 0),
  }));

  return {
    maintenant,
    aujourdHui: journeeLogique(maintenant),
    config,
    cursusVide: matieres.length === 0,
    contenuVide: mesurerCouverture(crs).total === 0,
    matieres,
    couverture: mesurerCouverture(crs),
    notes: mesurerNotes(crs),
    semaine: mesurerTravail(historique, 7, maintenant),
    mois: mesurerTravail(historique, 30, maintenant),
    retards: mesurerRetards(crs, config, maintenant),
    examens: prochainsExamens(crs, maintenant),
    langues: mesurerLangues(config, maintenant),
    absences: mesurerAbsences(config, maintenant),
    epreuves: epreuvesDeclarees(crs, maintenant),
    structure: structureCursus(crs),
    saisie: mesurerSaisie(crs, config, maintenant),
    series: mesurerSeries(historique, maintenant),
    derniereSeance: derniereSeance(historique, maintenant),
    tempsLibre: tempsLibreDuJour(config, historique, maintenant),
    rentree: joursAvantRentree(config, maintenant),
    emploiDuTemps: emploiDuTempsFixe(config),
    volumes: { historique: (historique || []).length },
    projets,
    rapport,
  };
}

module.exports = {
  rassembler,
  parcourirMatieres,
  mesurerCouverture,
  mesurerNotes,
  mesurerTravail,
  prochainsExamens,
  mesurerRetards,
  mesurerLangues,
  mesurerAbsences,
  epreuvesDeclarees,
  structureCursus,
  mesurerSaisie,
  mesurerSeries,
  derniereSeance,
  seancesDuJour,
  tempsLibreDuJour,
  joursAvantRentree,
  emploiDuTempsFixe,
  journeesTravaillees,
  etatAbsence,
  joursPourJustifier,
  LIBELLE_ABSENCE,
  DELAI_JUSTIFICATIF_JOURS,
  journeeLogique,
};
