// priorite.js
// ---------------------------------------------------------------------------
// Calcul de la priorité d'un exercice, sur une échelle bornée et explicable.
//
// L'ancien calcul multipliait une douzaine de facteurs les uns par les autres
// (`1/√(n+1) × difficulté × examen × note × dette(×10) × synergie(×5) × …`).
// Trois défauts en découlaient :
//
//   1. Amplitude incontrôlée. Deux exercices identiques pouvaient différer d'un
//      facteur 60 par le seul contexte de leur matière, et de bien plus en
//      cumulant examen proche et synergie : une matière raflait alors toute la
//      journée, et le planning perdait sa variété.
//
//   2. Aucune explication possible. Un produit ne se décompose pas : impossible
//      de dire à l'étudiant pourquoi telle révision passe avant telle autre.
//
//   3. Réglage impraticable. Modifier un facteur déplaçait tous les autres de
//      façon non linéaire.
//
// Ici, chaque critère verse des points sur une échelle de 0 à 100, avec un
// plafond explicite. Le total est borné, les contributions sont conservées, et
// l'interface peut afficher « priorité 78 — examen dans 6 jours (+30), moyenne
// sous l'objectif (+22), jamais travaillé (+18) ».
// ---------------------------------------------------------------------------

const { getMatiereAverage } = require('./intelligence');

/** Plafond de chaque critère. Leur somme fait 100. */
const PLAFONDS = {
  examen: 30,      // proximité de l'épreuve, pondérée par le coefficient
  note: 25,        // écart à l'objectif de moyenne
  oubli: 20,       // temps écoulé au regard de l'intervalle attendu
  couverture: 15,  // part du contenu jamais abordée
  difficulte: 10,  // effort déclaré ou constaté
};

/** Modificateurs appliqués au total, une fois les points additionnés. */
const MODIFICATEURS = {
  dette: 1.5,          // matière à repasser : prioritaire, sans écraser le reste
  compensable: 0.85,   // déficit déjà rattrapé par la compensation
  maitrise: 0.8,       // matière solidement acquise
};

const borner = (valeur, min, max) => Math.min(max, Math.max(min, valeur));

/**
 * Points d'urgence liés à l'examen.
 * Le barème est volontairement discret : une échéance ne se vit pas de façon
 * continue, elle bascule (« c'est cette semaine »).
 */
function pointsExamen(joursAvantExamen, coefficient = 1) {
  if (!Number.isFinite(joursAvantExamen) || joursAvantExamen < 0) {
    return { points: 0, detail: null };
  }

  let part;
  let libelle;
  if (joursAvantExamen <= 3)       { part = 1.00; libelle = `Examen dans ${joursAvantExamen} jour${joursAvantExamen > 1 ? 's' : ''}`; }
  else if (joursAvantExamen <= 7)  { part = 0.85; libelle = 'Examen cette semaine'; }
  else if (joursAvantExamen <= 14) { part = 0.60; libelle = 'Examen dans deux semaines'; }
  else if (joursAvantExamen <= 30) { part = 0.35; libelle = 'Examen ce mois-ci'; }
  else if (joursAvantExamen <= 60) { part = 0.15; libelle = 'Examen à venir'; }
  else return { points: 0, detail: null };

  // Un fort coefficient rehausse l'urgence sans changer d'ordre de grandeur.
  const poidsCoef = borner(0.75 + coefficient * 0.08, 0.75, 1.25);
  const points = borner(PLAFONDS.examen * part * poidsCoef, 0, PLAFONDS.examen);

  return { points, detail: { critere: 'examen', points, libelle } };
}

/**
 * Points liés à la faiblesse d'une matière.
 *
 * Le seuil est fixe — 12/20 — et ne dépend d'aucun réglage. Le nom « objectif »
 * venait d'une époque où l'on déclarait une moyenne visée ; ce réglage a été
 * remplacé par le régime hebdomadaire (`objectifs.js`), mais le mot était resté
 * dans les libellés, laissant croire que le classement suivait une cible qu'on
 * aurait choisie. Il ne suit qu'un repère : douze, la moyenne au-dessus de
 * laquelle une matière cesse d'être en danger.
 *
 * Une matière à 6/20 avec un fort coefficient pèse davantage qu'une matière à
 * 9/20 sans coefficient.
 */
const SEUIL_FAIBLESSE = 12;

