/**
 * Vitesse d'apprentissage par matière.
 *
 * Le calcul précédent s'appuyait sur des grandeurs héritées de SM-2, alors que
 * le moteur de révision est passé à FSRS :
 *
 *   - la maîtrise d'un cours était jugée sur `easeFactor >= 2.5`. Or ce champ
 *     n'est plus qu'une valeur de compatibilité, recalculée depuis la difficulté
 *     FSRS : il mesure donc la difficulté ressentie, pas ce qui est retenu ;
 *   - la stabilité mémoire était ré-estimée par une heuristique exponentielle
 *     à partir de ce même `easeFactor`, alors que `fsrsCard.stability` la donne
 *     exactement ;
 *   - la rétention utilisait R = e^(−t/S), quand le reste de l'application
 *     applique la formule DSR R(t) = (1 + t/(9·S))⁻¹. Deux courbes d'oubli
 *     différentes coexistaient donc pour la même mémoire.
 *
 * Tout part désormais des cartes FSRS, avec repli sur les anciens champs pour
 * les cours créés avant la migration.
 */

const { normalizeDateStr, parseDateLocal } = require('./utils');

/** Au-delà de cette stabilité, un cours est considéré comme acquis. */
const STABILITE_MATURE = 21;

/** En deçà, le cours est encore en phase d'apprentissage. */
const STABILITE_JEUNE = 3;

/** Repli pour les cours d'avant FSRS : facteur de facilité valant maîtrise. */
const EASE_FACTOR_MATURE = 2.5;

/** Au-delà de ce nombre de séances par cours, la matière résiste. */
const SEANCES_AVANT_ALERTE = 4;

/** Nombre de séances supposé pour un cours dont on n'a encore aucune mesure. */
const SEANCES_PAR_DEFAUT = 3;

/** Durée supposée d'une séance sans historique, en minutes. */
const MINUTES_PAR_DEFAUT = 60;

/** Lissage exponentiel des durées : poids de la séance la plus récente. */
const ALPHA_LISSAGE = 0.3;

/** Part du temps d'étude quotidien consacrée aux cours magistraux. */
const PART_QUOTIDIENNE_CM = 0.3;

/** Capacité quotidienne supposée sans réglage, en minutes. */
const CAPACITE_PAR_DEFAUT = 120;

const JOUR = 24 * 3600 * 1000;

/** Rétention prédite par le modèle DSR, identique au reste de l'application. */
function retentionDSR(joursEcoules, stabilite) {
  const S = Math.max(0.1, Number(stabilite) || 0);
  const t = Math.max(0, Number(joursEcoules) || 0);
  return Math.pow(1 + t / (9 * S), -1);
}

/** Régression linéaire simple : pente, ordonnée à l'origine et R². */
function regressionLineaire(xs, ys) {
  const n = xs.length;
  if (n < 2) return { pente: 0, origine: ys[0] ?? 0, r2: 0 };

  const moyX = xs.reduce((s, x) => s + x, 0) / n;
  const moyY = ys.reduce((s, y) => s + y, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - moyX) * (ys[i] - moyY);
    varianceX += (xs[i] - moyX) ** 2;
  }
  if (varianceX === 0) return { pente: 0, origine: moyY, r2: 0 };

  const pente = covariance / varianceX;
  const origine = moyY - pente * moyX;

  let carresTotaux = 0;
  let carresResiduels = 0;
  for (let i = 0; i < n; i++) {
    carresTotaux += (ys[i] - moyY) ** 2;
    carresResiduels += (ys[i] - (origine + pente * xs[i])) ** 2;
  }
  const r2 = carresTotaux === 0 ? 0 : 1 - carresResiduels / carresTotaux;

  return { pente, origine, r2 };
}

/**
 * Stabilité mémoire d'un cours, en jours.
 * Retourne `null` quand le cours n'a jamais été travaillé : c'est différent
 * d'une stabilité nulle, qui décrirait un souvenir déjà perdu.
 */
function stabiliteDe(cm) {
  const fsrs = Number(cm?.fsrsCard?.stability);
  if (Number.isFinite(fsrs) && fsrs > 0) return fsrs;

  // Cours d'avant la migration : `jActuel` porte l'intervalle SM-2, qui est la
  // meilleure approximation disponible de la stabilité.
  const intervalle = Number(cm?.jActuel);
  if (Number.isFinite(intervalle) && intervalle > 0) return intervalle;

  return null;
}

