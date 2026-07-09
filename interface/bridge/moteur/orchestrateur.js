/**
 * ORCHESTRATEUR v3 — Générateur de rapport quotidien (Scheduler).
 * Importe l'intelligence (maps d'analyse) et le scoring (priorités).
 * Orchestre le tout pour produire le planning du jour.
 *
 * v3 ajoute :
 *   - Carte de projection détaillée (intervalles de confiance, tendances, anomalies)
 *   - Carte de synergie inter-matières par chevauchement de concepts
 *   - Détection du chronotype pour l'ordonnancement horaire
 *   - Prévision de charge de travail sur 7 jours
 */

const fs = require('fs');
const path = require('path');

const MAGIC_CONSTANTS = {
  PRIO_MAX_ANKI: 9999,
  PRIO_MAX_RETARD: 999,
  PRIO_WEEKEND_TP: 500,
  BOOST_CRISE_NOTE: 2.0,
  BOOST_PREP_TD: 1.5,
  BOOST_ANNALE_URGENT: 5.0,
  BOOST_ANNALE_NORMAL: 3.0,
  BOOST_INACTIVITE_MAX: 3.0,
};
const { loadConfig } = require('./config');
const { loadCours } = require('./cours');
const {
  getTodayString,
  getDayOfWeekString,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildVelocityMap,
  detectBurnoutRisk,
  buildProjectedScoreMap,
  buildProjectedScoreDetailMap,
  buildCognitiveLoadMap,
  buildExamUrgencyMap,
  buildTimeOptimizationMap,
  buildSynergyMap,
  buildWorkloadForecast
} = require('./intelligence');
const { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost } = require('./scoring');

const { normalizeDateStr, parseDateLocal } = require('./utils');

