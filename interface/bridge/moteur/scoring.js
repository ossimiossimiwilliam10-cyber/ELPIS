/**
 * SCORING MODULE v2 — Fonctions de priorité et de scoring pour l'ordonnancement.
 * Extraites de l'orchestrateur.
 *
 * v2 ajoute :
 *   - Priorité sensible à l'intervalle de confiance (exploration des zones d'incertitude)
 *   - Poids Bayésiens adaptatifs (getAdaptiveWeight)
 *   - Flag anomalie intégré au scoring
 */

const { getMatiereAverage } = require('./intelligence');

/**
 * Multiplier de difficulté pour une tâche donnée (utilisé pour l'estimation de durée).
 */
function getDifficultyMultiplier(difficulte) {
  switch (difficulte) {
    case 'difficile': return 1.5;
    case 'assez_difficile': return 1.2;
    case 'moyen': return 1.0;
    case 'facile': return 0.8;
    case 'tres_facile': return 0.5;
    default: return 1.0;
  }
}

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
 */
function getPrioScore(ex, examUrgencyMap, matiere, remainingWeightMap, compensationMap, velocityMap = null, projectedScoreDetail = null) {
  const practiceCount = Math.max(0, ex?.nombrePratiques || 0);
  let base = 1.0 / Math.sqrt(practiceCount + 1.0);

  const difficultyMultiplier = getDifficultyMultiplier(ex?.difficulte);
  if (ex?.difficulte === 'tres_facile') {
    base *= 0.6;
  } else {
    base *= difficultyMultiplier;
  }

  let matiereNom = matiere;
  if (matiere && typeof matiere === 'object' && matiere.nom) {
    matiereNom = matiere.nom;
  }

  // Exam urgency boost: match subject by fuzzy name
  if (examUrgencyMap && matiereNom) {
    const matiereKey = matiereNom.toLowerCase().trim();
    let boostData = examUrgencyMap[matiereKey];
    if (boostData === undefined) {
      // Prioritize longest match first to avoid "Physique" overriding "Physique Avancée"
      const entries = Object.entries(examUrgencyMap).sort((a, b) => b[0].length - a[0].length);
      for (const [subjKey, data] of entries) {
        if (matiereKey.startsWith(subjKey) || subjKey.startsWith(matiereKey)) {
          boostData = data;
          break;
        }
      }
    }
    if (boostData) base *= boostData.multiplier;
  }

  // Grade deficit boost (kept modest and deterministic)
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

    // AXE 5: Remaining Weight Factor
    if (remainingWeightMap && typeof matiere === 'object' && matiere.nom) {
      const rwData = remainingWeightMap[matiere.nom];
      if (rwData && rwData.remainingRatio >= 0.4) {
        const rwBoost = 1.0 + (rwData.remainingRatio - 0.4) * 1.0;
        base *= rwBoost;
      }
    }

    // AXE 8: Compensation — reduce pressure if UE is compensable
    if (compensationMap && typeof matiere === 'object' && matiere.nom) {
      const compData = compensationMap[matiere.nom];
      if (compData && compData.compensable && compData.deficit < 2) {
        base *= 0.7;
      }
    }
  }

  // AXE 13: Synergies Inter-Matières (détection automatique par UE partagée)
  let synergyBoost = 1.0;
  if (matiere && typeof matiere === 'object' && matiere.nom && velocityMap) {
    if (matiere._ueMatieres) {
      for (const synName of matiere._ueMatieres) {
        if (synName === matiere.nom) continue;
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

  // Keep advanced projection signals as a small, non-random adjustment.
  if (projectedScoreDetail && matiereNom) {
    const psDetail = projectedScoreDetail[matiereNom];
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

  return base;
}

/**
 * Calcule le boost de priorité d'une matière en fonction de la proximité d'examen
 * et du coefficient.
 */
function getSubjectExamBoost(matiere, examUrgencyMap) {
  if (!matiere || !matiere.nom) return { boost: 1.0, daysToExam: Infinity };

  const coeff = matiere.coefficient || 1.0;
  const matiereKey = matiere.nom.toLowerCase().trim();

  let baseBoost = 1.0;
  let daysToExam = Infinity;

  if (examUrgencyMap[matiereKey] !== undefined) {
    baseBoost = examUrgencyMap[matiereKey].multiplier;
    daysToExam = examUrgencyMap[matiereKey].daysToExam;
  } else {
    const entries = Object.entries(examUrgencyMap).sort((a, b) => b[0].length - a[0].length);
    for (const [subjKey, data] of entries) {
      if (matiereKey.startsWith(subjKey) || subjKey.startsWith(matiereKey)) {
        baseBoost = data.multiplier;
        daysToExam = data.daysToExam;
        break;
      }
    }
  }

  if (coeff >= 3 && Math.abs(baseBoost - 1.5) < 0.01) {
    baseBoost = 2.0;
  }

  return { boost: baseBoost * (1.0 + (coeff - 1) * 0.1), daysToExam };
}

/**
 * AXE 18 (NOUVEAU) : Poids Bayésiens Adaptatifs
 *
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

  // Calculer la corrélation entre priorité et résultat
  // Si une priorité élevée mène à une bonne note → le système fonctionne, garder les poids
  // Si une priorité élevée mène à une mauvaise note → ajuster (trop d'exploration ?)

  const alpha = 0.2; // taux d'apprentissage

  // Moyenne récente des notes
  const avgNote = recentOutcomes.reduce((a, o) => a + (o.noteObtenue || 10), 0) / recentOutcomes.length;

  // Si les notes récentes sont bonnes (>13), on peut réduire l'exploration
  if (avgNote > 13) {
    weights.exploration = Math.max(0.05, weights.exploration - alpha * 0.02);
  } else if (avgNote < 9) {
    // Mauvais résultats : augmenter l'exploration pour trouver de meilleures stratégies
    weights.exploration = Math.min(0.30, weights.exploration + alpha * 0.05);
  }

  // Si l'utilisateur réussit bien les matières avec fort coefficient → renforcer gradeDeficit
  const highCoefOutcomes = recentOutcomes.filter(o => o.coefficient >= 2);
  if (highCoefOutcomes.length >= 2) {
    const highCoefAvg = highCoefOutcomes.reduce((a, o) => a + (o.noteObtenue || 10), 0) / highCoefOutcomes.length;
    if (highCoefAvg > 12) {
      weights.gradeDeficit = Math.min(1.5, weights.gradeDeficit + alpha * 0.03);
    }
  }

  return weights;
}

module.exports = { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost, getAdaptiveWeight };