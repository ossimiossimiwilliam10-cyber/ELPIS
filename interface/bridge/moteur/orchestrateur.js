/**
 * ORCHESTRATEUR — Générateur de rapport quotidien (Scheduler).
 * Importe l'intelligence (maps d'analyse) et le scoring (priorités).
 * Orchestre le tout pour produire le planning du jour.
 */

const fs = require('fs');
const path = require('path');
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
  buildCognitiveLoadMap,
  buildExamUrgencyMap
} = require('./intelligence');
const { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost } = require('./scoring');

function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0, fillGap = false) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date();

  const tomorrowDate = new Date();
  tomorrowDate.setHours(tomorrowDate.getHours() - 4); // aligner avec la période de grâce (Night Owl)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  // Charger l'historique
  let historique = [];
  try {
    const histPath = path.join(path.dirname(configPath), 'espoir_historique.json');
    if (fs.existsSync(histPath)) {
      historique = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    }
  } catch (e) {
    console.error("Erreur lecture historique:", e);
  }

  // Construire les maps d'intelligence
  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique);
  const cognitiveLoadMap = buildCognitiveLoadMap(crs);
  const burnoutRisk = detectBurnoutRisk(cfg, historique);
  const projectedScoreMap = buildProjectedScoreMap(crs, velocityMap);

  rapport.intelligence = {
    compensationMap,
    remainingWeightMap,
    velocityMap,
    cognitiveLoadMap,
    burnoutRisk,
    projectedScoreMap
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

  // Base de parité
  const studyStartRaw = cfg.studyStartDate ? cfg.studyStartDate.split('-').reverse().join('-') : null;
  const studyStart = studyStartRaw ? new Date(studyStartRaw + 'T00:00:00') : new Date(now.getFullYear(), 0, 1);
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

  // Pools
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];
  const poolAnnales = [];

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

          // Bouclier Anti-Décrochage
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
            // Progression linéaire : neutre avant J7, puis montée graduelle jusqu'à 3.0 à J21
            if (daysInactive > 7) {
              inactivityBoost = Math.min(3.0, 1.0 + (daysInactive - 7) / 7);
            }
          }

          let crisisBoost = 1.0;
          if (projectedScoreMap && projectedScoreMap[m.nom] !== undefined && projectedScoreMap[m.nom] < 5.0) {
            crisisBoost = 2.0;
          }

          const examBoost = examBoostOriginal * inactivityBoost * crisisBoost;
          const baseRaisons = [];
          if (inactivityBoost > 1.0) baseRaisons.push("🛡️ Anti-Décrochage");
          if (crisisBoost > 1.0) baseRaisons.push("🚨 MODE CRISE (< 5/20)");
          
          if (daysToExam < 60) baseRaisons.push("⏳ Examen Proche");
          else if (examBoostOriginal > 1.0) baseRaisons.push("🔥 Fort Coeff");

          // --- CM ---
          let newCMCountPerMatiere = 0;
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            if (!cm.derniereRevision) {
              if (!fillGap && (newCMCountPerMatiere >= maxNewCMPerSubject || newCMCountPerSemester >= maxNewCMPerSemester)) continue;
              doitReviser = true;
              joursEnRetard = 999;
              newCMCountPerMatiere++;
              newCMCountPerSemester++;
            } else {
              const targetDateStr = cm.prochaineRevisionDate;
              if (targetDateStr) {
                const targetDate = new Date(targetDateStr + 'T00:00:00');
                const nowDate = new Date(todayStr + 'T00:00:00');
                const joursEcoules = Math.floor((nowDate - targetDate) / (1000 * 60 * 60 * 24));
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
              const retardPondere = Math.min(joursEnRetard, 10) * 0.5;
              const prioCM = (1 + retardPondere) * examBoost;
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              const dureeEstimee = cm.tempsMoyen ? cm.tempsMoyen : dureeBase;

              poolCM.push({
                matiere: m.nom,
                type: "CM",
                titre: cm.titre,
                dureeMinutes: Math.round(dureeEstimee),
                fichePdfPath: cm.fichePdfPath || "",
                prio: prioCM,
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
              prio: getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap) * inactivityBoost,
              raisons: [...baseRaisons]
            });
          }

          // --- TP ---
          for (const ex of (m.listeTP || []).filter(e => e.dernierePratique !== todayStr || (e.dateTP && e.dateTP === tomorrowStr))) {
            const currentStep = ex.nombrePratiques || 0;
            if (currentStep >= 4) continue;

            const isTomorrow = ex.dateTP && ex.dateTP === tomorrowStr;
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
            if (ex.tempsMoyenEtapes && ex.tempsMoyenEtapes.length > currentStep && ex.tempsMoyenEtapes[currentStep]) {
              avgForStep = ex.tempsMoyenEtapes[currentStep];
            } else if (ex.tempsMoyen && !ex.tempsMoyenEtapes) {
              avgForStep = ex.tempsMoyen;
            }
            const dureeEstimee = avgForStep ? avgForStep : (dureeBase * getDifficultyMultiplier(ex.difficulte));

            let tpPrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap);
            if (isTomorrow) tpPrio = 999;
            else if (isWeekend) tpPrio += 500;

            poolTP.push({
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              tempsMoyen: avgForStep,
              pdfPath: ex.pdfPath || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: tpPrio * inactivityBoost,
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
          const isUrgent = daysToExam <= 14;

          const annalesRaisons = [...baseRaisons];
          if (isUrgent) annalesRaisons.push("🚨 Examen Imminent");
          else if (isEarlyReady && !isMastered) annalesRaisons.push("🚀 Défi Précoce");
          else if (isMastered) annalesRaisons.push("🏆 Maîtrise Atteinte");

          if (isMastered || isUrgent) {
            for (const ex of (m.listeAnnales || []).filter(e => e.dernierePratique !== todayStr)) {
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = ex.tempsMoyen ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              let basePrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap);
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

  // 3. Tri par priorité décroissante
  poolAnnales.sort((a, b) => b.prio - a.prio);
  poolCM.sort((a, b) => b.prio - a.prio);
  poolTD.sort((a, b) => b.prio - a.prio);
  poolTP.sort((a, b) => b.prio - a.prio);

  // AXE 14 : Corrélation CM -> TD (Preparation Boost)
  for (const td of poolTD) {
    for (const cm of poolCM.filter(c => c.matiere === td.matiere)) {
      cm.prio *= 1.5;
      if (!cm.raisons.includes("🔗 Préparation TD")) {
        cm.raisons.unshift("🔗 Préparation TD");
      }
    }
  }
  poolCM.sort((a, b) => b.prio - a.prio);

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;

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

  // Pré-sélection stratégique des matières
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

  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {
    for (const item of pool) {
      if (tempsRequisMin + item.dureeMinutes <= tempsLibreMin) {
        if (!fillGap && !canAddMatiere(item.matiere)) continue;
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

  if (fillGap) {
    appendFromPool(poolTD, subjectTDCount, 1);
    appendFromPool(poolTP, subjectTPCount, 1);
    appendFromPool(poolCM, subjectCMCount, 1);
  } else {
    appendFromPool(poolCM, null, null);
    appendFromPool(poolTD, subjectTDCount, 3);
    appendFromPool(poolTP, subjectTPCount, 1);
  }

  // 5. Chronobiologie
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
  taches.push(...heavyTasks, ...mediumTasks, ...lightTasks);

  let accumulatedTime = 0;
  for (const t of taches) {
    let percentBefore = accumulatedTime / (tempsRequisMin || 1);
    accumulatedTime += t.dureeMinutes;
    let percentAfter = accumulatedTime / (tempsRequisMin || 1);
    let midPercent = (percentBefore + percentAfter) / 2.0;

    if (midPercent <= 0.35) t.moment = 'matin';
    else if (midPercent <= 0.70) t.moment = 'aprem';
    else t.moment = 'soir';
  }

  rapport.tempsRequisMin = tempsRequisMin;
  rapport.tachesDuJour = taches;

  const tempsUrgentTotal = poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) +
                           poolAnnales.reduce((acc, t) => acc + t.dureeMinutes, 0);

  rapport.statut = (tempsUrgentTotal > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = { genererRapportQuotidien };
