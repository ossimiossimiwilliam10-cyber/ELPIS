/**
 * Projection de note par matière.
 *
 * Le calcul précédent enchaînait trois mélanges successifs des mêmes grandeurs :
 * une inférence bayésienne, puis une moyenne pondérée arbitraire mêlant à
 * nouveau le prior et la vraisemblance, puis un écrasement de 40 % par la
 * rétention Anki. Une même information comptait donc plusieurs fois, et rien ne
 * garantissait la cohérence du résultat. Trois autres défauts s'y ajoutaient :
 *
 *   - une matière sans aucune note était projetée à 10/20, valeur inventée
 *     présentée comme une estimation ;
 *   - les coefficients des évaluations étaient collectés mais jamais utilisés,
 *     si bien que la projection divergeait du bulletin ;
 *   - l'intervalle de confiance décrivait la dispersion des notes brutes, pas
 *     celle de la quantité finalement affichée.
 *
 * Le modèle retenu ici est une combinaison de sources indépendantes, chacune
 * apportant une estimation et une précision (l'inverse de sa variance). C'est la
 * forme canonique de la fusion d'informations : la précision du résultat est la
 * somme des précisions, et l'intervalle de confiance en découle directement.
 */

const { normalizeDateStr, parseDateLocal } = require('./utils');

/** Demi-vie de la pondération par récence, en jours. */
const DEMI_VIE_JOURS = 60;

/** Écart-type supposé d'une note isolée, en points sur 20. */
const ECART_TYPE_NOTE = 2.5;

/** Écart-type de l'estimation tirée de la progression dans les cours. */
const ECART_TYPE_MAITRISE = 4.0;

/** Écart-type de l'estimation tirée de la rétention mesurée par Anki. */
const ECART_TYPE_RETENTION = 3.5;

/** La tendance ne peut à elle seule déplacer la projection de plus de 2 points. */
const CORRECTION_TENDANCE_MAX = 2;

/** Une régression n'est retenue qu'au-delà de ce coefficient de détermination. */
const R2_SIGNIFICATIF = 0.3;

/** Une note s'écartant de plus de deux écarts-types de la tendance est signalée. */
const SEUIL_ANOMALIE = 2;

/** Dispersion plancher, en points : en deçà, un écart ne signifie plus rien. */
const DISPERSION_MINIMALE = 0.5;

/** Quantile normal à 95 %. */
const Z_95 = 1.96;

const jour = 24 * 3600 * 1000;

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

  let sommeCarresTotale = 0;
  let sommeCarresResiduelle = 0;
  for (let i = 0; i < n; i++) {
    const prediction = origine + pente * xs[i];
    sommeCarresTotale += (ys[i] - moyY) ** 2;
    sommeCarresResiduelle += (ys[i] - prediction) ** 2;
  }
  const r2 = sommeCarresTotale === 0 ? 0 : 1 - sommeCarresResiduelle / sommeCarresTotale;

  return { pente, origine, r2 };
}