/** Vrai si le cours est suffisamment ancré pour être considéré comme acquis. */
function estMaitrise(cm) {
  const stabilite = stabiliteDe(cm);
  if (stabilite !== null) return stabilite >= STABILITE_MATURE;

  // Repli pour les cours sans aucune trace FSRS ni intervalle.
  const ease = Number(cm?.easeFactor);
  return Number.isFinite(ease) && ease >= EASE_FACTOR_MATURE && (cm?.repetitions || 0) > 0;
}

/** Date de dernière révision d'une liste de cours, en millisecondes. */
function derniereRevision(listeCM) {
  let plusRecente = 0;
  for (const cm of listeCM || []) {
    if (!cm?.derniereRevision) continue;
    const t = parseDateLocal(normalizeDateStr(cm.derniereRevision))?.getTime();
    if (Number.isFinite(t) && t > plusRecente) plusRecente = t;
  }
  return plusRecente || null;
}

/** Regroupe l'historique par matière, une seule fois pour tout le cursus. */
function indexerHistorique(historique) {
  const index = new Map();
  for (const h of historique || []) {
    if (!h?.matiere) continue;
    if (!index.has(h.matiere)) index.set(h.matiere, []);
    index.get(h.matiere).push(h);
  }
  return index;
}

/** Moyenne lissée des durées, la séance la plus récente pesant le plus. */
function dureeLissee(seances) {
  let ema = null;
  for (const s of seances) {
    const minutes = Number(s.dureeMinutes) > 0 ? Number(s.dureeMinutes) : 30;
    ema = ema === null ? minutes : minutes * ALPHA_LISSAGE + ema * (1 - ALPHA_LISSAGE);
  }
  return ema;
}

/** Les séances raccourcissent-elles, s'allongent-elles, ou ni l'un ni l'autre ? */
function tendanceSeances(seances) {
  if (seances.length < 3) return 'stable';
  const xs = seances.map((_, i) => i);
  const ys = seances.map(s => Number(s.dureeMinutes) > 0 ? Number(s.dureeMinutes) : 30);
  const reg = regressionLineaire(xs, ys);
  if (reg.r2 <= 0.3) return 'stable';
  if (reg.pente < -2) return 'accelerating';
  if (reg.pente > 2) return 'decelerating';
  return 'stable';
}

/**
 * Mesures d'apprentissage d'une matière.
 *
 * `avgSessionsToMaster` rapporte les séances consacrées aux cours *acquis* au
 * nombre de ces cours. L'ancien calcul divisait toutes les séances de la
 * matière, y compris celles passées sur les cours non encore acquis, par le
 * seul nombre d'acquis : le résultat gonflait à mesure qu'on travaillait, et
 * une matière en cours d'apprentissage était signalée comme « lente ».
 */
