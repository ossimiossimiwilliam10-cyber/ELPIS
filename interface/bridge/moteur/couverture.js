/**
 * Couverture du programme avant échéance.
 *
 * Une matière peut être parfaitement travaillée et rester perdue d'avance : si
 * le rythme de découverte ne permet pas d'atteindre le dernier chapitre avant
 * l'examen, aucune qualité de révision n'y changera rien. C'est pourtant une
 * chose qu'on découvre habituellement en décembre, quand il ne reste plus de
 * marge de manœuvre.
 *
 * Tout ce qu'il faut pour le dire dès octobre existe déjà, dispersé : le
 * nombre de chapitres non abordés, la date de l'épreuve, le temps qu'un
 * nouveau cours réclame, et la part du budget quotidien allouée à la
 * découverte. Ce module les rapproche.
 *
 * Le verdict porte sur ce qui est *couvrable*, pas sur ce qui sera *retenu* :
 * c'est une condition nécessaire, jamais suffisante.
 */

const { normalizeDateStr, parseDateLocal } = require('./utils');
const { budgetQuotidien } = require('./objectifs');

const JOUR = 86400000;

/** Au-delà de cette part du temps disponible, la marge devient illusoire. */
const SEUIL_TENDU = 0.85;

/** Cours considérés comme abordés dès lors qu'ils ont été révisés une fois. */
function coursRestants(matiere) {
  const liste = matiere?.listeCM || [];
  const abordes = liste.filter(cm => cm?.derniereRevision).length;
  return { total: liste.length, abordes, restants: liste.length - abordes };
}

/**
 * Échéance d'une matière : la première épreuve non encore notée, à défaut la
 * fin du semestre. C'est la même règle que celle de l'urgence d'examen, pour
 * que les deux ne racontent pas deux histoires différentes.
 */
function echeanceDe(matiere, semestre, maintenant) {
  const aujourdHui = new Date(maintenant);
  aujourdHui.setHours(0, 0, 0, 0);

  let plusProche = null;
  for (const ev of matiere?.evaluations || []) {
    if (!ev?.date) continue;
    // Une épreuve déjà notée ou close n'est plus une échéance.
    if (ev.note !== undefined && ev.note !== null && ev.note !== '' && !isNaN(parseFloat(ev.note))) continue;
    if (ev.statut === 'defaillant' || ev.statut === 'excuse') continue;

    const d = parseDateLocal(normalizeDateStr(ev.date));
    if (Number.isNaN(d?.getTime()) || d < aujourdHui) continue;
    if (!plusProche || d < plusProche) plusProche = d;
  }

  if (plusProche) return { date: plusProche, source: 'epreuve' };

  if (semestre?.dateFin) {
    const fin = parseDateLocal(normalizeDateStr(semestre.dateFin));
    if (!Number.isNaN(fin?.getTime()) && fin >= aujourdHui) return { date: fin, source: 'semestre' };
  }

  return { date: null, source: 'aucune' };
}

/**
 * Projection pour une matière.
 *
 * `tenable` répond à une question précise : en consacrant chaque jour la part
 * de temps prévue par le régime de travail, reste-t-il assez de jours pour
 * aborder les chapitres qui n'ont jamais été ouverts ?
 */
