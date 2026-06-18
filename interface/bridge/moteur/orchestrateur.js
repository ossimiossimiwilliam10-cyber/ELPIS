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
          if (!subj.nom || !subj.examDates || subj.examDates.length === 0) continue;

          let minDays = Infinity;
          for (const raw of subj.examDates) {
            if (!raw) continue;
            let y, m, d;
            const parts = raw.split('-');
            if (parts.length === 3) {
              if (parts[0].length === 4) { // YYYY-MM-DD
                y = parts[0]; m = parts[1]; d = parts[2];
              } else { // DD-MM-YYYY
                d = parts[0]; m = parts[1]; y = parts[2];
              }
            } else {
              continue;
            }
            const examDate = new Date(y, m - 1, d);
            if (isNaN(examDate.getTime())) continue;
            const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < minDays) {
              minDays = diffDays;
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
function getPrioScore(ex, examUrgencyMap, matiereNom) {
  let base = 1.0 / Math.sqrt((ex.nombrePratiques || 0) + 1.0);
  if (ex.difficulte === 'difficile') base *= 1.5;
  else if (ex.difficulte === 'assez_difficile') base *= 1.2;
  else if (ex.difficulte === 'facile') base *= 0.8;
  else if (ex.difficulte === 'tres_facile') base *= 0.6;

  // Exam urgency boost: match subject by fuzzy name
  if (examUrgencyMap && matiereNom) {
    const matiereKey = matiereNom.toLowerCase().trim();
    // Try exact match first, then partial (subject name contained in matiere name or vice versa)
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
              prio: getPrioScore(ex, examUrgencyMap, m.nom) * inactivityBoost
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
            
            let tpPrio = getPrioScore(ex, examUrgencyMap, m.nom);
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
              let basePrio = getPrioScore(ex, examUrgencyMap, m.nom);
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

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;

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

  // --- AJOUT DE LA TÂCHE ABSOLUE ANKI ---
  if (cfg.dernierePratiqueAnki !== todayStr) {
    taches.unshift({
      matiere: "Routine",
      type: "ANKI",
      titre: "Révision Flashcards",
      dureeMinutes: cfg.defaultDurationAnki || 30,
      prio: 9999
    });
    tempsRequisMin += (cfg.defaultDurationAnki || 30);
  }

  // 5. Assigner les "Moments de la journée"
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
