/**
 * Vitesse de résolution en conditions d'examen.
 *
 * Une part considérable de l'écart entre une bonne note et une très bonne note
 * ne tient pas à ce qu'on sait, mais au temps qu'on met à le restituer. Un
 * étudiant capable de résoudre chaque exercice d'un sujet, mais qui en laisse
 * un tiers en blanc faute de temps, plafonne mécaniquement — et il ne
 * l'apprend qu'après l'épreuve, quand il est trop tard pour y remédier.
 *
 * Cette mesure existe pourtant déjà, dispersée dans deux endroits que rien ne
 * reliait : l'application chronomètre chaque exercice, et le règlement fixe la
 * durée de chaque épreuve. Les rapprocher donne un diagnostic qu'aucun
 * enseignant ne fournit.
 *
 * Deux niveaux de mesure, du plus fiable au plus indicatif :
 *
 *   1. Les annales sont des sujets d'examen complets. Le temps mis pour en
 *      traiter une, rapporté à la durée officielle, dit directement si le
 *      compte y est. C'est la mesure de référence.
 *   2. À défaut d'annales travaillées, les TD servent d'approximation : un
 *      sujet d'examen équivaut à peu près à trois exercices dirigés.
 */

/** Exercices dirigés qu'un sujet d'examen représente, faute d'annale. */
const TD_PAR_SUJET = 3;

/** En deçà de ce ratio, la marge est confortable. */
const SEUIL_CONFORTABLE = 0.8;

/** Au-delà, le sujet ne sera pas terminé. */
const SEUIL_CRITIQUE = 1.0;

/** Nombre de mesures en deçà duquel le diagnostic reste indicatif. */
const MESURES_FIABLES = 2;

/** Durée officielle de l'épreuve la plus longue d'une matière, en minutes. */
function dureeEpreuve(matiere) {
  const durees = (matiere?.evaluations || [])
    .map(e => Number(e?.dureeMinutes))
    .filter(d => Number.isFinite(d) && d > 0);
  return durees.length > 0 ? Math.max(...durees) : null;
}

/** Temps moyen constaté sur une liste d'exercices effectivement travaillés. */
function tempsMoyenTravaille(liste) {
  const temps = (liste || [])
    .filter(ex => (ex?.nombrePratiques || 0) > 0)
    .map(ex => Number(ex?.tempsMoyen))
    .filter(t => Number.isFinite(t) && t > 0);

  if (temps.length === 0) return { moyenne: null, mesures: 0 };
  return {
    moyenne: temps.reduce((a, b) => a + b, 0) / temps.length,
    mesures: temps.length,
  };
}

/**
 * Diagnostic d'une matière.
 *
 * `ratio` vaut le temps qu'il faudrait pour traiter un sujet complet, divisé
 * par le temps réellement accordé. Au-dessus de 1, le sujet ne sera pas fini.
 */
function diagnostiquerMatiere(matiere) {
  const duree = dureeEpreuve(matiere);
  if (!duree) return null;

  const annales = tempsMoyenTravaille(matiere?.listeAnnales);
  const td = tempsMoyenTravaille(matiere?.listeTD);

  let besoin = null;
  let source = null;
  let mesures = 0;

  if (annales.moyenne !== null) {
    // Une annale est un sujet entier : son temps se compare directement.
    besoin = annales.moyenne;
    source = 'annales';
    mesures = annales.mesures;
  } else if (td.moyenne !== null) {
    besoin = td.moyenne * TD_PAR_SUJET;
    source = 'td';
    mesures = td.mesures;
  }

  if (besoin === null) {
    return {
      nom: matiere.nom, duree, ratio: null, source: 'aucune', mesures: 0,
      etat: 'inconnu',
      message: 'Travaille des annales ou des TD chronométrés pour situer ta vitesse.',
    };
  }

  const ratio = besoin / duree;
  const etat = ratio > SEUIL_CRITIQUE ? 'critique'
    : ratio > SEUIL_CONFORTABLE ? 'juste'
      : 'confortable';

  const minutesManquantes = Math.round(besoin - duree);

  return {
    nom: matiere.nom,
    duree,
    besoin: Math.round(besoin),
    ratio: Number(ratio.toFixed(2)),
    source,
    mesures,
    // Un diagnostic tiré d'une seule mesure n'en est pas un : il est rendu,
    // mais signalé comme tel plutôt que présenté comme un constat.
    fiable: mesures >= MESURES_FIABLES,
    etat,
    message: etat === 'critique'
      ? `Il te faudrait environ ${Math.round(besoin)} min pour un sujet complet, contre ${duree} min accordées : ${minutesManquantes} min de trop.`
      : etat === 'juste'
        ? `Tu terminerais tout juste : ${Math.round(besoin)} min pour ${duree} min accordées, sans marge de relecture.`
        : `Tu tiens le rythme : ${Math.round(besoin)} min pour ${duree} min accordées.`,
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
 * Diagnostic de tout le cursus, des matières les plus tendues aux plus sûres.
 * Les matières sans durée d'épreuve — rapports, oraux, projets — en sortent :
 * la notion de vitesse n'y a pas de sens.
 */
function diagnostiquerVitesse(crs) {
  const resultats = [];

  for (const licence of crs?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestreArchive(semestre)) continue;
      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          const diagnostic = diagnostiquerMatiere(matiere);
          if (diagnostic) resultats.push(diagnostic);
        }
      }
    }
  }

  // Le plus tendu d'abord : c'est là qu'il y a quelque chose à faire.
  return resultats.sort((a, b) => {
    if (a.ratio === null) return 1;
    if (b.ratio === null) return -1;
    return b.ratio - a.ratio;
  });
}

/** Synthèse pour le tableau de bord. */
function synthetiserVitesse(crs) {
  const matieres = diagnostiquerVitesse(crs);
  const mesurees = matieres.filter(m => m.ratio !== null);

  return {
    matieres,
    mesurees: mesurees.length,
    critiques: mesurees.filter(m => m.etat === 'critique').length,
    justes: mesurees.filter(m => m.etat === 'juste').length,
    // La matière la plus tendue, s'il y a de quoi conclure.
    laPlusTendue: mesurees.find(m => m.etat !== 'confortable') || null,
  };
}

module.exports = {
  diagnostiquerVitesse,
  diagnostiquerMatiere,
  synthetiserVitesse,
  dureeEpreuve,
  tempsMoyenTravaille,
  TD_PAR_SUJET,
  SEUIL_CONFORTABLE,
  SEUIL_CRITIQUE,
};