function projeterCouvertureMatiere(matiere, semestre, budgetDecouverteMin, dureeNouveauCM, maintenant) {
  const cours = coursRestants(matiere);
  const { date, source } = echeanceDe(matiere, semestre, maintenant);

  if (cours.total === 0 || !date) {
    return {
      nom: matiere.nom, ...cours, echeance: null, sourceEcheance: source,
      joursRestants: null, joursNecessaires: null, tension: null,
      etat: 'inconnu',
      message: cours.total === 0
        ? 'Aucun cours enregistré : rien à projeter.'
        : "Aucune échéance connue : renseigne une date d'épreuve ou de fin de semestre.",
    };
  }

  const aujourdHui = new Date(maintenant);
  aujourdHui.setHours(0, 0, 0, 0);
  const joursRestants = Math.max(0, Math.round((date - aujourdHui) / JOUR));

  if (cours.restants === 0) {
    return {
      nom: matiere.nom, ...cours, echeance: date.toISOString().split('T')[0],
      sourceEcheance: source, joursRestants, joursNecessaires: 0, tension: 0,
      etat: 'couvert',
      message: `Programme entièrement abordé, ${joursRestants} jours avant l'échéance.`,
    };
  }

  // Le budget de découverte est réparti entre toutes les matières actives :
  // une matière n'en reçoit qu'une fraction. La projection se fait donc à
  // budget dédié, et le message le rappelle.
  const minutesNecessaires = cours.restants * dureeNouveauCM;
  const joursNecessaires = budgetDecouverteMin > 0
    ? Math.ceil(minutesNecessaires / budgetDecouverteMin)
    : null;

  if (joursNecessaires === null) {
    return {
      nom: matiere.nom, ...cours, echeance: date.toISOString().split('T')[0],
      sourceEcheance: source, joursRestants, joursNecessaires: null, tension: null,
      etat: 'inconnu',
      message: 'Aucun temps alloué aux nouveaux cours : ajuste ta capacité.',
    };
  }

  const tension = joursRestants > 0 ? joursNecessaires / joursRestants : Infinity;
  const etat = tension > 1 ? 'hors-delai' : tension > SEUIL_TENDU ? 'tendu' : 'tenable';

  return {
    nom: matiere.nom,
    ...cours,
    echeance: date.toISOString().split('T')[0],
    sourceEcheance: source,
    joursRestants,
    joursNecessaires,
    tension: Number.isFinite(tension) ? Number(tension.toFixed(2)) : null,
    etat,
    message: etat === 'hors-delai'
      ? `${cours.restants} chapitres jamais ouverts. Il en faudrait ${joursNecessaires} jours de découverte, tu en as ${joursRestants}.`
      : etat === 'tendu'
        ? `${cours.restants} chapitres restants pour ${joursRestants} jours : c'est jouable, sans un jour de perdu.`
        : `${cours.restants} chapitres restants, largement dans les temps.`,
  };
}

/** Vrai si le semestre est archivé, quelle que soit la forme du marqueur. */
function semestreArchive(s) {
  if (!s) return true;
  if (s.archived === true) return true;
  if (typeof s.archived === 'string') return s.archived.toLowerCase() === 'true';
  return false;
}

/**
 * Projection de tout le cursus, des matières les plus menacées aux plus sûres.
 *
 * Le temps de découverte quotidien est partagé entre les matières qui ont
 * encore des chapitres à ouvrir : projeter chacune sur la totalité du budget
 * donnerait une vision trop optimiste, puisqu'elles se le disputent.
 */
function projeterCouverture(crs, cfg = {}, maintenant = Date.now()) {
  const budget = budgetQuotidien(cfg);
  const dureeNouveauCM = Number(cfg.defaultDurationNewCM) > 0 ? Number(cfg.defaultDurationNewCM) : 120;

  const enCours = [];
  for (const licence of crs?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestreArchive(semestre)) continue;
      for (const matiere of semestre.ues?.flatMap(u => u.matieres || []) || []) {
        if (matiere?.nom) enCours.push({ matiere, semestre });
      }
    }
  }

  const aDecouvrir = enCours.filter(({ matiere }) => coursRestants(matiere).restants > 0).length;
  const budgetParMatiere = aDecouvrir > 0 ? budget.decouverte / aDecouvrir : budget.decouverte;

  const projections = enCours.map(({ matiere, semestre }) =>
    projeterCouvertureMatiere(matiere, semestre, budgetParMatiere, dureeNouveauCM, maintenant));

  // Le plus menacé d'abord : c'est là qu'une décision s'impose.
  return projections.sort((a, b) => {
    if (a.tension === null) return 1;
    if (b.tension === null) return -1;
    return b.tension - a.tension;
  });
}

/** Synthèse destinée au tableau de bord. */
function synthetiserCouverture(crs, cfg = {}, maintenant = Date.now()) {
  const matieres = projeterCouverture(crs, cfg, maintenant);
  const projetees = matieres.filter(m => m.tension !== null);

  return {
    matieres,
    projetees: projetees.length,
    horsDelai: projetees.filter(m => m.etat === 'hors-delai').length,
    tendues: projetees.filter(m => m.etat === 'tendu').length,
    laPlusMenacee: projetees.find(m => m.etat === 'hors-delai' || m.etat === 'tendu') || null,
    budgetDecouverteMin: budgetQuotidien(cfg).decouverte,
  };
}

module.exports = {
  projeterCouverture,
  projeterCouvertureMatiere,
  synthetiserCouverture,
  coursRestants,
  echeanceDe,
  SEUIL_TENDU,
};