/** Écart-type d'un échantillon (degrés de liberté n − 1). */
function ecartType(valeurs) {
  const n = valeurs.length;
  if (n < 2) return 0;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / n;
  const variance = valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Horodatage exploitable, ou l'instant courant à défaut. */
function horodatage(valeur, maintenant) {
  if (!valeur) return maintenant;
  const t = parseDateLocal(normalizeDateStr(valeur))?.getTime();
  return Number.isFinite(t) ? t : maintenant;
}

/**
 * Notes d'une matière, triées dans le temps.
 * Les évaluations officielles et les annales travaillées comptent toutes deux,
 * chacune avec son coefficient.
 */
function collecterNotes(matiere, maintenant) {
  const notes = [];

  for (const e of matiere?.evaluations || []) {
    const valeur = parseFloat(e?.note);
    if (!Number.isFinite(valeur)) continue;
    notes.push({
      valeur,
      date: horodatage(e.date, maintenant),
      coefficient: Number(e.coefficient) > 0 ? Number(e.coefficient) : 1,
      source: 'evaluation',
    });
  }

  for (const a of matiere?.listeAnnales || []) {
    if (!(a?.nombrePratiques > 0)) continue;
    const valeur = parseFloat(a.derniereNote);
    if (!Number.isFinite(valeur)) continue;
    notes.push({
      valeur,
      date: horodatage(a.dernierePratique, maintenant),
      // Une annale blanche pèse moins qu'une épreuve officielle.
      coefficient: 0.5,
      source: 'annale',
    });
  }

  return notes.sort((a, b) => a.date - b.date);
}

/**
 * Moyenne des notes, pondérée à la fois par leur coefficient et par leur
 * fraîcheur. Le poids de récence décroît de moitié tous les `DEMI_VIE_JOURS`.
 *
 * Renvoie aussi le poids total, qui sert à mesurer la précision de l'estimation :
 * dix notes récentes valent mieux qu'une seule ancienne.
 */
function moyennePonderee(notes, maintenant) {
  if (notes.length === 0) return { moyenne: null, poidsTotal: 0 };

  const plusRecente = Math.max(...notes.map(n => n.date));
  let sommePonderee = 0;
  let poidsTotal = 0;

  for (const note of notes) {
    const ageJours = Math.max(0, (plusRecente - note.date) / jour);
    const poidsRecence = Math.pow(0.5, ageJours / DEMI_VIE_JOURS);
    const poids = note.coefficient * poidsRecence;
    sommePonderee += note.valeur * poids;
    poidsTotal += poids;
  }

  return { moyenne: sommePonderee / poidsTotal, poidsTotal };
}

/** Tendance récente, et notes qui s'en écartent nettement. */
function analyserTendance(notes) {
  if (notes.length < 3) {
    return { pente: 0, significative: false, r2: 0, anomalies: [] };
  }

  const origine = notes[0].date;
  const xs = notes.map(n => (n.date - origine) / jour);
  const ys = notes.map(n => n.valeur);
  const reg = regressionLineaire(xs, ys);

  const residus = ys.map((y, i) => y - (reg.origine + reg.pente * xs[i]));

  // Chaque note est jugée sur la dispersion des *autres* notes. Comparer un
  // écart à une dispersion qu'il gonfle lui-même masque précisément ce qu'on
  // cherche : dans la série 12, 12, 1, 12, 12, le 1 restait sous le seuil.
  const anomalies = [];
  notes.forEach((note, i) => {
    const autres = residus.filter((_, j) => j !== i);
    // Plancher de dispersion : sous un demi-point, l'écart n'a plus de sens
    // sur une échelle de notation, et le rapport partirait à l'infini.
    const dispersion = Math.max(ecartType(autres), DISPERSION_MINIMALE);
    const z = Math.abs(residus[i]) / dispersion;
    if (z > SEUIL_ANOMALIE) {
      anomalies.push({
        valeur: note.valeur,
        source: note.source,
        zScore: Number(z.toFixed(2)),
        date: new Date(note.date).toISOString().split('T')[0],
      });
    }
  });

  return {
    pente: reg.pente,
    r2: reg.r2,
    significative: reg.r2 > R2_SIGNIFICATIF,
    anomalies,
  };
}

/**
 * Fusionne des estimations indépendantes.
 * Chaque source apporte une valeur et une précision (1 / variance) ; la
 * précision du résultat est la somme des précisions.
 */
function fusionner(sources) {
  const utiles = sources.filter(s => s.valeur !== null && s.precision > 0);
  if (utiles.length === 0) return { valeur: null, precision: 0 };

  const precision = utiles.reduce((s, x) => s + x.precision, 0);
  const valeur = utiles.reduce((s, x) => s + x.valeur * x.precision, 0) / precision;
  return { valeur, precision };
}

/** Part des cours d'une matière déjà maîtrisés, ou `null` si on ne sait pas. */
function partMaitrisee(velocityMap, nomMatiere) {
  const donnees = velocityMap?.[(nomMatiere || '').toLowerCase().trim()];
  if (!donnees || !(donnees.totalCMs > 0)) return null;
  return donnees.masteredCMs / donnees.totalCMs;
}

/**
 * Projection d'une matière.
 * `projected` vaut `null` tant qu'aucune source n'est exploitable : une matière
 * dont on ne sait rien n'a pas de note projetée, et prétendre le contraire
 * fausse tout ce qui s'appuie dessus.
 */
function projeterMatiere(matiere, velocityMap, ankiStats, maintenant = Date.now()) {
  const notes = collecterNotes(matiere, maintenant);
  const { moyenne, poidsTotal } = moyennePonderee(notes, maintenant);
  const tendance = analyserTendance(notes);
  const maitrise = partMaitrisee(velocityMap, matiere?.nom);
  const retentionAnki = ankiStats?.retentionBySubject?.[matiere?.nom];

  // Trois sources indépendantes, chacune avec sa précision propre.
  const sources = [
    {
      nom: 'notes',
      valeur: moyenne,
      // Le poids total tient déjà compte des coefficients et de la fraîcheur :
      // l'erreur type d'une moyenne décroît comme l'inverse de ce poids.
      precision: poidsTotal > 0 ? poidsTotal / (ECART_TYPE_NOTE ** 2) : 0,
    },
    {
      nom: 'maitrise',
      valeur: maitrise === null ? null : maitrise * 20,
      // Avancer dans les cours ne dit qu'imparfaitement la note à venir : cette
      // source reste volontairement peu précise.
      precision: maitrise === null ? 0 : 1 / (ECART_TYPE_MAITRISE ** 2),
    },
    {
      nom: 'retention',
      valeur: Number.isFinite(retentionAnki) ? (retentionAnki / 100) * 20 : null,
      // La rétention complète les autres sources au lieu de les écraser.
      precision: Number.isFinite(retentionAnki) ? 1 / (ECART_TYPE_RETENTION ** 2) : 0,
    },
  ];

  const fusion = fusionner(sources);
  if (fusion.valeur === null) {
    return {
      projected: null,
      ci_lower: null,
      ci_upper: null,
      confidenceInterval: null,
      trend: 0,
      trendSignificant: false,
      sampleSize: 0,
      baseScore: null,
      masteryRatio: maitrise,
      sources: [],
    };
  }

  // Correction de tendance, bornée : extrapoler une droite sur trente jours
  // pouvait ajouter dix points à une matière dont on avait trois notes.
  let correction = 0;
  if (tendance.significative) {
    const brute = tendance.pente * 30;
    correction = Math.max(-CORRECTION_TENDANCE_MAX, Math.min(CORRECTION_TENDANCE_MAX, brute));
  }

  const projected = Math.max(0, Math.min(20, fusion.valeur + correction));
  // L'intervalle découle de la précision effectivement atteinte : il décrit
  // bien la quantité affichée, et se resserre à mesure que les sources
  // s'accumulent.
  const ecartTypeProjection = 1 / Math.sqrt(fusion.precision);
  const marge = Z_95 * ecartTypeProjection;

  return {
    projected: Number(projected.toFixed(1)),
    ci_lower: Number(Math.max(0, projected - marge).toFixed(1)),
    ci_upper: Number(Math.min(20, projected + marge).toFixed(1)),
    confidenceInterval: Number(marge.toFixed(1)),
    trend: Number(tendance.pente.toFixed(3)),
    trendSignificant: tendance.significative,
    sampleSize: notes.length,
    baseScore: moyenne === null ? null : Number(moyenne.toFixed(1)),
    masteryRatio: maitrise === null ? null : Number(maitrise.toFixed(2)),
    sources: sources.filter(s => s.valeur !== null && s.precision > 0).map(s => s.nom),
    anomalyFlags: tendance.anomalies.length > 0 ? tendance.anomalies : undefined,
  };
}

/** Vrai si le semestre est archivé, quelle que soit la forme du marqueur. */
function semestreArchive(s) {
  if (!s) return true;
  if (s.archived === true) return true;
  if (typeof s.archived === 'string') return s.archived.toLowerCase() === 'true';
  return false;
}

/** Projection détaillée de chaque matière active du cursus. */
function construireProjections(crs, velocityMap, ankiStats = null, maintenant = Date.now()) {
  const carte = {};
  for (const licence of crs?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestreArchive(semestre)) continue;
      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          if (!matiere?.nom) continue;
          carte[matiere.nom.toLowerCase().trim()] = projeterMatiere(matiere, velocityMap, ankiStats, maintenant);
        }
      }
    }
  }
  return carte;
}

/**
 * Notes projetées seules, sans le détail.
 * Les matières sans donnée exploitable sont absentes de la carte plutôt que
 * portées à `null` : tous les appelants testent `!== undefined`, et `null < 5`
 * vaut `true` en JavaScript — une matière inconnue déclenchait donc l'alerte
 * « note critique » réservée aux vraies difficultés.
 */
function construireCarteProjections(crs, velocityMap, ankiStats = null, maintenant = Date.now()) {
  const detail = construireProjections(crs, velocityMap, ankiStats, maintenant);
  const carte = {};
  for (const [cle, valeur] of Object.entries(detail)) {
    if (valeur.projected !== null) carte[cle] = valeur.projected;
  }
  return carte;
}

module.exports = {
  construireProjections,
  construireCarteProjections,
  projeterMatiere,
  moyennePonderee,
  collecterNotes,
  analyserTendance,
  fusionner,
  regressionLineaire,
  ecartType,
  DEMI_VIE_JOURS,
  CORRECTION_TENDANCE_MAX,
};
