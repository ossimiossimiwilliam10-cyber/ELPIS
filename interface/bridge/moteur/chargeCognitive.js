/**
 * Charge cognitive par matière — ce qui demande un esprit frais, et ce qui
 * peut attendre la fin de journée.
 *
 * Trois défauts entachaient le calcul précédent :
 *
 *   - `allEF.sort()` triait des nombres **par ordre alphabétique**, ce qui est
 *     le comportement de `Array.prototype.sort` sans comparateur. Les valeurs
 *     restaient dans le bon ordre par coïncidence, l'échelle en vigueur allant
 *     de 1,3 à 3,55 ; toute autre plage aurait placé les centroïdes n'importe
 *     où ;
 *   - la mesure reposait sur `easeFactor`, hérité de SM-2, alors que la
 *     difficulté FSRS existe et dit précisément la même chose en mieux ;
 *   - une matière sans aucune donnée recevait la valeur 2,5, ce qui la plaçait
 *     au milieu du classement comme si on l'avait mesurée.
 */

/** Nombre minimal de matières mesurées pour que le regroupement ait un sens. */
const MINIMUM_POUR_GROUPER = 3;

/** Itérations maximales du regroupement ; il converge presque toujours avant. */
const ITERATIONS_MAX = 20;

/** Déplacement en deçà duquel les centres sont considérés comme stabilisés. */
const CONVERGENCE = 1e-6;

/** Échelle de difficulté FSRS. */
const DIFFICULTE_MIN = 1;
const DIFFICULTE_MAX = 10;

/** Seuils de repli quand trop peu de matières sont mesurées. */
const SEUIL_LOURD = 6.5;
const SEUIL_LEGER = 4.0;

/**
 * Difficulté d'un cours sur l'échelle FSRS (1 = évident, 10 = ardu).
 * `null` tant que le cours n'a pas été évalué au moins une fois.
 */
function difficulteDe(cm) {
  const fsrs = Number(cm?.fsrsCard?.difficulty);
  if (Number.isFinite(fsrs) && fsrs >= DIFFICULTE_MIN && fsrs <= DIFFICULTE_MAX) return fsrs;

  // Cours d'avant la migration : `easeFactor` suit la relation inverse
  // utilisée à l'écriture, ef = (10 − d) / 4 + 1,3.
  const ease = Number(cm?.easeFactor);
  if (Number.isFinite(ease) && ease > 0) {
    const difficulte = 10 - (ease - 1.3) * 4;
    return Math.max(DIFFICULTE_MIN, Math.min(DIFFICULTE_MAX, difficulte));
  }

  return null;
}

/** Difficulté moyenne d'une matière, ou `null` si rien n'a été évalué. */
function difficulteMatiere(matiere) {
  const mesures = (matiere?.listeCM || []).map(difficulteDe).filter(d => d !== null);
  if (mesures.length === 0) return null;
  return mesures.reduce((a, b) => a + b, 0) / mesures.length;
}

/**
 * Regroupement en trois classes sur une seule dimension.
 *
 * Les centres partent des quantiles plutôt que du minimum, de la médiane et du
 * maximum : trois valeurs extrêmes rendaient le résultat sensible à une seule
 * matière atypique. La boucle s'arrête dès stabilisation, et un groupe vide
 * conserve son centre au lieu de disparaître.
 */
function regrouperEnTrois(valeurs) {
  const triees = [...valeurs].sort((a, b) => a - b);
  const quantile = (p) => triees[Math.min(triees.length - 1, Math.floor(p * triees.length))];

  let centres = [quantile(1 / 6), quantile(3 / 6), quantile(5 / 6)];

  for (let iteration = 0; iteration < ITERATIONS_MAX; iteration++) {
    const sommes = [0, 0, 0];
    const effectifs = [0, 0, 0];

    for (const valeur of triees) {
      const k = centreLePlusProche(valeur, centres);
      sommes[k] += valeur;
      effectifs[k]++;
    }

    const nouveaux = centres.map((centre, k) => (effectifs[k] > 0 ? sommes[k] / effectifs[k] : centre));
    const deplacement = Math.max(...nouveaux.map((c, k) => Math.abs(c - centres[k])));
    centres = nouveaux;
    if (deplacement < CONVERGENCE) break;
  }

  // Les centres restent ordonnés du plus léger au plus lourd, quel que soit
  // l'ordre d'arrivée : le libellé dépend du rang, pas de l'indice.
  return centres.sort((a, b) => a - b);
}

/** Indice du centre le plus proche ; à égalité, le plus petit indice gagne. */
function centreLePlusProche(valeur, centres) {
  let meilleur = 0;
  let distance = Math.abs(valeur - centres[0]);
  for (let k = 1; k < centres.length; k++) {
    const d = Math.abs(valeur - centres[k]);
    if (d < distance) {
      distance = d;
      meilleur = k;
    }
  }
  return meilleur;
}

/** Vrai si le semestre est archivé, quelle que soit la forme du marqueur. */
function semestreArchive(s) {
  if (!s) return true;
  if (s.archived === true) return true;
  if (typeof s.archived === 'string') return s.archived.toLowerCase() === 'true';
  return false;
}

/** Matières actives du cursus, avec leur difficulté moyenne. */
function releverMatieres(crs) {
  const releve = [];
  for (const licence of crs?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestreArchive(semestre)) continue;
      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          if (!matiere?.nom) continue;
          releve.push({ nom: matiere.nom, difficulte: difficulteMatiere(matiere) });
        }
      }
    }
  }
  return releve;
}

/**
 * Répartit les matières entre charge lourde, moyenne et légère.
 *
 * Les matières sans aucune évaluation sortent du classement avec la mention
 * `inconnue` : les inclure au milieu revenait à affirmer une mesure qu'on
 * n'avait pas.
 */
function construireChargeCognitive(crs) {
  const carte = {};
  const matieres = releverMatieres(crs);
  const mesurees = matieres.filter(m => m.difficulte !== null);

  const classer = (difficulte, centres) => {
    if (centres) {
      const rang = centreLePlusProche(difficulte, centres);
      return ['light', 'medium', 'heavy'][rang];
    }
    if (difficulte >= SEUIL_LOURD) return 'heavy';
    if (difficulte <= SEUIL_LEGER) return 'light';
    return 'medium';
  };

  const centres = mesurees.length >= MINIMUM_POUR_GROUPER
    ? regrouperEnTrois(mesurees.map(m => m.difficulte))
    : null;

  for (const m of matieres) {
    const cle = m.nom.toLowerCase().trim();
    if (m.difficulte === null) {
      carte[cle] = { cognitiveLoad: 'inconnue', difficulte: null, avgEaseFactor: null };
      continue;
    }
    carte[cle] = {
      cognitiveLoad: classer(m.difficulte, centres),
      difficulte: Number(m.difficulte.toFixed(2)),
      // Conservé pour les consommateurs antérieurs à la migration FSRS.
      avgEaseFactor: Number(((10 - m.difficulte) / 4 + 1.3).toFixed(2)),
    };
  }

  return carte;
}

module.exports = {
  construireChargeCognitive,
  difficulteDe,
  difficulteMatiere,
  regrouperEnTrois,
  centreLePlusProche,
  releverMatieres,
  MINIMUM_POUR_GROUPER,
  SEUIL_LOURD,
  SEUIL_LEGER,
};
