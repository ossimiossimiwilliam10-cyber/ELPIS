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
function buildExamUrgencyMap(subjects) {
  const map = {};
  if (!subjects || !Array.isArray(subjects)) return map;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const subj of subjects) {
    if (!subj.name || !subj.examDates || subj.examDates.length === 0) continue;

    // Find the nearest upcoming exam date (format DD-MM-YYYY)
    let minDays = Infinity;
    for (const raw of subj.examDates) {
      if (!raw) continue;
      // Parse DD-MM-YYYY
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

    // Use lowercase key for fuzzy matching
    const key = subj.name.toLowerCase().trim();
    map[key] = multiplier;
  }
  return map;
}

/**
 * Priority score for exercises: combines practice count + difficulty + exam urgency.
 * Higher score = more urgent.
 */
function getPrioScore(ex, examUrgencyMap, matiereNom) {
  let base = 1.0 / ((ex.nombrePratiques || 0) + 1.0);
  if (ex.difficulte === 'difficile') base *= 2.0;
  else if (ex.difficulte === 'assez_difficile') base *= 1.5;
  else if (ex.difficulte === 'facile') base *= 0.7;
  else if (ex.difficulte === 'tres_facile') base *= 0.5;

  // Exam urgency boost: match subject by fuzzy name
  if (examUrgencyMap && matiereNom) {
    const matiereKey = matiereNom.toLowerCase().trim();
    // Try exact match first, then partial (subject name contained in matiere name or vice versa)
    let boost = examUrgencyMap[matiereKey];
    if (boost === undefined) {
      for (const [subjKey, mult] of Object.entries(examUrgencyMap)) {
        if (matiereKey.includes(subjKey) || subjKey.includes(matiereKey)) {
          boost = mult;
          break;
        }
      }
    }
    if (boost) base *= boost;
  }

  return base;
}

function getSubjectExamBoost(matiere, examUrgencyMap) {
  if (!matiere || !matiere.nom) return 1.0;
  
  const coeff = matiere.coefficient || 1.0;
  const matiereKey = matiere.nom.toLowerCase().trim();
  
  let baseBoost = 1.0;
  if (examUrgencyMap[matiereKey] !== undefined) {
    baseBoost = examUrgencyMap[matiereKey];
  } else {
    for (const [subjKey, mult] of Object.entries(examUrgencyMap)) {
      if (matiereKey.includes(subjKey) || subjKey.includes(matiereKey)) {
        baseBoost = mult;
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
  return baseBoost * (1.0 + (coeff - 1) * 0.1);
}

function genererRapportQuotidien(configPath, coursPath, extraTimeMin = 0) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  const examUrgencyMap = buildExamUrgencyMap(cfg.subjects);

  // 1. Calculate available time
  const heuresTravailJour = Math.max(1, cfg.maxStudyHoursPerDay || 8);
  let tempsLibreMin = heuresTravailJour * 60;

  const todayDayOfWeek = getDayOfWeekString();
  
  // Les engagements fixes ont été retirés pour prioriser ELPIS de façon absolue.
  
  if (tempsLibreMin < 0) tempsLibreMin = 0;
  
  // Ajout de l'énergie supplémentaire (Réallocation Dynamique)
  tempsLibreMin += extraTimeMin;
  
  rapport.tempsDispoMin = tempsLibreMin;

  const todayStr = getTodayString();
  const now = new Date();
  // Base de parité : date de début d'étude (fallback au 1er janvier)
  const studyStartRaw = cfg.studyStartDate ? cfg.studyStartDate.split('-').reverse().join('-') : null;
  const studyStart = studyStartRaw ? new Date(studyStartRaw + 'T00:00:00') : new Date(now.getFullYear(), 0, 1);
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

  // Pools de tâches
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];

  // 2. Scan courses and populate pools
  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      let matiereIndexDansSemestre = 0;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const examBoost = getSubjectExamBoost(m, examUrgencyMap);

          // --- CM logic ---
          for (const cm of (m.listeCM || [])) {
            let doitReviser = false;
            let joursEnRetard = 0;
            
            if (!cm.derniereRevision) {
              doitReviser = true;
              joursEnRetard = 999; // Priorité max si jamais révisé
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

            if (doitReviser) {
              // Score CM = (retard) * (boost examen)
              const prioCM = (joursEnRetard + 1) * examBoost;
              poolCM.push({
                matiere: m.nom,
                type: "CM",
                titre: cm.titre,
                dureeMinutes: (cm.jActuel === 0) ? 120 : 30,
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
            poolTD.push({
              matiere: m.nom,
              type: "TD",
              titre: ex.titre,
              dureeMinutes: 20,
              pdfSource: ex.pdfSource || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m.nom)
            });
          }

          // --- TP logic ---
          const tps = (m.listeTP || []).filter(ex => ex.dernierePratique !== todayStr);
          for (const ex of tps) {
            poolTP.push({
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: 30,
              pdfSource: ex.pdfSource || "",
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: getPrioScore(ex, examUrgencyMap, m.nom)
            });
          }
        }
      }
    }
  }

  // 3. Trier par priorité décroissante
  poolCM.sort((a, b) => b.prio - a.prio);
  poolTD.sort((a, b) => b.prio - a.prio);
  poolTP.sort((a, b) => b.prio - a.prio);

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;
  let tempsPotentielTotal = poolCM.reduce((acc, t) => acc + t.dureeMinutes, 0) + 
                            poolTD.reduce((acc, t) => acc + t.dureeMinutes, 0) + 
                            poolTP.reduce((acc, t) => acc + t.dureeMinutes, 0);

  const subjectTDCount = {};
  const subjectTPCount = {};

  // Ajouter CMs d'abord (Priorité absolue)
  for (const cm of poolCM) {
    if (tempsRequisMin + cm.dureeMinutes <= tempsLibreMin) {
      taches.push(cm);
      tempsRequisMin += cm.dureeMinutes;
    }
  }

  // Ajouter TDs (Max 3 par matière pour éviter l'accaparement)
  for (const td of poolTD) {
    if (tempsRequisMin + td.dureeMinutes <= tempsLibreMin) {
      const count = subjectTDCount[td.matiere] || 0;
      if (count < 3) {
        taches.push(td);
        tempsRequisMin += td.dureeMinutes;
        subjectTDCount[td.matiere] = count + 1;
      }
    }
  }

  // Ajouter TPs (Max 2 par matière)
  for (const tp of poolTP) {
    if (tempsRequisMin + tp.dureeMinutes <= tempsLibreMin) {
      const count = subjectTPCount[tp.matiere] || 0;
      if (count < 2) {
        taches.push(tp);
        tempsRequisMin += tp.dureeMinutes;
        subjectTPCount[tp.matiere] = count + 1;
      }
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