function pointsNote(moyenne, coefficient = 1, objectif = SEUIL_FAIBLESSE) {
  if (moyenne === null || moyenne === undefined || !Number.isFinite(moyenne)) {
    return { points: 0, detail: null };
  }

  if (moyenne >= objectif) {
    // Au-dessus du seuil : aucun point, et un modificateur allégera plus loin.
    return { points: 0, detail: null };
  }

  const ecart = objectif - moyenne;              // 0 → 12 dans le pire cas
  const partEcart = borner(ecart / 8, 0, 1);     // 8 points d'écart saturent l'échelle
  const poidsCoef = borner(0.7 + coefficient * 0.1, 0.7, 1.3);
  const points = borner(PLAFONDS.note * partEcart * poidsCoef, 0, PLAFONDS.note);

  // Le seuil est nommé, pour qu'on ne le confonde pas avec une cible personnelle.
  const libelle = moyenne < 8
    ? `Moyenne critique (${moyenne.toFixed(1)}/20)`
    : `Moyenne sous ${objectif} (${moyenne.toFixed(1)}/20)`;

  return { points, detail: { critere: 'note', points, libelle } };
}

/**
 * Points liés à l'oubli : temps écoulé depuis le dernier passage, rapporté à
 * l'intervalle attendu.
 *
 * L'ancien calcul ne regardait que le *nombre* de pratiques : un exercice fait
 * cinq fois il y a six mois passait derrière un exercice fait une fois hier,
 * ce qui contredit le principe même de la répétition espacée.
 */
function pointsOubli(joursDepuisDernierPassage, intervalleAttenduJours = 7, jamaisTravaille = false) {
  // Un contenu jamais abordé n'a rien à « oublier » : il est simplement dû.
  // Sans ce cas, un cours neuf ne recevait aucun point d'échéance et se
  // retrouvait derrière des révisions déjà faites — l'inverse d'un programme
  // qu'on suit.
  if (jamaisTravaille) {
    return {
      points: PLAFONDS.oubli,
      detail: { critere: 'oubli', points: PLAFONDS.oubli, libelle: 'Pas encore abordé' },
    };
  }

  if (!Number.isFinite(joursDepuisDernierPassage)) {
    return { points: 0, detail: null };
  }

  const intervalle = Math.max(1, intervalleAttenduJours);
  const retard = joursDepuisDernierPassage / intervalle;

  if (retard < 0.8) return { points: 0, detail: null };

  // 1× l'intervalle = échéance atteinte ; 2× = plein régime.
  const part = borner((retard - 0.8) / 1.2, 0, 1);
  const points = borner(PLAFONDS.oubli * part, 0, PLAFONDS.oubli);

  const libelle = retard >= 2
    ? `En retard de ${Math.round(joursDepuisDernierPassage - intervalle)} jours`
    : 'À revoir maintenant';

  return { points, detail: { critere: 'oubli', points, libelle } };
}

/**
 * Points liés à la couverture : ce qui n'a jamais été abordé passe devant ce
 * qui a déjà été vu plusieurs fois.
 */
function pointsCouverture(nombrePratiques = 0, dejaVu = false) {
  const n = Math.max(0, nombrePratiques);
  // Décroissance douce : 0 → plein, 1 → 50 %, 3 → 25 %, au-delà → marginal.
  const part = 1 / (1 + n);
  const points = borner(PLAFONDS.couverture * part, 0, PLAFONDS.couverture);

  /*
   * Le libellé se déduisait du seul compteur de passages. Un chapitre dont le
   * compteur manque — donnée ancienne, import, échec FSRS — mais qui porte une
   * date de révision se voyait alors annoncer « Jamais travaillé », sous les
   * yeux d'un étudiant qui se souvient parfaitement de l'avoir travaillé. Le
   * contexte, lui, dispose d'une preuve : la date du dernier passage. On s'y
   * fie plutôt qu'au compteur, et on se tait quand elle le contredit.
   */
  const libelle = n === 0 && !dejaVu ? 'Jamais travaillé' : null;
  return { points, detail: libelle ? { critere: 'couverture', points, libelle } : null };
}

/** Points liés à la difficulté déclarée. */
function pointsDifficulte(difficulte) {
  const bareme = {
    difficile: 1.0,
    assez_difficile: 0.7,
    moyen: 0.4,
    facile: 0.15,
    tres_facile: 0,
  };
  const part = bareme[difficulte] ?? 0.4;
  const points = borner(PLAFONDS.difficulte * part, 0, PLAFONDS.difficulte);

  const libelle = difficulte === 'difficile' ? 'Marqué difficile' : null;
  return { points, detail: libelle ? { critere: 'difficulte', points, libelle } : null };
}

