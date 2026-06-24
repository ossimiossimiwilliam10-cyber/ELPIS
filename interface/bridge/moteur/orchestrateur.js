/**
 * ORCHESTRATEUR — Générateur de rapport quotidien (Scheduler).
 * Importe l'intelligence (maps d'analyse) et le scoring (priorités).
 * Orchestre le tout pour produire le planning du jour.
 */

const fs = require('fs');
const path = require('path');

const MAGIC_CONSTANTS = {
  // Poids des priorités
  PRIO_MAX_ANKI: 9999,           // La routine Anki passe avant tout
  PRIO_MAX_RETARD: 999,          // Utilisé pour un retard infini ou un TP dû demain
  PRIO_WEEKEND_TP: 500,          // Boost massif pour inciter à faire les TP le week-end
  
  // Multiplicateurs d'urgence et de synergie
  BOOST_CRISE_NOTE: 2.0,         // Multiplicateur d'urgence si la note projetée est < 5/20
  BOOST_PREP_TD: 1.5,            // Multiplicateur pour un CM qui prépare un TD à venir
  BOOST_ANNALE_URGENT: 5.0,      // Multiplicateur pour une annale si l'examen est < 14 jours
  BOOST_ANNALE_NORMAL: 3.0,      // Multiplicateur de base pour débloquer une annale
  
  // Poids Anti-Décrochage
  BOOST_INACTIVITE_MAX: 3.0,     // Le boost d'inactivité plafonne à x3 (atteint à J+21)
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
  buildCognitiveLoadMap,
  buildExamUrgencyMap
} = require('./intelligence');
const { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost } = require('./scoring');

/**
 * Normalise une date string (DD-MM-YYYY ou YYYY-MM-DD) vers le format YYYY-MM-DD.
 */
function normalizeDateStr(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
}

function parseDateLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
  const legacyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (legacyMatch) return new Date(+legacyMatch[3], +legacyMatch[2] - 1, +legacyMatch[1]);
  return new Date(NaN);
}

function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0, fillGap = false) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

  const tomorrowDate = new Date(now);
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
  const velocityMap = buildVelocityMap(crs, historique, cfg);
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

  // Calculer les engagements fixes du jour
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

  // 2. Calculer le temps déjà travaillé aujourd'hui depuis l'historique
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
        // Fallback for older entries missing dureeMinutes
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
        // Peupler _ueMatieres pour la détection de synergies inter-matières
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

          let inactivityBoost = 1.0;
          if (lastPratiqueMs > 0) {
            const daysInactive = (now.getTime() - lastPratiqueMs) / (1000 * 60 * 60 * 24);
            // Progression linéaire : neutre avant J7, puis montée graduelle jusqu'à MAGIC_CONSTANTS.BOOST_INACTIVITE_MAX à J21
            if (daysInactive > 7) {
              inactivityBoost = Math.min(MAGIC_CONSTANTS.BOOST_INACTIVITE_MAX, 1.0 + (daysInactive - 7) / 7);
            }
          }

          let crisisBoost = 1.0;
          if (projectedScoreMap && projectedScoreMap[m.nom] !== undefined && projectedScoreMap[m.nom] < 5.0) {
            crisisBoost = MAGIC_CONSTANTS.BOOST_CRISE_NOTE;
          }

          const examBoost = examBoostOriginal * inactivityBoost * crisisBoost;
          const baseRaisons = [];
          if (inactivityBoost > 1.0) baseRaisons.push("🛡️ Reprise en main");
          if (crisisBoost > 1.0) baseRaisons.push("🚨 Urgence (Note < 5)");
          
          if (daysToExam < 60) baseRaisons.push("⏳ Examen Proche");
          else if (examBoostOriginal > 1.0) baseRaisons.push("🔥 Coefficient Élevé");

          // --- CM ---
          let newCMCountPerMatiere = 0;
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            if (!cm.derniereRevision) {
              if (matieresSatureesToday.has(m.nom)) continue; // Malus cognitif
              if (!fillGap && (newCMCountPerMatiere >= maxNewCMPerSubject || newCMCountPerSemester >= maxNewCMPerSemester)) continue;
              doitReviser = true;
              joursEnRetard = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
              newCMCountPerMatiere++;
              newCMCountPerSemester++;
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
              const prioCM = (1 + retardPondere) * examBoost;
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              const dureeEstimee = (cm.tempsMoyen != null && cm.tempsMoyen > 0) ? cm.tempsMoyen : dureeBase;

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
            if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue; // Malus cognitif
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
              prio: getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap) * inactivityBoost,
              raisons: [...baseRaisons]
            });
          }

          // --- TP ---
          for (const ex of (m.listeTP || []).filter(e => {
            if (e.dernierePratique === todayStr) {
              // Déjà pratiqué aujourd'hui, ne garder que s'il est dû demain
              if (!e.dateTP) return false;
              return normalizeDateStr(e.dateTP) === tomorrowStr;
            }
            return true;
          })) {
            if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue; // Malus cognitif
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

            let tpPrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap);
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
          const isUrgent = daysToExam <= 21; // Modifié de 14 à 21 jours
          const hasStartedAnnales = (m.listeAnnales || []).some(a => (a.nombrePratiques || 0) > 0 || a.dernierePratique);

          const annalesRaisons = [...baseRaisons];
          if (isUrgent) annalesRaisons.push("🚨 Examen Imminent");
          else if (isEarlyReady && !isMastered) annalesRaisons.push("🚀 Défi Précoce");
          else if (isMastered) annalesRaisons.push("🏆 Maîtrise Atteinte");

          // Si une annale a été commencée un jour, elle n'est plus jamais verrouillée
          if (isMastered || isUrgent || hasStartedAnnales) {
            for (const ex of (m.listeAnnales || []).filter(e => e.dernierePratique !== todayStr)) {
              if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue; // Malus cognitif
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = (ex.tempsMoyen != null && ex.tempsMoyen > 0) ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              let basePrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap);
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

  // 3. Tri par priorité décroissante
  poolAnnales.sort((a, b) => b.prio - a.prio);
  poolCM.sort((a, b) => b.prio - a.prio);
  poolTD.sort((a, b) => b.prio - a.prio);
  poolTP.sort((a, b) => b.prio - a.prio);

  // AXE 14 : Corrélation CM -> TD (Preparation Boost)
  for (const td of poolTD) {
    for (const cm of poolCM.filter(c => c.matiere === td.matiere)) {
      cm.prio *= MAGIC_CONSTANTS.BOOST_PREP_TD;
      if (!cm.raisons.includes("🔗 Pour préparer le TD")) {
        cm.raisons.unshift("🔗 Pour préparer le TD");
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

  const currentHour = new Date().getHours();
  let accumulatedTime = 0;
  for (const t of taches) {
    let percentBefore = accumulatedTime / (tempsRequisMin || 1);
    accumulatedTime += t.dureeMinutes;
    let percentAfter = accumulatedTime / (tempsRequisMin || 1);
    let midPercent = (percentBefore + percentAfter) / 2.0;

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
  }

  rapport.tempsRequisMin = tempsRequisMin;
  rapport.tachesDuJour = taches;

  const tempsUrgentTotal = poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) +
                           poolAnnales.reduce((acc, t) => acc + t.dureeMinutes, 0);

  rapport.statut = (tempsUrgentTotal > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = { genererRapportQuotidien };