function buildTaskPools({
  crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
  compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday, fillGap, now, parityJour
}) {
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];
  const poolAnnales = [];

  const maxNewCMPerSubject = cfg.maxNewCMPerSubjectPerDay !== undefined ? cfg.maxNewCMPerSubjectPerDay : 1;
  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (s.archived) continue;
      if (s.dateFin) {
        const df = parseDateLocal(normalizeDateStr(s.dateFin));
        if (df && df < now) continue;
      }
      let matiereIndexDansSemestre = 0;
      let newCMCountPerSemester = 0;
      for (const ue of (s.ues || [])) {
        const ueMatiereNames = (ue.matieres || []).map(m => m.nom).filter(Boolean);
        for (const m of (ue.matieres || [])) {
          m._ueMatieres = ueMatiereNames;
          const examData = getSubjectExamBoost(m, examUrgencyMap);
          const examBoostOriginal = examData.boost;
          const daysToExam = examData.daysToExam;

          // Bouclier Anti-Décrochage
          let lastPratiqueMs = 0;
          const checkDate = (dStr) => {
            const norm = normalizeDateStr(dStr);
            if (norm) {
              const d = parseDateLocal(norm).getTime();
              if (d > lastPratiqueMs) lastPratiqueMs = d;
            }
          };
          (m.listeCM || []).forEach(x => checkDate(x.derniereRevision));
          (m.listeTD || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeTP || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeAnnales || []).forEach(x => checkDate(x.dernierePratique));

          let discoveryBoost = 1.0;
          let inactivityBoost = 1.0;
          if (lastPratiqueMs > 0) {
            const daysInactive = (now.getTime() - lastPratiqueMs) / (1000 * 60 * 60 * 24);
            if (daysInactive > 7) {
              inactivityBoost = Math.min(MAGIC_CONSTANTS.BOOST_INACTIVITE_MAX, 1.0 + (daysInactive - 7) / 7);
            }
          } else {
            // BOOST DE DÉCOUVERTE : la matière n'a jamais été pratiquée.
            discoveryBoost = 2.0;
          }

          let crisisBoost = 1.0;
          if (projectedScoreMap && projectedScoreMap[m.nom] !== undefined && projectedScoreMap[m.nom] < 5.0) {
            crisisBoost = MAGIC_CONSTANTS.BOOST_CRISE_NOTE;
          }

          const examBoost = examBoostOriginal * inactivityBoost * crisisBoost;
          const baseRaisons = [];
          if (discoveryBoost > 1.0) baseRaisons.push("DECOUVERTE");
          if (inactivityBoost > 1.0) baseRaisons.push("REPRISE_EN_MAIN");
          if (crisisBoost > 1.0) baseRaisons.push("URGENCE_NOTE");

          if (daysToExam < 60) baseRaisons.push("EXAMEN_PROCHE");
          else if (examBoostOriginal > 1.0) baseRaisons.push("COEF_ELEVE");

          // --- CM ---
          let newCMCountPerMatiere = 0;
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            if (!cm.derniereRevision) {
              if (matieresSatureesToday.has(m.nom)) continue;
              if (!fillGap && (newCMCountPerMatiere >= maxNewCMPerSubject)) continue;
              doitReviser = true;
              joursEnRetard = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
              newCMCountPerMatiere++;
            } else {
              const targetDateStr = normalizeDateStr(cm.prochaineRevisionDate);
              if (targetDateStr) {
                const targetDate = parseDateLocal(targetDateStr);
                const nowDate = parseDateLocal(todayStr);
                const joursEcoules = Math.floor((nowDate - targetDate) / (1000 * 60 * 60 * 24));
                if (joursEcoules >= (fillGap ? -3 : 0)) {
                  doitReviser = true;
                  joursEnRetard = joursEcoules;
                }
              } else {
                const normRev = normalizeDateStr(cm.derniereRevision);
                const revDate = parseDateLocal(normRev);
                const nowDate = parseDateLocal(todayStr);
                if (isNaN(revDate.getTime())) {
                  doitReviser = true;
                  joursEnRetard = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
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
              const retardPondere = Math.min(joursEnRetard, 10) * 0.5;
              const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
              const rotateBonus = ((dayOfYear + matiereIndexDansSemestre) % 11) * 0.001;
              const prioCM = (1 + retardPondere) * examBoost * discoveryBoost + rotateBonus;
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              const dureeEstimee = (cm.tempsMoyen != null && cm.tempsMoyen > 0) ? cm.tempsMoyen : dureeBase;

              poolCM.push({
                matiere: m.nom,
                type: "CM",
                titre: cm.titre,
                dureeMinutes: Math.round(dureeEstimee),
                fichePdfPath: cm.fichePdfPath || "",
                prio: prioCM,
                isNew: !cm.derniereRevision,
                raisons: [...baseRaisons]
              });
            }
          }

          // Interleaving Intelligent (Parité dynamique)
          let activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);
          if (examBoost >= 2.0) activePourExercices = true;
          matiereIndexDansSemestre++;

          if (!activePourExercices) continue;

          // --- TD ---
          for (const ex of (m.listeTD || []).filter(e => e.dernierePratique !== todayStr)) {
            if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue;
            const dureeBase = cfg.defaultDurationTD || 20;
            const dureeEstimee = (ex.tempsMoyen != null && ex.tempsMoyen > 0) ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
            poolTD.push({
              matiere: m.nom,
              type: "TD",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              pdfPath: ex.pdfPath || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail) * inactivityBoost * discoveryBoost,
              raisons: [...baseRaisons]
            });
          }

          // --- TP ---
          for (const ex of (m.listeTP || []).filter(e => {
            if (e.dernierePratique === todayStr) {
              if (!e.dateTP) return false;
              return normalizeDateStr(e.dateTP) === tomorrowStr;
            }
            return true;
          })) {
            if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue;
            const currentStep = ex.nombrePratiques || 0;
            if (currentStep >= 4) continue;

            const isTomorrow = ex.dateTP && normalizeDateStr(ex.dateTP) === tomorrowStr;
            if (!isTomorrow) {
              if (currentStep < 3 && !isWeekend) continue;
              if (currentStep === 3) continue;
            }

            const TP_STEP_DURATIONS = [
              cfg.defaultDurationTP_Etape1 || 45,
              cfg.defaultDurationTP_Etape2 || 180,
              cfg.defaultDurationTP_Etape3 || 90,
              cfg.defaultDurationTP_Etape4 || 30
            ];
            const dureeBase = TP_STEP_DURATIONS[currentStep] || 30;
            let avgForStep = null;
            if (ex.tempsMoyenEtapes && ex.tempsMoyenEtapes.length > currentStep && ex.tempsMoyenEtapes[currentStep] != null && ex.tempsMoyenEtapes[currentStep] > 0) {
              avgForStep = ex.tempsMoyenEtapes[currentStep];
            } else if (ex.tempsMoyen != null && ex.tempsMoyen > 0 && !ex.tempsMoyenEtapes) {
              avgForStep = ex.tempsMoyen;
            }
            const dureeEstimee = (avgForStep != null && avgForStep > 0) ? avgForStep : (dureeBase * getDifficultyMultiplier(ex.difficulte));

            let tpPrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail);
            if (isTomorrow) tpPrio = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
            else if (isWeekend) tpPrio += MAGIC_CONSTANTS.PRIO_WEEKEND_TP;

            poolTP.push({
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              tempsMoyen: avgForStep,
              pdfPath: ex.pdfPath || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: tpPrio * inactivityBoost * discoveryBoost,
              etape: currentStep + 1,
              raisons: [...baseRaisons]
            });
          }

          // --- Annales ---
          const totalCM = m.listeCM?.length || 0;
          const cmRevises = (m.listeCM || []).filter(cm => cm.derniereRevision).length;
          const cmCompletion = totalCM > 0 ? (cmRevises / totalCM) : 1;

          const totalTD = m.listeTD?.length || 0;
          const tdFaits = (m.listeTD || []).filter(td => td.dernierePratique).length;
          const tdCompletion = totalTD > 0 ? (tdFaits / totalTD) : 1;
          const tpFaits = (m.listeTP || []).reduce((acc, tp) => acc + (tp.nombrePratiques || 0), 0);

          const isEarlyReady = tdFaits >= 2 || tpFaits >= 1;
          const isMastered = (cmCompletion >= 0.70 && tdCompletion >= 0.50) || isEarlyReady;
          const isUrgent = daysToExam <= 21;
          const hasStartedAnnales = (m.listeAnnales || []).some(a => (a.nombrePratiques || 0) > 0 || a.dernierePratique);

          const annalesRaisons = [...baseRaisons];
          if (isUrgent) annalesRaisons.push("EXAMEN_IMMINENT");
          else if (isEarlyReady && !isMastered) annalesRaisons.push("DEFI_PRECOCE");
          else if (isMastered) annalesRaisons.push("MAITRISE_ATTEINTE");

          if (isMastered || isUrgent || hasStartedAnnales) {
            for (const ex of (m.listeAnnales || []).filter(e => e.dernierePratique !== todayStr)) {
              if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue;
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = (ex.tempsMoyen != null && ex.tempsMoyen > 0) ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              let basePrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail);
              const annaleBoost = isUrgent ? MAGIC_CONSTANTS.BOOST_ANNALE_URGENT : MAGIC_CONSTANTS.BOOST_ANNALE_NORMAL;

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
  return { poolCM, poolTD, poolTP, poolAnnales };
}