/**
 * Priorité d'un exercice, entre 0 et 100, accompagnée de sa décomposition.
 *
 * @param {object} contexte
 * @param {number} [contexte.nombrePratiques]
 * @param {string} [contexte.difficulte]
 * @param {number} [contexte.joursDepuisDernierPassage]
 * @param {number} [contexte.intervalleAttenduJours]
 * @param {boolean} [contexte.jamaisTravaille] contenu jamais abordé : échéance atteinte
 * @param {number} [contexte.joursAvantExamen]
 * @param {number} [contexte.coefficient]
 * @param {number|null} [contexte.moyenne]
 * @param {boolean} [contexte.dette]
 * @param {boolean} [contexte.compensable]
 * @returns {{score:number, composantes:Array, modificateurs:Array, raisons:Array<string>}}
 */
function calculerPriorite(contexte = {}) {
  const {
    nombrePratiques = 0,
    difficulte,
    joursDepuisDernierPassage,
    intervalleAttenduJours = 7,
    jamaisTravaille = false,
    joursAvantExamen,
    coefficient = 1,
    moyenne = null,
    dette = false,
    compensable = false,
  } = contexte;

  const parts = [
    pointsExamen(joursAvantExamen, coefficient),
    pointsNote(moyenne, coefficient),
    pointsOubli(joursDepuisDernierPassage, intervalleAttenduJours, jamaisTravaille),
    pointsCouverture(nombrePratiques, Number.isFinite(joursDepuisDernierPassage)),
    pointsDifficulte(difficulte),
  ];

  let total = parts.reduce((somme, p) => somme + p.points, 0);
  const composantes = parts.map(p => p.detail).filter(Boolean);

  // --- Modificateurs, appliqués une fois la somme faite ---
  const modificateurs = [];

  if (dette) {
    total *= MODIFICATEURS.dette;
    modificateurs.push({ nom: 'dette', facteur: MODIFICATEURS.dette, libelle: 'Matière à repasser' });
  }
  if (compensable) {
    total *= MODIFICATEURS.compensable;
    modificateurs.push({ nom: 'compensable', facteur: MODIFICATEURS.compensable, libelle: 'Déjà compensée' });
  }
  if (moyenne !== null && Number.isFinite(moyenne) && moyenne >= 15) {
    total *= MODIFICATEURS.maitrise;
    modificateurs.push({ nom: 'maitrise', facteur: MODIFICATEURS.maitrise, libelle: 'Matière maîtrisée' });
  }

  const score = borner(Math.round(total * 10) / 10, 0, 100);

  // Les trois contributions les plus fortes suffisent à expliquer un classement.
  const raisons = composantes
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(c => c.libelle);

  return { score, composantes, modificateurs, raisons };
}

/** Nombre de jours entiers entre deux dates, ou null si l'une manque. */
function joursEntre(depuis, jusqua = new Date()) {
  if (!depuis) return null;
  const debut = depuis instanceof Date ? depuis : new Date(depuis);
  if (Number.isNaN(debut.getTime())) return null;

  const a = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
  const b = new Date(jusqua.getFullYear(), jusqua.getMonth(), jusqua.getDate());
  return Math.round((b - a) / 86400000);
}

/**
 * Construit le contexte de priorité d'un exercice à partir des objets du cursus.
 * Sert de pont entre les structures de données de l'orchestrateur et le calcul.
 */
function contexteDepuisExercice(exercice, matiere, options = {}) {
  const { joursAvantExamen, objectifMoyenne = 12, compensable = false, intervalleAttenduJours } = options;

  const derniereDate = exercice?.derniereRevision || exercice?.dernierePratique || null;
  // Les répétitions d'un chapitre vivent dans sa carte FSRS ; `repetitions` en
  // est la copie, que l'interface tient à jour — sauf quand FSRS a refusé la
  // carte. `velocite.js` consultait déjà les deux ; on fait de même.
  const passages = exercice?.nombrePratiques ?? exercice?.repetitions ?? exercice?.fsrsCard?.reps ?? 0;
  const resultatMoyenne = matiere ? getMatiereAverage(matiere) : null;

  return {
    nombrePratiques: passages,
    difficulte: exercice?.difficulte,
    joursDepuisDernierPassage: joursEntre(derniereDate),
    jamaisTravaille: !derniereDate && passages === 0,
    // À défaut d'intervalle FSRS connu, une semaine sert de repère.
    intervalleAttenduJours: intervalleAttenduJours ?? exercice?.jActuel ?? 7,
    joursAvantExamen,
    coefficient: matiere?.coefficient ?? 1,
    moyenne: resultatMoyenne ? resultatMoyenne.avg : null,
    objectifMoyenne,
    dette: Boolean(matiere?.dette),
    compensable,
  };
}

module.exports = {
  calculerPriorite,
  contexteDepuisExercice,
  joursEntre,
  pointsExamen,
  pointsNote,
  pointsOubli,
  pointsCouverture,
  pointsDifficulte,
  PLAFONDS,
  MODIFICATEURS,
};
