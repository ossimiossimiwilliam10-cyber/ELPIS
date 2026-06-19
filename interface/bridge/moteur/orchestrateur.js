const { loadConfig } = require('./config');
const { loadCours } = require('./cours');

const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getTodayString() {
  const d = new Date();
  // Période de grâce (Night Owl) : 4h. Cohérent avec le frontend (store.js, Dashboard.jsx).
  d.setHours(d.getHours() - 4);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getDayOfWeekString() {
  return DAYS_OF_WEEK[new Date().getDay()];
}

// ============================================================
// INTELLIGENCE MODULE v2 — Fonctions d'analyse avancée
// ============================================================

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
 * Calcule pour chaque UE si sa moyenne actuelle est compensable
 * par les autres UEs du même semestre (moyenne semestre >= 10).
 */
function buildCompensationMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      const ueData = [];
      for (const ue of (s.ues || [])) {
        let ueSumWeight = 0;
        let ueSumNotes = 0;
        let hasAnyNote = false;
        for (const m of (ue.matieres || [])) {
          const result = getMatiereAverage(m);
          if (result) {
            const coef = m.coefficient || 1;
            ueSumWeight += coef;
            ueSumNotes += result.avg * coef;
            hasAnyNote = true;
          }
        }
        const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
        ueData.push({ ue, ueAvg, ueSumWeight, ueSumNotes, hasAnyNote });
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
          const ueAvg = ud.ueAvg;
          if (ueAvg !== null && semAvg !== null) {
            map[m.nom] = {
              compensable: ueAvg < 10 && semAvg >= 10,
              ueAvg,
              semestreAvg: semAvg,
              deficit: ueAvg < 10 ? 10 - ueAvg : 0
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
 * Pour chaque matière, calcule le ratio de coefficient restant à évaluer.
 */
function buildRemainingWeightMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
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
 * AXE 10 : Study Velocity.
 * Calcule la "vitesse d'apprentissage" par matière.
 */
function buildVelocityMap(crs, historique) {
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
    for (const s of (l.semestres || [])) {
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const mHist = histByMatiere[m.nom] || [];
          const cmSessions = mHist.filter(h => h.type === 'CM');
          const totalMinutes = mHist.reduce((acc, h) => acc + (h.dureeMinutes || 30), 0);
          const masteredCMs = (m.listeCM || []).filter(cm => cm.easeFactor && cm.easeFactor >= 2.5 && (cm.repetitions || 0) > 0).length;
          const totalCMs = (m.listeCM || []).length;

          let avgSessionsToMaster = null;
          if (masteredCMs > 0 && cmSessions.length > 0) {
            avgSessionsToMaster = cmSessions.length / masteredCMs;
          }

          const avgMinutesPerSession = cmSessions.length > 0
            ? totalMinutes / cmSessions.length
            : 60;

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
 * Analyse le streak, les jours de repos, et les patterns de session.
 */
function detectBurnoutRisk(cfg, historique) {
  const streak = cfg.currentStreak || 0;
  const restDays = cfg.restDays || [];

  const today = new Date();
  let daysWithoutRest = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    if (restDays.includes(dateStr)) break;
    daysWithoutRest++;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentHist = (historique || []).filter(h => h.timestamp && new Date(h.timestamp) >= sevenDaysAgo);
  const totalRecentMinutes = recentHist.reduce((acc, h) => acc + (h.dureeMinutes || 30), 0);
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

  if (daysWithoutRest >= 14 && avgDailyMinutes > 360) {
    riskLevel = 'high';
    shouldForceRest = true;
    reason = `${daysWithoutRest} jours sans repos et ${Math.round(avgDailyMinutes/60)}h/jour en moyenne. Repos forcé.`;
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
 * AXE 11 : Prédiction de Note (Score Projeté)
 * Estime la prochaine note en croisant historique, vélocité et maîtrise.
 */
function buildProjectedScoreMap(crs, velocityMap) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of crs.licences) {
    for (const s of (l.semestres || [])) {
      for (const u of (s.ues || [])) {
        for (const m of (u.matieres || [])) {
          let baseScore = 10;
          
          // 1. Analyse des notes passées dans la matière (AC/SC) et des Annales !
          let pastGrades = [];
          if (m.evaluations) {
             pastGrades = m.evaluations.filter(e => e.note !== undefined && e.note !== null && e.note !== "").map(e => parseFloat(e.note));
          }
          // Intégrer les notes obtenues aux Annales d'entraînement comme des évaluations réelles
          if (m.listeAnnales) {
             m.listeAnnales.forEach(a => {
                if (a.nombrePratiques > 0 && a.derniereNote !== undefined && a.derniereNote !== null) {
                   pastGrades.push(parseFloat(a.derniereNote));
                }
             });
          }

          if (pastGrades.length > 0) {
             baseScore = pastGrades.reduce((a, b) => a + b, 0) / pastGrades.length;
          }

          // 2. Modulateur de maîtrise (VelocityMap)
          const vData = velocityMap[m.nom];
          let masteryMod = 0;
          if (vData && vData.totalCMs > 0) {
             if (vData.totalStudyMinutes === 0) {
                // Sujet totalement vierge : ni bonus, ni malus
                masteryMod = 0;
             } else {
                const masteryRatio = vData.masteredCMs / vData.totalCMs;
                // Si > 80% maîtrisé, bonus +3. Si < 30%, malus -3.
                masteryMod = (masteryRatio - 0.5) * 6; 
             }
          }

          // 3. Modulateur de pratique (Annales / TD / TP)
          let practiceCount = 0;
          if (m.listeAnnales) practiceCount += m.listeAnnales.filter(a => (a.nombrePratiques || 0) > 0).length * 5; // L'effort brut donne un petit bonus fixe (+0.5 pt)
          if (m.listeTD) practiceCount += m.listeTD.filter(t => (t.nombrePratiques || 0) > 0).length; // 1 TD = +0.1 pt
          let practiceMod = Math.min(3, practiceCount * 0.1);

          let projected = baseScore + masteryMod + practiceMod;
          
          // Cap between 0 and 20
          projected = Math.max(0, Math.min(20, projected));
          
          map[m.nom] = parseFloat(projected.toFixed(1));
        }
      }
    }
  }
  return map;
}

/**
 * AXE 6 : Chronobiologie — Classifie les matières par difficulté cognitive.
 */
function buildCognitiveLoadMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
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
          let cognitiveLoad = 'medium';
          if (avgEF < 2.0) cognitiveLoad = 'heavy';
          else if (avgEF > 3.0) cognitiveLoad = 'light';

          map[m.nom] = { cognitiveLoad, avgEaseFactor: avgEF };
        }
      }
    }
  }
  return map;
}

/**
 * Build a map of subject name → urgency multiplier based on exam proximity.
 *  0-3 days  → 3.0x
 *  4-7 days  → 2.0x
 *  8-14 days → 1.5x
 * 15-30 days → 1.2x
 * >30 days  → 1.0x (no boost)
 */
function buildExamUrgencyMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      for (const ue of (s.ues || [])) {
        for (const subj of (ue.matieres || [])) {
          if (!subj.nom) continue;

          let minDays = Infinity;

          // Legacy: scan examDates array
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
              if (diffDays >= 0 && diffDays < minDays) {
                minDays = diffDays;
              }
            }
          }

          // AXE 1: Also scan individual evaluation dates (from BulletinPage)
          if (subj.evaluations && Array.isArray(subj.evaluations)) {
            for (const ev of subj.evaluations) {
              if (!ev.date) continue;
              // Evaluation dates are in YYYY-MM-DD format
              const evalDate = new Date(ev.date + 'T00:00:00');
              if (isNaN(evalDate.getTime())) continue;
              const diffDays = Math.ceil((evalDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < minDays) {
                minDays = diffDays;
              }
            }
          }

          if (minDays === Infinity) continue;

          let multiplier = 1.0;
          if (minDays <= 3) multiplier = 3.0;
          else if (minDays <= 7) multiplier = 2.0;
          else if (minDays <= 14) multiplier = 1.5;
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
 * Priority score for exercises: combines practice count + difficulty + exam urgency.
 * Higher score = more urgent.
 */
let velocityMapGlobal = null;

function getPrioScore(ex, examUrgencyMap, matiere, remainingWeightMap, compensationMap) {
  let base = 1.0 / Math.sqrt((ex.nombrePratiques || 0) + 1.0);
  if (ex.difficulte === 'difficile') base *= 1.5;
  else if (ex.difficulte === 'assez_difficile') base *= 1.2;
  else if (ex.difficulte === 'facile') base *= 0.8;
  else if (ex.difficulte === 'tres_facile') base *= 0.6;

  let matiereNom = matiere;
  if (typeof matiere === 'object' && matiere.nom) {
    matiereNom = matiere.nom;
  }

  // Exam urgency boost: match subject by fuzzy name
  if (examUrgencyMap && matiereNom) {
    const matiereKey = matiereNom.toLowerCase().trim();
    // Try exact match first, then partial
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
  if (typeof matiere === 'object') {
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

    // AXE 5: Remaining Weight Factor — boost subjects with lots of unevaluated coefficient
    if (remainingWeightMap && typeof matiere === 'object' && matiere.nom) {
      const rwData = remainingWeightMap[matiere.nom];
      if (rwData && rwData.remainingRatio > 0.5) {
        // More than 50% of the coefficient is still unevaluated → boost
        // The boost scales from 1.0 (50% remaining) to 1.5 (100% remaining)
        const rwBoost = 1.0 + (rwData.remainingRatio - 0.5) * 1.0;
        base *= rwBoost;
      }
    }

    // AXE 8: Compensation — reduce pressure if UE is compensable
    if (compensationMap && typeof matiere === 'object' && matiere.nom) {
      const compData = compensationMap[matiere.nom];
      if (compData && compData.compensable && compData.deficit < 2) {
        // UE is below 10 but compensated by others, and deficit is small
        base *= 0.7; // Reduce priority slightly
      }
    }
  }

  // AXE 13: Synergies Inter-Matières
  let synergyBoost = 1.0;
  if (matiere.synergies && velocityMapGlobal) {
    for (const syn of matiere.synergies) {
       const v = velocityMapGlobal[syn];
       if (v && v.totalCMs > 0) {
          const ratio = v.masteredCMs / v.totalCMs;
          if (ratio < 0.3) {
             synergyBoost += 0.2; // Synergy is weak -> boost this subject to compensate
          } else if (ratio > 0.8) {
             synergyBoost -= 0.1; // Synergy is strong -> slightly less pressure
          }
       }
    }
  }
  base *= synergyBoost;

  return base;
}

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
  
  // Bonus basique proportionnel au coeff pour prioriser les gros coeff
  return { boost: baseBoost * (1.0 + (coeff - 1) * 0.1), daysToExam };
}

function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0, fillGap = false) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date();
  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  // === INTELLIGENCE MODULE v2 : Charger l'historique et construire les maps ===
  let historique = [];
  try {
    const fs = require('fs');
    const path = require('path');
    const histPath = path.join(path.dirname(configPath), 'espoir_historique.json');
    if (fs.existsSync(histPath)) {
      historique = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    }
  } catch (e) {
    console.error("Erreur lecture historique:", e);
  }

  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique);
  velocityMapGlobal = velocityMap; // Store for getPrioScore
  const cognitiveLoadMap = buildCognitiveLoadMap(crs);
  const burnoutRisk = detectBurnoutRisk(cfg, historique);
  const projectedScoreMap = buildProjectedScoreMap(crs, velocityMap);

  // Stocker les insights dans le rapport pour l'UI
  rapport.intelligence = {
    compensationMap,
    remainingWeightMap,
    velocityMap,
    cognitiveLoadMap,
    burnoutRisk,
    projectedScoreMap
  };

  // --- AXE 12 : ANTI-BURNOUT — Forcer le repos si risque élevé ---
  if (burnoutRisk.shouldForceRest) {
    rapport.statut = "REPOS";
    rapport.tachesDuJour = [];
    rapport.tempsRequisMin = 0;
    rapport.tempsDispoMin = 0;
    rapport.message = `🛡️ Anti-Burnout activé : ${burnoutRisk.reason}`;
    return rapport;
  }

  // --- MODE REPOS ---
  if (cfg.restDays && cfg.restDays.includes(todayStr)) {
    rapport.statut = "REPOS";
    rapport.tachesDuJour = [];
    rapport.tempsRequisMin = 0;
    rapport.tempsDispoMin = 0;
    rapport.message = "Jour de repos imposé. Recharge tes batteries !";
    return rapport;
  }

  const examUrgencyMap = buildExamUrgencyMap(crs);

  /** Multiplier de difficulté pour une tâche donnée. */
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

  // 1. Calculate available time
  const heuresTravailJour = Math.max(1, cfg.maxStudyHoursPerDay || 8);
  const maxSubjectsPerDay = cfg.maxSubjectsPerDay || 4;
  let tempsLibreMin = heuresTravailJour * 60;

  const todayDayOfWeek = getDayOfWeekString();
  
  // Les engagements fixes ont été retirés pour prioriser ELPIS de façon absolue.
  
  if (tempsLibreMin < 0) tempsLibreMin = 0;
  
  // Ajout de l'énergie supplémentaire (Réallocation Dynamique)
  tempsLibreMin += extraTimeMin;
  
  rapport.tempsDispoMin = tempsLibreMin;

  // 2. Calculer le temps déjà travaillé aujourd'hui
  let tempsDejaTravailleMin = 0;
  if (cfg.dernierePratiqueAnki === todayStr) {
    tempsDejaTravailleMin += (cfg.defaultDurationAnki || 30);
  }

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          for (const cm of (m.listeCM || [])) {
            if (cm.derniereRevision === todayStr) {
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              tempsDejaTravailleMin += cm.tempsMoyen ? cm.tempsMoyen : dureeBase;
            }
          }
          for (const td of (m.listeTD || [])) {
            if (td.dernierePratique === todayStr) {
              const dureeBase = cfg.defaultDurationTD || 20;
              tempsDejaTravailleMin += td.tempsMoyen ? td.tempsMoyen : (dureeBase * getDifficultyMultiplier(td.difficulte));
            }
          }
          for (const tp of (m.listeTP || [])) {
            if (tp.dernierePratique === todayStr) {
              const stepIndex = Math.max(0, (tp.nombrePratiques || 1) - 1);
              const TP_STEP_DURATIONS = [
                cfg.defaultDurationTP_Etape1 || 45, 
                cfg.defaultDurationTP_Etape2 || 180, 
                cfg.defaultDurationTP_Etape3 || 90, 
                cfg.defaultDurationTP_Etape4 || 30
              ];
              const dureeBase = TP_STEP_DURATIONS[stepIndex] || 30;
              const avgForStep = (tp.tempsMoyenEtapes && tp.tempsMoyenEtapes[stepIndex]) ? tp.tempsMoyenEtapes[stepIndex] : (tp.tempsMoyen || null);
              tempsDejaTravailleMin += avgForStep ? avgForStep : (dureeBase * getDifficultyMultiplier(tp.difficulte));
            }
          }
          for (const ann of (m.listeAnnales || [])) {
            if (ann.dernierePratique === todayStr) {
              const dureeBase = cfg.defaultDurationAnnale || 60;
              tempsDejaTravailleMin += ann.tempsMoyen ? ann.tempsMoyen : (dureeBase * getDifficultyMultiplier(ann.difficulte));
            }
          }
        }
      }
    }
  }
  
  rapport.tempsDejaTravailleMin = tempsDejaTravailleMin;
  tempsLibreMin -= tempsDejaTravailleMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  // Base de parité : date de début d'étude (fallback au 1er janvier)
  const studyStartRaw = cfg.studyStartDate ? cfg.studyStartDate.split('-').reverse().join('-') : null;
  const studyStart = studyStartRaw ? new Date(studyStartRaw + 'T00:00:00') : new Date(now.getFullYear(), 0, 1);
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

  // Pools de tâches
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];
  const poolAnnales = [];

  // 2. Scan courses and populate pools
  const maxNewCMPerSubject = cfg.maxNewCMPerSubjectPerDay !== undefined ? cfg.maxNewCMPerSubjectPerDay : 1;
  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      let matiereIndexDansSemestre = 0;
      let newCMCountPerSemester = 0;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const examData = getSubjectExamBoost(m, examUrgencyMap);
          const examBoostOriginal = examData.boost;
          const daysToExam = examData.daysToExam;

          // --- Bouclier Anti-Décrochage ---
          let lastPratiqueMs = 0;
          const checkDate = (dStr) => {
            if (dStr) {
              const d = new Date(dStr + 'T00:00:00').getTime();
              if (d > lastPratiqueMs) lastPratiqueMs = d;
            }
          };
          (m.listeCM || []).forEach(x => checkDate(x.derniereRevision));
          (m.listeTD || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeTP || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeAnnales || []).forEach(x => checkDate(x.dernierePratique));
          
          let inactivityBoost = 1.0;
          if (lastPratiqueMs > 0) {
            const daysInactive = (now.getTime() - lastPratiqueMs) / (1000 * 60 * 60 * 24);
            if (daysInactive > 10) {
              inactivityBoost = 3.0; // Bouclier anti-décrochage
            }
          }
          
          const examBoost = examBoostOriginal * inactivityBoost;

          const baseRaisons = [];
          if (inactivityBoost > 1.0) baseRaisons.push("🛡️ Anti-Décrochage");
          if (examBoostOriginal > 1.0) baseRaisons.push("⏳ Examen Proche");

          // --- CM logic ---
          let newCMCountPerMatiere = 0;
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            if (!cm.derniereRevision) {
              // Limiter les nouveaux CM, sauf si on est en mode fillGap (où on autorise pour combler si y'a assez de temps)
              if (!fillGap && (newCMCountPerMatiere >= maxNewCMPerSubject || newCMCountPerSemester >= maxNewCMPerSemester)) {
                continue;
              }
              doitReviser = true;
              joursEnRetard = 999; // Priorité max si jamais révisé
              newCMCountPerMatiere++;
              newCMCountPerSemester++;
            } else {
              const targetDateStr = cm.prochaineRevisionDate;
              if (targetDateStr) {
                const targetDate = new Date(targetDateStr + 'T00:00:00');
                const nowDate = new Date(todayStr + 'T00:00:00');
                const joursEcoules = Math.floor((nowDate - targetDate) / (1000 * 60 * 60 * 24));
                // Si fillGap, on accepte les CM en avance jusqu'à 3 jours
                if (joursEcoules >= (fillGap ? -3 : 0)) {
                  doitReviser = true;
                  joursEnRetard = joursEcoules;
                }
              } else {
                const revDate = new Date(cm.derniereRevision + 'T00:00:00');
                const nowDate = new Date(todayStr + 'T00:00:00');
                if (isNaN(revDate.getTime())) {
                  doitReviser = true;
                  joursEnRetard = 999;
                } else {
                  const joursEcoules = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));
                  if (cm.jActuel > 0 && joursEcoules >= cm.jActuel) {
                    doitReviser = true;
                    joursEnRetard = joursEcoules - cm.jActuel;
                  } else if (cm.jActuel === 0 && joursEcoules > 0) {
                    doitReviser = true;
                    joursEnRetard = joursEcoules;
                  }
                }
              }
            }

            if (doitReviser) {
              // Score CM = retard plafonné * (boost examen)
              const retardPondere = Math.min(joursEnRetard, 10) * 0.5; // Plafonne à +5
              const prioCM = (1 + retardPondere) * examBoost;
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              const dureeEstimee = cm.tempsMoyen ? cm.tempsMoyen : dureeBase;

              poolCM.push({
                matiere: m.nom,
                type: "CM",
                titre: cm.titre,
                dureeMinutes: Math.round(dureeEstimee),
                fichePdfPath: cm.fichePdfPath || "",
                prio: prioCM
              });
            }
          }

          // --- Interleaving Intelligent (Parité dynamique) ---
          let activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);
          // Si l'examen est dans ≤ 7 jours (boost >= 2.0), on casse la parité
          if (examBoost >= 2.0) {
            activePourExercices = true;
          }
          matiereIndexDansSemestre++;

          if (!activePourExercices) continue;

          // --- TD logic ---
          const tds = (m.listeTD || []).filter(ex => ex.dernierePratique !== todayStr);
          for (const ex of tds) {
            const dureeBase = cfg.defaultDurationTD || 20;
            const dureeEstimee = ex.tempsMoyen ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
            poolTD.push({
              matiere: m.nom,
              type: "TD",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              pdfPath: ex.pdfPath || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap) * inactivityBoost
            });
          }

          // --- TP logic ---
          const tps = (m.listeTP || []).filter(ex => ex.dernierePratique !== todayStr || (ex.dateTP && ex.dateTP === tomorrowStr));
          for (const ex of tps) {
            const currentStep = ex.nombrePratiques || 0;
            if (currentStep >= 4) continue; // TP totalement terminé
            
            const isTomorrow = ex.dateTP && ex.dateTP === tomorrowStr;
            
            // Règles d'apparition
            if (!isTomorrow) {
              if (currentStep < 3 && !isWeekend) {
                // Étapes 1, 2, 3 sont exclusives au week-end
                continue;
              }
              if (currentStep === 3) {
                // L'étape 4 n'apparaît QUE la veille du TP
                continue;
              }
            }

            const TP_STEP_DURATIONS = [
              cfg.defaultDurationTP_Etape1 || 45, 
              cfg.defaultDurationTP_Etape2 || 180, 
              cfg.defaultDurationTP_Etape3 || 90, 
              cfg.defaultDurationTP_Etape4 || 30
            ];
            const dureeBase = TP_STEP_DURATIONS[currentStep] || 30;
            
            let avgForStep = null;
            if (ex.tempsMoyenEtapes && ex.tempsMoyenEtapes.length > currentStep && ex.tempsMoyenEtapes[currentStep]) {
              avgForStep = ex.tempsMoyenEtapes[currentStep];
            } else if (ex.tempsMoyen && !ex.tempsMoyenEtapes) {
              avgForStep = ex.tempsMoyen;
            }
            
            const dureeEstimee = avgForStep ? avgForStep : (dureeBase * getDifficultyMultiplier(ex.difficulte));
            
            let tpPrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap);
            if (isTomorrow) {
              tpPrio = 999; // Priorité absolue la veille
            } else if (isWeekend) {
              tpPrio += 500; // Priorité haute le week-end
            }

            poolTP.push({
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              tempsMoyen: avgForStep, // Passed specifically for the UI display
              pdfPath: ex.pdfPath || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: tpPrio * inactivityBoost,
              etape: currentStep + 1,
              raisons: [...baseRaisons]
            });
          }

          // --- Calcul de la complétion pour la matière ---
          const totalCM = m.listeCM?.length || 0;
          const cmRevises = (m.listeCM || []).filter(cm => cm.derniereRevision).length;
          const cmCompletion = totalCM > 0 ? (cmRevises / totalCM) : 1; // Si pas de CM, on considère 100%

          const totalTD = m.listeTD?.length || 0;
          const tdFaits = (m.listeTD || []).filter(td => td.dernierePratique).length;
          const tdCompletion = totalTD > 0 ? (tdFaits / totalTD) : 1; // Si pas de TD, on considère 100%
          const tpFaits = (m.listeTP || []).reduce((acc, tp) => acc + (tp.nombrePratiques || 0), 0);

          // --- Annales logic (Intelligent & Précoce) ---
          // Déclenchement si : Maîtrise (CM >= 70% et TD >= 50%), OU Urgence (Examen <= 14 jours), OU Précoce (>= 2 TD ou >= 1 TP faits)
          const isEarlyReady = tdFaits >= 2 || tpFaits >= 1;
          const isMastered = (cmCompletion >= 0.70 && tdCompletion >= 0.50) || isEarlyReady;
          const isUrgent = daysToExam <= 14;

          const annalesRaisons = [...baseRaisons];
          if (isUrgent) annalesRaisons.push("🚨 Examen Imminent");
          else if (isEarlyReady && !isMastered) annalesRaisons.push("🚀 Défi Précoce");
          else if (isMastered) annalesRaisons.push("🏆 Maîtrise Atteinte");

          if (isMastered || isUrgent) {
            const annales = (m.listeAnnales || []).filter(ex => ex.dernierePratique !== todayStr);
            for (const ex of annales) {
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = ex.tempsMoyen ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              
              // Calcul du prio score standard (qui prend en compte l'espacement et la difficulté)
              let basePrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap);
              // Multiplicateur : si très urgent -> x5.0, si juste maîtrisé -> x3.0
              const annaleBoost = isUrgent ? 5.0 : 3.0;

              poolAnnales.push({
                matiere: m.nom,
                type: "ANNALE",
                titre: ex.titre,
                dureeMinutes: Math.round(dureeEstimee),
                pdfPath: ex.pdfPath || "",
                page: ex.page || 1,
                difficulte: ex.difficulte || "",
                prio: basePrio * annaleBoost,
                raisons: annalesRaisons
              });
            }
          }
        }
      }
    }
  }

  // 3. Trier par priorité décroissante
  poolAnnales.sort((a, b) => b.prio - a.prio);
  poolCM.sort((a, b) => b.prio - a.prio);
  poolTD.sort((a, b) => b.prio - a.prio);
  poolTP.sort((a, b) => b.prio - a.prio);

  // AXE 14 : Corrélation CM -> TD (Preparation Boost)
  // Si des TD sont dans le pool, on s'assure que les CM de la même matière ont une priorité massive pour être faits AVANT le TD.
  for (const td of poolTD) {
    const cmForThis = poolCM.filter(c => c.matiere === td.matiere);
    for (const cm of cmForThis) {
      cm.prio *= 1.5; // Boost Preparation
      if (!cm.raisons.includes("🔗 Préparation TD")) {
        cm.raisons.unshift("🔗 Préparation TD");
      }
    }
  }
  poolCM.sort((a, b) => b.prio - a.prio); // Re-sort after boost

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;

  // --- AJOUT DE LA TÂCHE ABSOLUE ANKI ---
  // On l'ajoute EN PREMIER pour qu'elle consomme le temps libre avant les autres tâches
  if (cfg.dernierePratiqueAnki !== todayStr) {
    taches.push({
      matiere: "Routine",
      type: "ANKI",
      titre: "Révision Flashcards",
      dureeMinutes: cfg.defaultDurationAnki || 30,
      prio: 9999
    });
    tempsRequisMin += (cfg.defaultDurationAnki || 30);
  }

  const subjectAnnaleCount = {};
  const subjectTDCount = {};
  const subjectTPCount = {};
  const subjectCMCount = {};

  // PRÉ-SÉLECTION STRATÉGIQUE DES MATIÈRES
  const subjectMaxPrio = {};
  const allTasksForPrio = [...poolAnnales, ...poolCM, ...poolTD, ...poolTP];
  for (const t of allTasksForPrio) {
    if (!subjectMaxPrio[t.matiere] || t.prio > subjectMaxPrio[t.matiere]) {
      subjectMaxPrio[t.matiere] = t.prio;
    }
  }

  const sortedSubjects = Object.keys(subjectMaxPrio).sort((a, b) => subjectMaxPrio[b] - subjectMaxPrio[a]);
  const topSubjectsList = sortedSubjects.slice(0, maxSubjectsPerDay);
  const selectedMatieres = new Set(topSubjectsList);

  const canAddMatiere = (matiere) => selectedMatieres.has(matiere);


  // Ajouter Annales d'abord (Priorité super absolue)
  for (const annale of poolAnnales) {
    if (tempsRequisMin + annale.dureeMinutes <= tempsLibreMin) {
      if (!fillGap && !canAddMatiere(annale.matiere)) continue;
      const count = subjectAnnaleCount[annale.matiere] || 0;
      if (count < 1) { // 1 annale max par matière par jour
        taches.push(annale);
        tempsRequisMin += annale.dureeMinutes;
        subjectAnnaleCount[annale.matiere] = count + 1;
        selectedMatieres.add(annale.matiere);
      }
    }
  }

  // Fonction d'ajout standard (Mutualisée pour éviter la duplication de logique)
  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {
    for (const item of pool) {
      if (tempsRequisMin + item.dureeMinutes <= tempsLibreMin) {
        // Exception: Les CM (SuperMemo) ne doivent pas être bloqués par la limite de matières.
        // Sinon, la courbe de l'oubli est brisée.
        if (!fillGap && !canAddMatiere(item.matiere) && item.type !== 'CM') continue;
        
        const count = subjectCountMap ? (subjectCountMap[item.matiere] || 0) : 0;
        if (!limitPerSubject || count < limitPerSubject) {
          taches.push(item);
          tempsRequisMin += item.dureeMinutes;
          if (subjectCountMap) subjectCountMap[item.matiere] = count + 1;
          selectedMatieres.add(item.matiere);
        }
      }
    }
  };

  // Ordre d'ajout selon le mode
  if (fillGap) {
    // Mode comblement : On privilégie la pratique, et on force la rotation (1 TD/TP max par matière)
    appendFromPool(poolTD, subjectTDCount, 1);
    appendFromPool(poolTP, subjectTPCount, 1);
    appendFromPool(poolCM, subjectCMCount, 1);
  } else {
    // Mode normal : La théorie d'abord, puis la pratique
    appendFromPool(poolCM, null, null);
    appendFromPool(poolTD, subjectTDCount, 3);
    appendFromPool(poolTP, subjectTPCount, 1);
  }

  // 5. AXE 6 : Chronobiologie — Assigner les moments de la journée
  // Les matières à charge cognitive élevée (easeFactor bas) vont le matin,
  // les matières légères vont le soir.
  const heavyTasks = [];
  const mediumTasks = [];
  const lightTasks = [];

  for (const t of taches) {
    if (t.type === 'ANKI') {
      // Anki always goes first (morning)
      heavyTasks.unshift(t);
      continue;
    }
    const cogData = cognitiveLoadMap[t.matiere];
    if (cogData && cogData.cognitiveLoad === 'heavy') {
      heavyTasks.push(t);
    } else if (cogData && cogData.cognitiveLoad === 'light') {
      lightTasks.push(t);
    } else {
      mediumTasks.push(t);
    }
  }

  // Rebuild taches array: heavy first (morning), medium (afternoon), light (evening)
  taches.length = 0;
  taches.push(...heavyTasks, ...mediumTasks, ...lightTasks);

  let accumulatedTime = 0;
  for (const t of taches) {
    let percentBefore = accumulatedTime / (tempsRequisMin || 1);
    accumulatedTime += t.dureeMinutes;
    let percentAfter = accumulatedTime / (tempsRequisMin || 1);
    let midPercent = (percentBefore + percentAfter) / 2.0;
    
    if (midPercent <= 0.35) {
      t.moment = 'matin';
    } else if (midPercent <= 0.70) {
      t.moment = 'aprem';
    } else {
      t.moment = 'soir';
    }
  }

  rapport.tempsRequisMin = tempsRequisMin;
  rapport.tachesDuJour = taches;
  
  // Calcul du temps urgent réel (CMs en retard + Annales)
  // On ne compte plus les TDs et TPs car ils sont dans une piscine infinie
  const tempsUrgentTotal = poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) +
                           poolAnnales.reduce((acc, t) => acc + t.dureeMinutes, 0);

  // Surcharge signalée uniquement si le travail absolument obligatoire dépasse le temps dispo
  rapport.statut = (tempsUrgentTotal > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = { genererRapportQuotidien, buildExamUrgencyMap, getPrioScore, getSubjectExamBoost, getTodayString };
