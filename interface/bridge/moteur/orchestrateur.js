const { loadConfig } = require('./config');
const { loadCours } = require('./cours');

const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
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
            const parts = raw.split('-');
            if (parts.length !== 3) continue;
            const examDate = new Date(parts[2], parts[1] - 1, parts[0]);
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

function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date();

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
              const dureeBase = cfg.defaultDurationTP || 30;
              tempsDejaTravailleMin += tp.tempsMoyen ? tp.tempsMoyen : (dureeBase * getDifficultyMultiplier(tp.difficulte));
            }
          }
          for (const annale of (m.listeAnnales || [])) {
            if (annale.dernierePratique === todayStr) {
              const dureeBase = cfg.defaultDurationAnnales || 60;
              tempsDejaTravailleMin += annale.tempsMoyen ? annale.tempsMoyen : (dureeBase * getDifficultyMultiplier(annale.difficulte));
            }
          }
        }
      }
    }
  }

  tempsLibreMin -= tempsDejaTravailleMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  // Base de parité : date de début d'étude (fallback au 1er janvier)
  const studyStartRaw = cfg.studyStartDate ? cfg.studyStartDate.split('-').reverse().join('-') : null;
  const studyStart = studyStartRaw ? new Date(studyStartRaw + 'T00:00:00') : new Date(now.getFullYear(), 0, 1);
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

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

  // Pools de tâches
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];
  const poolAnnales = [];

  // 2. Scan courses and populate pools
  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      let matiereIndexDansSemestre = 0;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const examData = getSubjectExamBoost(m, examUrgencyMap);
          const examBoost = examData.boost;
          const daysToExam = examData.daysToExam;

          // --- CM logic ---
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            
            if (!cm.derniereRevision) {
              doitReviser = true;
              joursEnRetard = 999; // Priorité max si jamais révisé
            } else {
              const targetDateStr = cm.prochaineRevisionDate;
              if (targetDateStr) {
                const targetDate = new Date(targetDateStr + 'T00:00:00');
                const nowDate = new Date(todayStr + 'T00:00:00');
                const joursEcoules = Math.floor((nowDate - targetDate) / (1000 * 60 * 60 * 24));
                if (joursEcoules >= 0) {
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
              pdfSource: ex.pdfSource || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m.nom)
            });
          }

          // --- TP logic ---
          const tps = (m.listeTP || []).filter(ex => ex.dernierePratique !== todayStr);
          for (const ex of tps) {
            const dureeBase = cfg.defaultDurationTP || 30;
            const dureeEstimee = ex.tempsMoyen ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
            poolTP.push({
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              pdfSource: ex.pdfSource || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m.nom)
            });
          }

          // --- Annales logic ---
          if (daysToExam <= 28) {
            const annales = (m.listeAnnales || []).filter(ex => ex.dernierePratique !== todayStr);
            for (const ex of annales) {
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = ex.tempsMoyen ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              poolAnnales.push({
                matiere: m.nom,
                type: "ANNALE",
                titre: ex.titre,
                dureeMinutes: Math.round(dureeEstimee),
                pdfSource: ex.pdfSource || "",
                page: ex.page || 1,
                difficulte: ex.difficulte || "",
                prio: 9999
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
  let tempsPotentielTotal = poolAnnales.reduce((acc, t) => acc + t.dureeMinutes, 0) +
                            poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) + 
                            poolTD.reduce((acc, t) => acc + t.dureeMinutes, 0) + 
                            poolTP.reduce((acc, t) => acc + t.dureeMinutes, 0);

  const subjectAnnaleCount = {};
  const subjectTDCount = {};
  const subjectTPCount = {};

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
      if (!canAddMatiere(annale.matiere)) continue;
      const count = subjectAnnaleCount[annale.matiere] || 0;
      if (count < 1) { // 1 annale max par matière par jour
        taches.push(annale);
        tempsRequisMin += annale.dureeMinutes;
        subjectAnnaleCount[annale.matiere] = count + 1;
        selectedMatieres.add(annale.matiere);
      }
    }
  }

  // Ajouter CMs (Priorité absolue)
  for (const cm of poolCM) {
    if (tempsRequisMin + cm.dureeMinutes <= tempsLibreMin) {
      if (!canAddMatiere(cm.matiere)) continue;
      taches.push(cm);
      tempsRequisMin += cm.dureeMinutes;
      selectedMatieres.add(cm.matiere);
    }
  }

  // Ajouter TDs (Max 3 par matière pour éviter l'accaparement)
  for (const td of poolTD) {
    if (tempsRequisMin + td.dureeMinutes <= tempsLibreMin) {
      if (!canAddMatiere(td.matiere)) continue;
      const count = subjectTDCount[td.matiere] || 0;
      if (count < 3) {
        taches.push(td);
        tempsRequisMin += td.dureeMinutes;
        subjectTDCount[td.matiere] = count + 1;
        selectedMatieres.add(td.matiere);
      }
    }
  }

  // Ajouter TPs (Max 2 par matière)
  for (const tp of poolTP) {
    if (tempsRequisMin + tp.dureeMinutes <= tempsLibreMin) {
      if (!canAddMatiere(tp.matiere)) continue;
      const count = subjectTPCount[tp.matiere] || 0;
      if (count < 2) {
        taches.push(tp);
        tempsRequisMin += tp.dureeMinutes;
        subjectTPCount[tp.matiere] = count + 1;
        selectedMatieres.add(tp.matiere);
      }
    }
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
  // Surcharge signalée si le potentiel total dépassait le temps libre, 
  // mais la liste 'taches' a été coupée pour respecter tempsLibreMin !
  rapport.statut = (tempsPotentielTotal > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = { genererRapportQuotidien };
