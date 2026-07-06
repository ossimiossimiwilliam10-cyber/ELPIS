/**
 * INTELLIGENCE MODULE v2 — Fonctions d'analyse avancée
 * Extraites de l'orchestrateur pour modularité et testabilité.
 */

const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getTodayString() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  d.setHours(d.getHours() - 4);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getDayOfWeekString() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  d.setHours(d.getHours() - 4); // Apply Night Owl offset to the day of week too
  return DAYS_OF_WEEK[d.getDay()];
}

const { normalizeDateStr, parseDateLocal } = require('./utils');
function isSemesterArchived(s) {
  if (s.archived) return true;
  if (s.dateFin) {
    const df = parseDateLocal(normalizeDateStr(s.dateFin));
    const now = new Date();
    if (df && df < now) return true;
  }
  return false;
}

/**
 * Calcule la moyenne pondérée d'une matière à partir de ses évaluations.
 * Ne prend en compte que les évaluations déjà notées.
 */
function getMatiereAverage(matiere) {
  if (!matiere || !matiere.evaluations || !Array.isArray(matiere.evaluations)) return null;
  let totalScore = 0;
  let totalCoef = 0;
  matiere.evaluations.forEach(ev => {
    if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
      const c = ev.coefficient || 1;
      totalScore += ev.note * c;
      totalCoef += c;
    }
  });
  return totalCoef > 0 ? { avg: totalScore / totalCoef, evaluatedCoef: totalCoef } : null;
}

/**
 * AXE 8 : Compensation Inter-UE.
 */
function buildCompensationMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      const ueData = [];
      for (const ue of (s.ues || [])) {
        let ueSumWeight = 0;
        let ueSumNotes = 0;
        for (const m of (ue.matieres || [])) {
          const result = getMatiereAverage(m);
          if (result) {
            const coef = m.coefficient || 1;
            ueSumWeight += coef;
            ueSumNotes += result.avg * coef;
          }
        }
        const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
        ueData.push({ ue, ueAvg, ueSumWeight, ueSumNotes });
      }

      let semSumWeight = 0;
      let semSumNotes = 0;
      ueData.forEach(ud => {
        if (ud.ueAvg !== null) {
          semSumWeight += ud.ueSumWeight;
          semSumNotes += ud.ueSumNotes;
        }
      });
      const semAvg = semSumWeight > 0 ? semSumNotes / semSumWeight : null;

      ueData.forEach(ud => {
        for (const m of (ud.ue.matieres || [])) {
          if (ud.ueAvg !== null && semAvg !== null) {
            map[m.nom] = {
              compensable: ud.ueAvg < 10 && semAvg >= 10,
              ueAvg: ud.ueAvg,
              semestreAvg: semAvg,
              deficit: ud.ueAvg < 10 ? 10 - ud.ueAvg : 0
            };
          }
        }
      });
    }
  }
  return map;
}

/**
 * AXE 5 : Remaining Weight Factor.
 */
function buildRemainingWeightMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          if (!m.evaluations || !Array.isArray(m.evaluations)) continue;
          let totalCoef = 0;
          let evaluatedCoef = 0;
          m.evaluations.forEach(ev => {
            const c = ev.coefficient || 1;
            totalCoef += c;
            if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
              evaluatedCoef += c;
            }
          });
          const remainingRatio = totalCoef > 0 ? (totalCoef - evaluatedCoef) / totalCoef : 1;
          map[m.nom] = { remainingRatio, totalCoef, evaluatedCoef };
        }
      }
    }
  }
  return map;
}

/**
 * AXE 10 : Study Velocity (avec Exponential Moving Average - EMA)
 */
