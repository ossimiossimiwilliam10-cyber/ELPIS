/**
 * SCORING MODULE — Fonctions de priorité et de scoring pour l'ordonnancement.
 * Extraites de l'orchestrateur.
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
 * Priority score for exercises: combines practice count + difficulty + exam urgency.
 * Higher score = more urgent.
 *
 * @param {Object} ex - L'exercice (doit avoir nombrePratiques, difficulte)
 * @param {Object} examUrgencyMap - Map construite par buildExamUrgencyMap
 * @param {Object|string} matiere - L'objet matière complet ou son nom
 * @param {Object} remainingWeightMap - Map construite par buildRemainingWeightMap
 * @param {Object} compensationMap - Map construite par buildCompensationMap
 * @param {Object} [velocityMap] - Map construite par buildVelocityMap (optionnel, pour Axe 13)
 */
function getPrioScore(ex, examUrgencyMap, matiere, remainingWeightMap, compensationMap, velocityMap = null) {
  let base = 1.0 / Math.sqrt((ex.nombrePratiques || 0) + 1.0);
  if (ex.difficulte === 'difficile') base *= 1.5;
  else if (ex.difficulte === 'assez_difficile') base *= 1.2;
  else if (ex.difficulte === 'facile') base *= 0.8;
  else if (ex.difficulte === 'tres_facile') base *= 0.6;

  let matiereNom = matiere;
  if (matiere && typeof matiere === 'object' && matiere.nom) {
    matiereNom = matiere.nom;
  }

  // Exam urgency boost: match subject by fuzzy name
  if (examUrgencyMap && matiereNom) {
    const matiereKey = matiereNom.toLowerCase().trim();
    let boostData = examUrgencyMap[matiereKey];
    if (boostData === undefined) {
      for (const [subjKey, data] of Object.entries(examUrgencyMap)) {
        if (matiereKey === subjKey || matiereKey.startsWith(subjKey) || subjKey.startsWith(matiereKey)) {
          boostData = data;
          break;
        }
      }
    }
    if (boostData) base *= boostData.multiplier;
  }

  // Grade deficit boost (enhanced with compensation awareness)
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

  // AXE 13: Synergies Inter-Matières
  let synergyBoost = 1.0;
  if (matiere && matiere.synergies && velocityMap) {
    for (const syn of matiere.synergies) {
      const v = velocityMap[syn];
      if (v && v.totalCMs > 0) {
        const ratio = v.masteredCMs / v.totalCMs;
        if (ratio < 0.3) {
          synergyBoost += 0.2;
        } else if (ratio > 0.8) {
          synergyBoost = Math.max(0.5, synergyBoost - 0.1); // Éviter que le boost ne s'annule
        }
      }
    }
  }
  // Sécurité : le boost de synergie ne doit jamais annuler ni amplifier de façon déraisonnable
  synergyBoost = Math.max(0.5, Math.min(5.0, synergyBoost));
  base *= synergyBoost;

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
    for (const [subjKey, data] of Object.entries(examUrgencyMap)) {
      if (matiereKey === subjKey || matiereKey.startsWith(subjKey) || subjKey.startsWith(matiereKey)) {
        baseBoost = data.multiplier;
        daysToExam = data.daysToExam;
        break;
      }
    }
  }

  // Si le coeff est >= 3 et que l'examen est dans les 14 jours (boost 1.5),
  // on force le boost à 2.0 pour casser la parité !
  if (coeff >= 3 && baseBoost === 1.5) {
    baseBoost = 2.0;
  }

  return { boost: baseBoost * (1.0 + (coeff - 1) * 0.1), daysToExam };
}

module.exports = { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost };
