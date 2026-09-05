/**
 * SCORING MODULE v3 — Fonctions de priorité et de scoring pour l'ordonnancement.
 * Extraites de l'orchestrateur.
 *
 * v3 corrige :
 *   - Fuzzy-match déterministe (tri longueur + alphabétique)
 *   - Bonus coeff≥3 étendu à tous les niveaux d'urgence ≥1.5
 *   - Normalisation de casse cohérente pour tous les lookups
 *   - Helper fuzzyLookupExamUrgency partagé (DRY)
 *   - Avertissement console pour difficulté inconnue
 *
 * v2 ajoutait :
 *   - Priorité sensible à l'intervalle de confiance (exploration des zones d'incertitude)
 *   - Poids Bayésiens adaptatifs (getAdaptiveWeight)
 *   - Flag anomalie intégré au scoring
 */

const { getMatiereAverage, isSemesterArchived } = require('./intelligence');
const { getRLMultiplier } = require('./rlEngine');

// ---------------------------------------------------------------------------
// Helper partagé : fuzzy lookup sensible à la casse dans examUrgencyMap
// Tri déterministe : longueur décroissante, puis ordre alphabétique.
// ---------------------------------------------------------------------------

function fuzzyLookupExamUrgency(examUrgencyMap, matiereName) {
  if (!examUrgencyMap || !matiereName) return undefined;
  const key = matiereName.toLowerCase().trim();
  if (!key) return undefined;

  // Correspondance exacte
  if (examUrgencyMap[key] !== undefined) return examUrgencyMap[key];

  // Fuzzy match : tri déterministe (longueur DESC, puis alpha ASC)
  const entries = Object.entries(examUrgencyMap)
    .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]));

  for (const [subjKey, data] of entries) {
    if (key.startsWith(subjKey) || subjKey.startsWith(key)) {
      return data;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Multiplier de difficulté
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = new Set([
  'difficile', 'assez_difficile', 'moyen', 'facile', 'tres_facile'
]);

function getDifficultyMultiplier(difficulte) {
  switch (difficulte) {
    case 'difficile':      return 1.5;
    case 'assez_difficile': return 1.2;
    case 'moyen':          return 1.0;
    case 'facile':         return 0.8;
    case 'tres_facile':    return 0.5;
    default:
      if (difficulte !== undefined && difficulte !== null && difficulte !== '') {
        console.warn(`[SCORING] Difficulté inconnue : "${difficulte}" — traitée comme "moyen" (1.0)`);
      }
      return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Score de priorité principal
// ---------------------------------------------------------------------------

/**
 * Priority score for exercises: combines practice count + difficulty + exam urgency
 * + confidence-aware exploration + adaptive weighting.
 *
 * @param {Object} ex - L'exercice (doit avoir nombrePratiques, difficulte)
 * @param {Object} examUrgencyMap - Map construite par buildExamUrgencyMap
 * @param {Object|string} matiere - L'objet matière complet ou son nom
 * @param {Object} remainingWeightMap - Map construite par buildRemainingWeightMap
 * @param {Object} compensationMap - Map construite par buildCompensationMap
 * @param {Object} [velocityMap] - Map construite par buildVelocityMap
 * @param {Object} [projectedScoreDetail] - Map détaillée de buildProjectedScoreDetailMap (v3)
 * @param {Object} [rlState] - État du modèle Reinforcement Learning (UCB)
 */
function getPrioScore(ex, examUrgencyMap, matiere, remainingWeightMap, compensationMap, velocityMap = null, projectedScoreDetail = null, rlState = null) {
  const practiceCount = Math.max(0, ex?.nombrePratiques || 0);
  let base = 1.0 / Math.sqrt(practiceCount + 1.0);

  const difficultyMultiplier = getDifficultyMultiplier(ex?.difficulte);
  if (ex?.difficulte === 'tres_facile') {
    base *= 0.6;
  } else {
    base *= difficultyMultiplier;
  }

  // Extraction normalisée du nom de matière (lowercase pour tous les lookups)
  let matiereNom = null;
  if (matiere && typeof matiere === 'object' && matiere.nom) {
    matiereNom = matiere.nom;
  } else if (typeof matiere === 'string') {
    matiereNom = matiere;
  }
  const matiereKey = matiereNom ? matiereNom.toLowerCase().trim() : null;

  // Exam urgency boost via le helper partagé
  if (matiereKey) {
    const boostData = fuzzyLookupExamUrgency(examUrgencyMap, matiereKey);
    if (boostData) base *= boostData.multiplier;
  }

  // Grade deficit boost (utilise l'objet matière complet)
  if (matiere && typeof matiere === 'object') {
    const result = getMatiereAverage(matiere);
    if (result) {
      const avgNote = result.avg;
      const coeff = matiere.coefficient || 1.0;
      let gradeBoost = 1.0;
      if (avgNote < 12) {
        gradeBoost = 1.0 + ((12 - avgNote) / 10) * coeff;
      } else if (avgNote >= 15) {
        gradeBoost = 0.8;
      }
      base *= gradeBoost;
    }

    // AXE 5: Remaining Weight Factor (lookup normalisé)
    if (remainingWeightMap && matiereKey) {
      const rwData = remainingWeightMap[matiereKey];
      if (rwData && rwData.remainingRatio >= 0.4) {
        const rwBoost = 1.0 + (rwData.remainingRatio - 0.4) * 1.0;
        base *= rwBoost;
      }
    }

    // AXE 8: Compensation (lookup normalisé)
    if (compensationMap && matiereKey) {
      const compData = compensationMap[matiereKey];
      if (compData && compData.compensable && compData.deficit < 2) {
        base *= 0.7;
      }
    }
  }

  // Priority boost for Debts (AJAC)
  if (matiere && typeof matiere === 'object' && matiere.dette) {
    base *= 10.0;
  }

  // AXE 13: Synergies Inter-Matières (lookup normalisé)
  let synergyBoost = 1.0;
  if (matiere && typeof matiere === 'object' && matiereKey && velocityMap) {
    if (matiere._ueMatieres) {
      for (const synName of matiere._ueMatieres) {
        if (synName === matiereKey) continue;
        const v = velocityMap[synName];
        if (v && v.totalCMs > 0) {
          const ratio = v.masteredCMs / v.totalCMs;
          if (ratio < 0.3) {
            synergyBoost += 0.2;
          } else if (ratio > 0.8) {
            synergyBoost = Math.max(0.5, synergyBoost - 0.1);
          }
        }
      }
    }
  }
  synergyBoost = Math.max(0.5, Math.min(5.0, synergyBoost));
  base *= synergyBoost;

  // Projected score detail (lookup normalisé)
  if (projectedScoreDetail && matiereKey) {
    const psDetail = projectedScoreDetail[matiereKey];
    if (psDetail && psDetail.confidenceInterval > 4.5) {
      const uncertaintyBoost = 1.0 + (psDetail.confidenceInterval - 4.5) * 0.05;
      base *= Math.min(1.2, uncertaintyBoost);
    }
    if (psDetail && psDetail.anomalyFlags && psDetail.anomalyFlags.length > 0) {
      base *= 1.05;
    }
    if (psDetail && psDetail.trendSignificant && psDetail.trend < -0.05) {
      base *= 1.0 + Math.min(0.2, Math.abs(psDetail.trend) * 2);
    }
  }

  // AXE 19: Reinforcement Learning (UCB Boost)
  if (rlState && matiereKey) {
    const rlBoost = getRLMultiplier(matiereKey, rlState);
    base *= rlBoost;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Boost examen par matière
// ---------------------------------------------------------------------------

/**
 * Calcule le boost de priorité d'une matière en fonction de la proximité d'examen
 * et du coefficient.
 */
function getSubjectExamBoost(matiere, examUrgencyMap) {
  if (!matiere || !matiere.nom) return { boost: 1.0, daysToExam: Infinity };

  const coeff = matiere.coefficient || 1.0;
  const matiereKey = matiere.nom.toLowerCase().trim();

  const boostData = fuzzyLookupExamUrgency(examUrgencyMap, matiereKey);
  let baseBoost = boostData ? boostData.multiplier : 1.0;
  const daysToExam = boostData ? boostData.daysToExam : Infinity;

  // Bonus pour matières à fort coefficient : étendu à tous les niveaux d'urgence ≥ 1.5
  if (coeff >= 3 && baseBoost >= 1.5) {
    baseBoost = Math.max(baseBoost, 2.0);
  }

  // `estimee` remonte tel quel : la fin de semestre n'est pas une date d'épreuve.
  return { boost: baseBoost * (1.0 + (coeff - 1) * 0.1), daysToExam, estimee: Boolean(boostData && boostData.estimee) };
}

// ---------------------------------------------------------------------------
// AXE 18 : Poids Bayésiens Adaptatifs
// ---------------------------------------------------------------------------

/**
 * Ajuste les poids des différents facteurs de scoring en fonction
 * des résultats observés (corrélation entre priorité élevée et bonne note).
 *
 * @param {Object} currentWeights - Poids actuels { examUrgency, gradeDeficit, remainingWeight, synergy, exploration }
 * @param {Array} recentOutcomes - [{ matiere, prioriteAvant, noteObtenue, timestamp }]
 * @returns {Object} nouveaux poids ajustés
 */
function getAdaptiveWeight(currentWeights, recentOutcomes) {
  const defaults = {
    examUrgency: 1.0,
    gradeDeficit: 1.0,
    remainingWeight: 1.0,
    synergy: 1.0,
    exploration: 0.15
  };

  const weights = { ...defaults, ...currentWeights };

  if (!recentOutcomes || recentOutcomes.length < 3) return weights;

  const alpha = 0.2;

  const avgNote = recentOutcomes.reduce((a, o) => a + (o.noteObtenue || 10), 0) / recentOutcomes.length;

  if (avgNote > 13) {
    weights.exploration = Math.max(0.05, weights.exploration - alpha * 0.02);
  } else if (avgNote < 9) {
    weights.exploration = Math.min(0.30, weights.exploration + alpha * 0.05);
  }

  const highCoefOutcomes = recentOutcomes.filter(o => o.coefficient >= 2);
  if (highCoefOutcomes.length >= 2) {
    const highCoefAvg = highCoefOutcomes.reduce((a, o) => a + (o.noteObtenue || 10), 0) / highCoefOutcomes.length;
    if (highCoefAvg > 12) {
      weights.gradeDeficit = Math.min(1.5, weights.gradeDeficit + alpha * 0.03);
    }
  }

  return weights;
}

// ---------------------------------------------------------------------------
// AXE 7 : Capitalised UEs (Compensation inter-semestre)
// ---------------------------------------------------------------------------

function getCapitalisedUEs(licence) {
  const capitalisedUEs = new Set();
  if (!licence || !licence.semestres) return capitalisedUEs;

  for (let yearIdx = 0; yearIdx < Math.ceil(licence.semestres.length / 2); yearIdx++) {
    const s1Idx = yearIdx * 2;
    const s2Idx = yearIdx * 2 + 1;
    const sem1 = licence.semestres[s1Idx];
    const sem2 = licence.semestres[s2Idx];

    const processSemester = (sem) => {
      if (!sem) return { avg: null, ues: [] };
      const semestreTermine = isSemesterArchived(sem);
      let semSumECTS = 0;
      let semSumNotes = 0;
      const uesData = [];
      (sem.ues || []).forEach(ue => {
        let ueSumWeight = 0;
        let ueSumNotes = 0;
        let isUeDispense = true;
        let hasMatieres = false;
        (ue.matieres || []).forEach(m => {
          hasMatieres = true;
          if (!m.dispense) isUeDispense = false;
          if (m.dispense) return;
          const avgData = getMatiereAverage(m);
          if (avgData !== null) {
            const avg = avgData.avg;
            const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
            // Un coefficient nul, négatif ou illisible ne pondère rien : le
            // règlement des études ne prévoit aucun bonus. Le traiter en bonus
            // additif gonflait la moyenne de l'UE, qui pouvait alors franchir 10
            // et être déclarée capitalisée à tort — ELPIS cessait d'en planifier
            // les révisions. Même correction que dans utils/bulletin.js.
            if (Number.isFinite(coef) && coef > 0) { ueSumWeight += coef; ueSumNotes += avg * coef; }
          }
        });
        if (!hasMatieres) isUeDispense = false;
        if (ue.acquise || ue.dispense) isUeDispense = true;
        const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
        const isUeValidated = (ueAvg !== null && ueAvg >= 10) || isUeDispense || ue.acquise;
        if (ueAvg !== null) { semSumNotes += ueAvg * (ue.ects || 0); semSumECTS += (ue.ects || 0); }
        uesData.push({ nom: ue.nom, ueAvg, isUeValidated, ue, semestreTermine });
      });
      const avg = semSumECTS > 0 ? semSumNotes / semSumECTS : null;
      return { avg, ues: uesData };
    };

    const dataS1 = processSemester(sem1);
    const dataS2 = processSemester(sem2);
    let annualAvg = null;
    if (dataS1.avg !== null && dataS2.avg !== null) { annualAvg = (dataS1.avg + dataS2.avg) / 2; }

    /*
     * Une UE n'est capitalisée que si son évaluation est achevée, ou si tu l'as
     * déclarée acquise toi-même (`ue.acquise`) — cas des années précédentes,
     * saisies d'une seule moyenne récapitulative. Sans ce garde-fou, une
     * moyenne provisoire au-dessus de 10 suffisait à retirer une UE du planning
     * de révisions jusqu’à la fin du semestre.
     */
    /*
     * Une UE n'est capitalisée que si son semestre est terminé, ou si tu l'as
     * déclarée acquise toi-même.
     *
     * Le critère précédent — au moins trois notes conformes au règlement —
     * était trop faible : trois notes sont le *minimum* exigé de l’université,
     * pas la preuve que l'évaluation est close. Mesuré sur un cursus garni de
     * trois notes par matière en cours de semestre, les cinq UE passaient
     * capitalisées dès le mois d’août et disparaissaient entièrement du
     * planning, examens encore à venir. La capitalisation est prononcée par le
     * jury en fin d'année : c'est donc une question de calendrier, pas de
     * volume de notes.
     */
    const capitaliser = (u) => {
      if (u.ue && (u.ue.acquise || u.ue.dispense)) { capitalisedUEs.add(u.nom); return; }
      if (u.semestreTermine) capitalisedUEs.add(u.nom);
    };

    if (annualAvg !== null && annualAvg >= 10) {
      dataS1.ues.forEach(capitaliser);
      dataS2.ues.forEach(capitaliser);
    } else {
      if (dataS1.avg !== null && dataS1.avg >= 10) dataS1.ues.forEach(capitaliser);
      else dataS1.ues.forEach(u => { if (u.isUeValidated) capitaliser(u); });

      if (dataS2.avg !== null && dataS2.avg >= 10) dataS2.ues.forEach(capitaliser);
      else dataS2.ues.forEach(u => { if (u.isUeValidated) capitaliser(u); });
    }
  }
  return capitalisedUEs;
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  fuzzyLookupExamUrgency,
  getDifficultyMultiplier,
  getPrioScore,
  getSubjectExamBoost,
  getAdaptiveWeight,
  getCapitalisedUEs
};