/**
 * Fonction principale (sans persistance).
 * Retourne le rapport d'orchestration
 */
function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0, fillGap = false, ankiStats = null) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

  const tomorrowDate = new Date(now);
  tomorrowDate.setHours(tomorrowDate.getHours() - 4);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  let historique = [];
  try {
    const histPath = path.join(path.dirname(configPath), 'espoir_historique.json');
    if (fs.existsSync(histPath)) {
      historique = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    }
  } catch (e) {
    console.error("Erreur lecture historique:", e);
  }

  // --- Cartes d'intelligence v3 ---
  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique, cfg);
  const cognitiveLoadMap = buildCognitiveLoadMap(crs);
  const burnoutRisk = detectBurnoutRisk(cfg, historique);
  const projectedScoreMap = buildProjectedScoreMap(crs, velocityMap, ankiStats);
  const projectedScoreDetail = buildProjectedScoreDetailMap(crs, velocityMap, ankiStats);
  const timeOptimizationMap = buildTimeOptimizationMap(historique, cfg);
  const synergyMap = buildSynergyMap(crs);
  const workloadForecast = buildWorkloadForecast(historique, cfg);

  rapport.intelligence = {
    compensationMap,
    remainingWeightMap,
    velocityMap,
    cognitiveLoadMap,
    burnoutRisk,
    projectedScoreMap,
    projectedScoreDetail,
    timeOptimizationMap,
    synergyMap,
    workloadForecast
  };

  // Anti-Burnout
  if (burnoutRisk.shouldForceRest) {
    rapport.statut = "REPOS";
    rapport.tachesDuJour = [];
    rapport.tempsRequisMin = 0;
    rapport.tempsDispoMin = 0;
    rapport.message = `🛡️ Anti-Burnout activé : ${burnoutRisk.reason}`;
    return rapport;
  }

  // Mode repos
  if (cfg.restDays && cfg.restDays.includes(todayStr)) {
    rapport.statut = "REPOS";
    rapport.tachesDuJour = [];
    rapport.tempsRequisMin = 0;
    rapport.tempsDispoMin = 0;
    rapport.message = "Jour de repos imposé. Recharge tes batteries !";
    return rapport;
  }

  const examUrgencyMap = buildExamUrgencyMap(crs);

  // 1. Calculate available time
  const heuresTravailJour = Math.max(1, cfg.maxStudyHoursPerDay || 8);
  const maxSubjectsPerDay = cfg.maxSubjectsPerDay || 4;
  let tempsLibreMin = heuresTravailJour * 60;

  const todayName = getDayOfWeekString();
  let fixedCommitmentsMin = 0;
  let matieresSatureesToday = new Set();
  if (Array.isArray(cfg.fixedCommitments)) {
    cfg.fixedCommitments.forEach(c => {
      if (c.day === todayName || c.day === 'Tous les jours') {
        if (c.matiereLinked) {
          matieresSatureesToday.add(c.matiereLinked);
        }
        if (c.start && c.end) {
          const [h1, m1] = c.start.split(':').map(Number);
          const [h2, m2] = c.end.split(':').map(Number);
          if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
            let startMin = h1 * 60 + m1;
            let endMin = h2 * 60 + m2;
            if (endMin >= startMin) {
              fixedCommitmentsMin += (endMin - startMin);
            } else {
              fixedCommitmentsMin += (24 * 60 - startMin) + endMin;
            }
          }
        }
      }
    });
  }

  tempsLibreMin -= fixedCommitmentsMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  tempsLibreMin += extraTimeMin;
  rapport.tempsDispoMin = tempsLibreMin;
  rapport.fixedCommitmentsMin = fixedCommitmentsMin;

  // 2. Temps déjà travaillé aujourd'hui
  let tempsDejaTravailleMin = 0;
  if (historique && Array.isArray(historique)) {
    const todayEntries = historique.filter(h => {
      if (!h.timestamp) return false;
      const d = new Date(h.timestamp);
      d.setHours(d.getHours() - 4);
      const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return dStr === todayStr;
    });

    tempsDejaTravailleMin = todayEntries.reduce((sum, h) => {
      let mins = h.dureeMinutes;
      if (mins == null || isNaN(mins)) {
        if (h.type === 'ANKI') mins = cfg.defaultDurationAnki || 30;
        else if (h.type === 'CM') mins = cfg.defaultDurationRevCM || 30;
        else if (h.type === 'TD') mins = cfg.defaultDurationTD || 20;
        else if (h.type === 'TP') mins = cfg.defaultDurationTP_Etape1 || 45;
        else if (h.type === 'ANNALE') mins = cfg.defaultDurationAnnales || 60;
        else mins = 30;
      }
      return sum + mins;
    }, 0);
  }

  rapport.tempsDejaTravailleMin = tempsDejaTravailleMin;
  tempsLibreMin -= tempsDejaTravailleMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  // Base de parité
  const studyStartStr = normalizeDateStr(cfg.studyStartDate);
  const studyStart = parseDateLocal(studyStartStr);
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

  const { poolCM, poolTD, poolTP, poolAnnales } = buildTaskPools({
    crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday, fillGap, now, parityJour
  });

  // 3. Tri par priorité décroissante
  poolAnnales.sort((a, b) => b.prio - a.prio);
  poolCM.sort((a, b) => b.prio - a.prio);
  poolTD.sort((a, b) => b.prio - a.prio);
  poolTP.sort((a, b) => b.prio - a.prio);

  // AXE 14 : Corrélation CM -> TD (Preparation Boost)
  for (const td of poolTD) {
    for (const cm of poolCM.filter(c => c.matiere === td.matiere)) {
      cm.prio *= MAGIC_CONSTANTS.BOOST_PREP_TD;
      if (!cm.raisons.includes("PREPA_TD")) {
        cm.raisons.unshift("PREPA_TD");
      }
    }
  }
  poolCM.sort((a, b) => b.prio - a.prio);

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;

  if (!cfg.dernierePratiqueAnki || cfg.dernierePratiqueAnki !== todayStr) {
    taches.push({
      matiere: "Routine",
      type: "ANKI",
      titre: "Révision Flashcards",
      dureeMinutes: cfg.defaultDurationAnki || 30,
      prio: MAGIC_CONSTANTS.PRIO_MAX_ANKI
    });
    tempsRequisMin += (cfg.defaultDurationAnki || 30);
  }

  const subjectAnnaleCount = {};
  const subjectTDCount = {};
  const subjectTPCount = {};
  const subjectCMCount = {};

  const subjectMaxPrio = {};
  for (const t of [...poolAnnales, ...poolCM, ...poolTD, ...poolTP]) {
    if (!subjectMaxPrio[t.matiere] || t.prio > subjectMaxPrio[t.matiere]) {
      subjectMaxPrio[t.matiere] = t.prio;
    }
  }

  const sortedSubjects = Object.keys(subjectMaxPrio).sort((a, b) => subjectMaxPrio[b] - subjectMaxPrio[a]);
  const topSubjectsList = sortedSubjects.slice(0, maxSubjectsPerDay);
  const selectedMatieres = new Set(topSubjectsList);
  const canAddMatiere = (matiere) => selectedMatieres.has(matiere);

  // Ajouter Annales d'abord
  for (const annale of poolAnnales) {
    if (tempsRequisMin + annale.dureeMinutes <= tempsLibreMin) {
      if (!fillGap && !canAddMatiere(annale.matiere)) continue;
      const count = subjectAnnaleCount[annale.matiere] || 0;
      if (count < 1) {
        taches.push(annale);
        tempsRequisMin += annale.dureeMinutes;
        subjectAnnaleCount[annale.matiere] = count + 1;
        selectedMatieres.add(annale.matiere);
      }
    }
  }

  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;
  let newCMAdded = 0;
  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {
    for (const item of pool) {
      if (item.isNew && !fillGap && newCMAdded >= maxNewCMPerSemester) continue;
      if (tempsRequisMin + item.dureeMinutes <= tempsLibreMin) {
        if (!fillGap && !canAddMatiere(item.matiere)) continue;
        const count = subjectCountMap ? (subjectCountMap[item.matiere] || 0) : 0;
        if (!limitPerSubject || count < limitPerSubject) {
          taches.push(item);
          tempsRequisMin += item.dureeMinutes;
          if (subjectCountMap) subjectCountMap[item.matiere] = count + 1;
          selectedMatieres.add(item.matiere);
          if (item.isNew) newCMAdded++;
        }
      }
    }
  };

  if (fillGap) {
    appendFromPool(poolTD, subjectTDCount, 1);
    appendFromPool(poolTP, subjectTPCount, 1);
    appendFromPool(poolCM, subjectCMCount, 1);
  } else {
    appendFromPool(poolCM, null, null);
    appendFromPool(poolTD, subjectTDCount, 3);
    appendFromPool(poolTP, subjectTPCount, 1);
  }

  // --- 5. Chronobiologie v3 : Ordonnancement par charge cognitive + chronotype ---
  const heavyTasks = [];
  const mediumTasks = [];
  const lightTasks = [];

  for (const t of taches) {
    if (t.type === 'ANKI') {
      heavyTasks.unshift(t);
      continue;
    }
    const cogData = cognitiveLoadMap[t.matiere];
    if (cogData && cogData.cognitiveLoad === 'heavy') heavyTasks.push(t);
    else if (cogData && cogData.cognitiveLoad === 'light') lightTasks.push(t);
    else mediumTasks.push(t);
  }

  taches.length = 0;

  // Ordonnancement sensible au chronotype
  const chrono = timeOptimizationMap;
  const currentHour = new Date().getHours();
  const heavyWindow = chrono.optimalWindows.heavy;
  const mediumWindow = chrono.optimalWindows.medium;

  // Si on est dans la fenêtre "heavy" (ex: 8h-12h), on priorise les tâches lourdes
  const inHeavyWindow = currentHour >= heavyWindow.start && currentHour < heavyWindow.end;
  const inMediumWindow = currentHour >= mediumWindow.start && currentHour < mediumWindow.end;

  if (inHeavyWindow) {
    taches.push(...heavyTasks, ...mediumTasks, ...lightTasks);
  } else if (inMediumWindow) {
    taches.push(...mediumTasks, ...heavyTasks, ...lightTasks);
  } else {
    // Soir ou matin très tôt : tâches légères d'abord
    taches.push(...lightTasks, ...mediumTasks, ...heavyTasks);
  }

  // Assignation des moments (rétrocompatible avec l'heure courante)
  let accumulatedTime = 0;
  for (const t of taches) {
    let percentBefore = accumulatedTime / (tempsRequisMin || 1);
    accumulatedTime += t.dureeMinutes;
    let percentAfter = accumulatedTime / (tempsRequisMin || 1);
    let midPercent = (percentBefore + percentAfter) / 2.0;

    // Seuils adaptés à l'heure et au chronotype
    if (currentHour < 12) {
      if (midPercent <= 0.35) t.moment = 'matin';
      else if (midPercent <= 0.70) t.moment = 'aprem';
      else t.moment = 'soir';
    } else if (currentHour < 18) {
      if (midPercent <= 0.50) t.moment = 'aprem';
      else t.moment = 'soir';
    } else {
      t.moment = 'soir';
    }

    // Tagguer les synergies détectées
    if (synergyMap[t.matiere] && synergyMap[t.matiere].length > 0) {
      t.synergies = synergyMap[t.matiere].slice(0, 3);
    }
  }

  rapport.tempsRequisMin = tempsRequisMin;
  rapport.tachesDuJour = taches;

  const tempsUrgentTotal = poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) +
                           poolAnnales.reduce((acc, t) => acc + t.dureeMinutes, 0);

  rapport.statut = (tempsUrgentTotal > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = {
  genererRapportQuotidien,
  genererTacheSpecifique
};

/**
 * Génère UNE seule tâche spécifique selon les critères demandés par l'utilisateur (matière, type).
 */
function genererTacheSpecifique(configPath, coursPath, options) {
  const { matiere = 'all', type = 'all', dureeMin = 30 } = options;
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);

  const todayStr = getTodayString();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const tomorrowDate = new Date(now);
  tomorrowDate.setHours(tomorrowDate.getHours() - 4);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  let historique = [];
  try {
    const histPath = path.join(path.dirname(configPath), 'espoir_historique.json');
    if (fs.existsSync(histPath)) {
      historique = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    }
  } catch (e) {}

  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique, cfg);
  const examUrgencyMap = buildExamUrgencyMap(crs);
  const projectedScoreDetail = buildProjectedScoreDetailMap(crs, velocityMap);

  const projectedScoreMap = {};
  for (const [key, val] of Object.entries(projectedScoreDetail)) {
    projectedScoreMap[key] = val.projected;
  }

  const candidates = [];

  if (type === 'all' || type === 'ANKI') {
    // Si l'utilisateur force ANKI, on l'autorise même s'il l'a déjà fait aujourd'hui
    const alreadyDone = (cfg.dernierePratiqueAnki === todayStr);
    if (!alreadyDone || type === 'ANKI') {
      candidates.push({
        matiere: "Routine",
        type: "ANKI",
        titre: "Révision Flashcards",
        dureeMinutes: cfg.defaultDurationAnki || 30,
        prio: type === 'ANKI' ? 9999 : MAGIC_CONSTANTS.PRIO_MAX_ANKI,
        raisons: [alreadyDone ? "ESPACEE_GLOBALE_BONUS" : "ESPACEE_GLOBALE"]
      });
    }
  }

  const { poolCM, poolTD, poolTP, poolAnnales } = buildTaskPools({
    crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday: new Set(), fillGap: false, now, parityJour: 0
  });

  const allPools = [...poolCM, ...poolTD, ...poolTP, ...poolAnnales];
  for (const task of allPools) {
    if (matiere !== 'all' && task.matiere !== matiere) continue;
    if (type !== 'all' && task.type !== type) continue;
    candidates.push(task);
  }

  if (candidates.length === 0) return null;

  if (dureeMin > 0 && type !== 'ANKI') {
    candidates.forEach(c => {
      const diff = Math.abs(c.dureeMinutes - dureeMin);
      if (diff > 15) {
         c.prio -= (diff - 15) * 0.5;
      }
    });
  }

  candidates.sort((a, b) => b.prio - a.prio);

  const bestTask = candidates[0];
  bestTask.moment = 'sur-mesure';
  return bestTask;
}