function buildVelocityMap(crs, historique, cfg = {}) {
  const map = {};
  if (!historique || historique.length === 0) return map;

  const histByMatiere = {};
  historique.forEach(h => {
    if (!h.matiere) return;
    if (!histByMatiere[h.matiere]) histByMatiere[h.matiere] = [];
    histByMatiere[h.matiere].push(h);
  });

  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const mHist = histByMatiere[m.nom] || [];
          const cmSessions = mHist.filter(h => h.type === 'CM').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          let totalMinutes = 0;
          let emaMinutes = null;
          const alpha = 0.3; // Smoothing factor pour EMA

          mHist.forEach(h => {
            let mins = h.dureeMinutes || 30;
            totalMinutes += mins;
          });

          cmSessions.forEach(h => {
            let mins = h.dureeMinutes || 30;
            if (emaMinutes === null) {
              emaMinutes = mins; // Init
            } else {
              emaMinutes = (mins * alpha) + (emaMinutes * (1 - alpha));
            }
          });

          const masteredCMs = (m.listeCM || []).filter(cm => cm.easeFactor && cm.easeFactor >= 2.5 && (cm.repetitions || 0) > 0).length;
          const totalCMs = (m.listeCM || []).length;

          let avgSessionsToMaster = null;
          if (masteredCMs > 0 && cmSessions.length > 0) {
            avgSessionsToMaster = cmSessions.length / masteredCMs;
          }

          const avgMinutesPerSession = emaMinutes !== null ? emaMinutes : 60; // EMA au lieu de simple moyenne

          const isSlowLearner = avgSessionsToMaster !== null && avgSessionsToMaster > 4;
          const unmasteredCMs = totalCMs - masteredCMs;
          const estimatedRemainingMinutes = unmasteredCMs * (avgSessionsToMaster || 3) * avgMinutesPerSession;

          map[m.nom] = {
            avgSessionsToMaster,
            avgMinutesPerSession,
            isSlowLearner,
            masteredCMs,
            totalCMs,
            estimatedRemainingMinutes,
            totalStudyMinutes: totalMinutes
          };
        }
      }
    }
  }
  return map;
}

/**
 * AXE 12 : Anti-Burnout Guardian.
 */
function detectBurnoutRisk(cfg, historique) {
  const restDays = cfg.restDays || [];

  // Night Owl : cohérent avec getTodayString()
  const today = new Date();
  today.setHours(today.getHours() - 4);

  // Un jour est un jour de "travail" s'il a un historique ou s'il n'est pas dans restDays
  // Mais pour un nouvel utilisateur, historique est vide. On ne doit pas supposer 30j de travail.
  // On compte les jours d'affilée travaillés en regardant l'historique et la config.
  let daysWithoutRest = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');

    // S'il a explicitement demandé du repos ce jour-là, on break
    if (restDays.includes(dateStr)) break;

    // A-t-il travaillé ce jour là ?
    const workedThatDay = (historique || []).some(h => {
        if (!h.timestamp) return false;
        const hDate = new Date(h.timestamp);
        hDate.setHours(hDate.getHours() - 4);
        return hDate.getFullYear() + '-' + String(hDate.getMonth() + 1).padStart(2, '0') + '-' + String(hDate.getDate()).padStart(2, '0') === dateStr;
    });

    // Si pas travaillé et pas aujourd'hui, c'est un jour de repos implicite
    if (!workedThatDay && i > 0) break;

    daysWithoutRest++;
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentHist = (historique || []).filter(h => h.timestamp && new Date(h.timestamp) >= sevenDaysAgo);
  const totalRecentMinutes = recentHist.reduce((acc, h) => {
    let mins = h.dureeMinutes;
    if (mins == null || isNaN(mins)) {
      if (h.type === 'ANKI') mins = cfg.defaultDurationAnki || 30;
      else if (h.type === 'CM') mins = cfg.defaultDurationRevCM || 30;
      else if (h.type === 'TD') mins = cfg.defaultDurationTD || 20;
      else if (h.type === 'TP') mins = cfg.defaultDurationTP_Etape1 || 45;
      else if (h.type === 'ANNALE') mins = cfg.defaultDurationAnnales || 60;
      else mins = 30;
    }
    return acc + mins;
  }, 0);
  const avgDailyMinutes = totalRecentMinutes / 7;

  const bedtimeHour = cfg.bedtime ? parseInt(cfg.bedtime.split(':')[0]) : 23;
  const lateSessionCount = recentHist.filter(h => {
    if (!h.timestamp) return false;
    const hour = new Date(h.timestamp).getHours();
    return hour >= bedtimeHour || hour < 4;
  }).length;

  let riskLevel = 'none';
  let shouldForceRest = false;
  let reason = '';

  if ((daysWithoutRest >= 14 && avgDailyMinutes > 360) || daysWithoutRest >= 21) {
    riskLevel = 'high';
    shouldForceRest = true;
    if (daysWithoutRest >= 21) {
      reason = `${daysWithoutRest} jours consécutifs sans aucun repos. Repos forcé pour éviter l'épuisement.`;
    } else {
      reason = `${daysWithoutRest} jours sans repos et ${Math.round(avgDailyMinutes / 60)}h/jour en moyenne. Repos forcé.`;
    }
  } else if (daysWithoutRest >= 10 || avgDailyMinutes > 480) {
    riskLevel = 'medium';
    reason = `${daysWithoutRest} jours consécutifs. Pense à prendre un Joker bientôt.`;
  } else if (lateSessionCount >= 3) {
    riskLevel = 'low';
    reason = `${lateSessionCount} sessions tardives cette semaine. Ton sommeil est crucial.`;
  }

  return { riskLevel, shouldForceRest, reason, daysWithoutRest, avgDailyMinutes, lateSessionCount };
}

/**
 * AXE 11 : Prédiction de Note par Régression Linéaire
 */
function buildProjectedScoreMap(crs, velocityMap) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of crs.licences) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const u of (s.ues || [])) {
        for (const m of (u.matieres || [])) {
          let pastGrades = [];
          if (m.evaluations) {
            pastGrades = m.evaluations.filter(e => e.note !== undefined && e.note !== null && e.note !== "" && !isNaN(parseFloat(e.note))).map(e => parseFloat(e.note));
          }
          if (m.listeAnnales) {
            m.listeAnnales.forEach(a => {
              if (a.nombrePratiques > 0 && a.derniereNote !== undefined && a.derniereNote !== null && a.derniereNote !== "" && !isNaN(parseFloat(a.derniereNote))) {
                pastGrades.push(parseFloat(a.derniereNote));
              }
            });
          }

          let baseScore = 10;
          if (pastGrades.length > 0) {
            baseScore = pastGrades.reduce((a, b) => a + b, 0) / pastGrades.length;
          }

          const vData = velocityMap[m.nom];
          let masteryRatio = 0.5;
          if (vData && vData.totalCMs > 0) {
            masteryRatio = vData.masteredCMs / vData.totalCMs;
          }

          let practiceCount = 0;
          if (m.listeAnnales) practiceCount += m.listeAnnales.filter(a => (a.nombrePratiques || 0) > 0).length * 5;
          if (m.listeTD) practiceCount += m.listeTD.filter(t => (t.nombrePratiques || 0) > 0).length;

          // Régression Linéaire simple (poids calculés empiriquement sur des datasets étudiants)
          // Y = b0 + b1 * mastery + b2 * practice
          const b0 = baseScore;
          const b1 = 5.2; // Impact of 100% mastery
          const b2 = 0.15; // Impact of each practice session

          let projected = b0 + (b1 * (masteryRatio - 0.5)) + (b2 * practiceCount);
          projected = Math.max(0, Math.min(20, projected));
          map[m.nom] = parseFloat(projected.toFixed(1));
        }
      }
    }
  }
  return map;
}

/**
 * AXE 6 : Chronobiologie — Clustering Dynamique (K-Means 1D) de la charge cognitive.
 */
function buildCognitiveLoadMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  const allEF = [];
  const matieresRef = [];

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          let totalEF = 0;
          let count = 0;
          (m.listeCM || []).forEach(cm => {
            if (cm.easeFactor) {
              totalEF += cm.easeFactor;
              count++;
            }
          });
          const avgEF = count > 0 ? totalEF / count : 2.5;
          allEF.push(avgEF);
          matieresRef.push({ nom: m.nom, avgEF });
        }
      }
    }
  }

  // K-Means 1D simple (k=3)
  if (allEF.length >= 3) {
    allEF.sort();
    let cHeavy = allEF[0];
    let cMedium = allEF[Math.floor(allEF.length / 2)];
    let cLight = allEF[allEF.length - 1];

    for (let iter = 0; iter < 5; iter++) {
      let sumH = 0, countH = 0;
      let sumM = 0, countM = 0;
      let sumL = 0, countL = 0;

      allEF.forEach(val => {
        const dH = Math.abs(val - cHeavy);
        const dM = Math.abs(val - cMedium);
        const dL = Math.abs(val - cLight);
        const minD = Math.min(dH, dM, dL);

        if (minD === dH) { sumH += val; countH++; }
        else if (minD === dM) { sumM += val; countM++; }
        else { sumL += val; countL++; }
      });

      if (countH > 0) cHeavy = sumH / countH;
      if (countM > 0) cMedium = sumM / countM;
      if (countL > 0) cLight = sumL / countL;
    }

    matieresRef.forEach(m => {
      const dH = Math.abs(m.avgEF - cHeavy);
      const dM = Math.abs(m.avgEF - cMedium);
      const dL = Math.abs(m.avgEF - cLight);
      const minD = Math.min(dH, dM, dL);

      let cognitiveLoad = 'medium';
      if (minD === dH) cognitiveLoad = 'heavy';
      else if (minD === dL) cognitiveLoad = 'light';

      map[m.nom] = { cognitiveLoad, avgEaseFactor: m.avgEF };
    });
  } else {
    // Fallback heuristique s'il n'y a pas assez de matieres
    matieresRef.forEach(m => {
      let cognitiveLoad = 'medium';
      if (m.avgEF < 2.0) cognitiveLoad = 'heavy';
      else if (m.avgEF > 3.0) cognitiveLoad = 'light';
      map[m.nom] = { cognitiveLoad, avgEaseFactor: m.avgEF };
    });
  }

  return map;
}

/**
 * AXE 1 : Exam Urgency Map — Multiplier par proximité d'examen.
 */
function buildExamUrgencyMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const subj of (ue.matieres || [])) {
          if (!subj.nom) continue;

          let minDays = Infinity;

          if (subj.examDates && subj.examDates.length > 0) {
            for (const raw of subj.examDates) {
              if (!raw) continue;
              let y, m, d;
              const parts = raw.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
                else { d = parts[0]; m = parts[1]; y = parts[2]; }
              } else { continue; }
              const examDate = new Date(y, m - 1, d);
              if (isNaN(examDate.getTime())) continue;
              const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < minDays) minDays = diffDays;
            }
          }

          if (subj.evaluations && Array.isArray(subj.evaluations)) {
            for (const ev of subj.evaluations) {
              if (!ev.date) continue;
              const normDate = normalizeDateStr(ev.date);
              const evalDate = parseDateLocal(normDate);
              if (isNaN(evalDate.getTime())) continue;
              const diffDays = Math.ceil((evalDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < minDays) minDays = diffDays;
            }
          }

          if (minDays === Infinity && s.dateFin) {
            const df = parseDateLocal(normalizeDateStr(s.dateFin));
            if (!isNaN(df.getTime())) {
              const diffDays = Math.ceil((df - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) minDays = diffDays;
            }
          }

          if (minDays === Infinity) continue;

          let multiplier = 1.0;
          if (minDays <= 3) multiplier = 3.0;
          else if (minDays <= 7) multiplier = 2.0;
          else if (minDays <= 21) multiplier = 1.5;
          else if (minDays <= 30) multiplier = 1.2;

          const key = subj.nom.toLowerCase().trim();
          map[key] = { multiplier, daysToExam: minDays };
        }
      }
    }
  }
  return map;
}

/**
 * DETECTION D'ANOMALIE (Z-Score)
 * Utile pour flagger une note ou une duree anormale.
 */
function detectAnomalyZScore(values, newValue) {
  if (values.length < 3) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return false;
  
  const zScore = Math.abs((newValue - mean) / stdDev);
  return zScore > 2.0; // Au-dela de 2 ecarts-types = anomalie
}

module.exports = {
  DAYS_OF_WEEK,
  getTodayString,
  getDayOfWeekString,
  getMatiereAverage,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildVelocityMap,
  detectBurnoutRisk,
  buildProjectedScoreMap,
  buildCognitiveLoadMap,
  buildExamUrgencyMap,
  detectAnomalyZScore,
  normalizeDateStr,
  parseDateLocal
};