function mesurerMatiere(matiere, seancesMatiere, cfg = {}, maintenant = Date.now()) {
  const listeCM = matiere?.listeCM || [];
  const seancesCM = seancesMatiere
    .filter(h => h.type === 'CM')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const totalMinutes = seancesMatiere.reduce(
    (s, h) => s + (Number(h.dureeMinutes) > 0 ? Number(h.dureeMinutes) : 30), 0,
  );

  const cmMaitrises = listeCM.filter(estMaitrise).length;
  const totalCM = listeCM.length;

  // Répétitions cumulées sur les cours acquis : le compteur FSRS dit combien de
  // passages il a réellement fallu, sans supposer que toutes les séances de la
  // matière y ont contribué.
  const passagesAcquis = listeCM
    .filter(estMaitrise)
    .reduce((s, cm) => s + (Number(cm?.fsrsCard?.reps) || Number(cm?.repetitions) || 1), 0);

  let seancesParCours = null;
  if (cmMaitrises > 0) {
    seancesParCours = passagesAcquis > 0
      ? passagesAcquis / cmMaitrises
      : seancesCM.length / cmMaitrises;
  }

  const minutesParSeance = dureeLissee(seancesCM) ?? MINUTES_PAR_DEFAUT;

  // --- Mémoire : les vraies valeurs FSRS, plus une heuristique ---
  const stabilites = listeCM.map(stabiliteDe).filter(s => s !== null);
  const stabiliteMoyenne = stabilites.length > 0
    ? stabilites.reduce((a, b) => a + b, 0) / stabilites.length
    : null;

  const derniere = derniereRevision(listeCM);
  let retention = null;
  if (derniere !== null && stabiliteMoyenne !== null) {
    retention = retentionDSR((maintenant - derniere) / JOUR, stabiliteMoyenne);
  }

  // --- Prévision d'achèvement ---
  const cmRestants = Math.max(0, totalCM - cmMaitrises);
  const minutesRestantes = cmRestants * (seancesParCours ?? SEANCES_PAR_DEFAUT) * minutesParSeance;

  let dateMaitrise = null;
  if (cmRestants > 0 && minutesRestantes > 0) {
    const capaciteQuotidienne = cfg.maxStudyHoursPerDay
      ? cfg.maxStudyHoursPerDay * 60 * PART_QUOTIDIENNE_CM
      : CAPACITE_PAR_DEFAUT;
    const jours = Math.ceil(minutesRestantes / Math.max(1, capaciteQuotidienne));
    dateMaitrise = new Date(maintenant + jours * JOUR).toISOString().split('T')[0];
  }

  const efficacite = seancesCM.length > 0 ? cmMaitrises / seancesCM.length : null;

  return {
    // --- Champs attendus par l'orchestrateur et l'interface ---
    avgSessionsToMaster: seancesParCours,
    avgMinutesPerSession: minutesParSeance,
    isSlowLearner: seancesParCours !== null && seancesParCours > SEANCES_AVANT_ALERTE,
    masteredCMs: cmMaitrises,
    totalCMs: totalCM,
    estimatedRemainingMinutes: minutesRestantes,
    totalStudyMinutes: totalMinutes,

    // --- Mémoire, alignée sur FSRS ---
    stabilityDays: stabiliteMoyenne === null ? null : Number(stabiliteMoyenne.toFixed(1)),
    // `null` plutôt que zéro tant qu'aucune révision n'a eu lieu : une matière
    // jamais travaillée n'a pas 0 % de rétention, elle n'en a pas encore.
    estimatedRetention: retention === null ? null : Number(retention.toFixed(2)),
    matureCMs: listeCM.filter(cm => (stabiliteDe(cm) ?? 0) >= STABILITE_MATURE).length,
    youngCMs: listeCM.filter(cm => {
      const s = stabiliteDe(cm);
      return s !== null && s >= STABILITE_JEUNE && s < STABILITE_MATURE;
    }).length,

    forecastMasteryDate: dateMaitrise,
    velocityTrend: tendanceSeances(seancesCM),
    learningEfficiency: efficacite === null ? null : Number(efficacite.toFixed(3)),
  };
}

/** Vrai si le semestre est archivé, quelle que soit la forme du marqueur. */
function semestreArchive(s) {
  if (!s) return true;
  if (s.archived === true) return true;
  if (typeof s.archived === 'string') return s.archived.toLowerCase() === 'true';
  return false;
}

/** Mesures d'apprentissage pour chaque matière active du cursus. */
function construireVelocites(crs, historique, cfg = {}, maintenant = Date.now()) {
  const carte = {};
  if (!crs?.licences) return carte;

  const parMatiere = indexerHistorique(historique);

  for (const licence of crs.licences) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestreArchive(semestre)) continue;
      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          if (!matiere?.nom) continue;
          const seances = parMatiere.get(matiere.nom) || [];
          carte[matiere.nom.toLowerCase().trim()] = mesurerMatiere(matiere, seances, cfg, maintenant);
        }
      }
    }
  }
  return carte;
}

module.exports = {
  construireVelocites,
  mesurerMatiere,
  estMaitrise,
  stabiliteDe,
  retentionDSR,
  dureeLissee,
  tendanceSeances,
  regressionLineaire,
  indexerHistorique,
  derniereRevision,
  STABILITE_MATURE,
  STABILITE_JEUNE,
  SEANCES_AVANT_ALERTE,
};
