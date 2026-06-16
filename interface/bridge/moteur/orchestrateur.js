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

function genererRapportQuotidien(configPath, coursPath) {
  const cfg = loadConfig(configPath);
  const crs = loadCours(coursPath);
  const rapport = {};

  // 0. Build exam urgency map from config subjects
  const examUrgencyMap = buildExamUrgencyMap(cfg.subjects);

  // 1. Calculate available time
  const heuresTravailJour = Math.max(1, cfg.maxStudyHoursPerDay || 8);
  let tempsLibreMin = heuresTravailJour * 60;

  // Subtract fixed commitments for today
  const todayDayOfWeek = getDayOfWeekString();
  for (const fc of (cfg.fixedCommitments || [])) {
    if (fc.dayOfWeek === todayDayOfWeek || fc.dayOfWeek === "Tous les jours") {
      if (fc.startTime && fc.endTime && fc.startTime.length >= 5 && fc.endTime.length >= 5) {
        try {
          const startH = parseInt(fc.startTime.substring(0, 2));
          const startM = parseInt(fc.startTime.substring(3, 5));
          const endH = parseInt(fc.endTime.substring(0, 2));
          const endM = parseInt(fc.endTime.substring(3, 5));
          const duration = (endH * 60 + endM) - (startH * 60 + startM);
          if (duration > 0) tempsLibreMin -= duration;
        } catch {}
      }
    }
  }
  if (tempsLibreMin < 0) tempsLibreMin = 0;
  rapport.tempsDispoMin = tempsLibreMin;

  const taches = [];
  let tempsRequisMin = 0;
  const todayStr = getTodayString();

  // 2. Scan courses for daily tasks
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1); // 1er janvier
  const parityJour = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) % 2;

  for (const l of (crs.licences || [])) {
    for (const s of (l.semestres || [])) {
      let matiereIndexDansSemestre = 0;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {

        // --- CM logic (J-method) ---
        for (const cm of (m.listeCM || [])) {
          let doitReviser = false;
          if (!cm.derniereRevision) {
            doitReviser = true;
          } else {
            const revDate = new Date(cm.derniereRevision + 'T00:00:00');
            const nowDate = new Date(todayStr + 'T00:00:00');
            // Corrupted date → force revision
            if (isNaN(revDate.getTime())) {
              doitReviser = true;
            } else {
              const joursEcoules = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));

              if (cm.jActuel > 0 && joursEcoules >= cm.jActuel) {
                doitReviser = true;
              } else if (cm.jActuel === 0 && joursEcoules > 0) {
                doitReviser = true;
              }
            }
          }

          if (doitReviser) {
            taches.push({
              matiere: m.nom,
              type: "CM",
              titre: cm.titre,
              dureeMinutes: (cm.jActuel === 0) ? 120 : 30,
              fichePdfPath: cm.fichePdfPath || ""
            });
            tempsRequisMin += (cm.jActuel === 0) ? 120 : 30;
          }
        }

        // Parity-based exercise activation (same as C++ logic)
        const activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);
        matiereIndexDansSemestre++;

        if (!activePourExercices) {
          continue; // Skip TD/TP for this subject today
        }

        // --- TD logic ---
        const tds = (m.listeTD || [])
          .filter(ex => ex.dernierePratique !== todayStr)
          .sort((a, b) => {
            const pa = getPrioScore(a, examUrgencyMap, m.nom), pb = getPrioScore(b, examUrgencyMap, m.nom);
            if (Math.abs(pa - pb) > 0.0001) return pb - pa; // descending priority
            return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
          });

        const doneTDToday = (m.listeTD || []).filter(ex => ex.dernierePratique === todayStr).length;
        const tdLimit = Math.max(0, 2 - doneTDToday);
        let tdCount = 0;
        for (const ex of tds) {
          if (tdCount >= tdLimit) break;
          taches.push({
            matiere: m.nom,
            type: "TD",
            titre: ex.titre,
            dureeMinutes: 20,
            pdfSource: ex.pdfSource || "",
            page: ex.page || 1,
            difficulte: ex.difficulte || ""
          });
          tempsRequisMin += 20;
          tdCount++;
        }

        // --- TP logic ---
        const tps = (m.listeTP || [])
          .filter(ex => ex.dernierePratique !== todayStr)
          .sort((a, b) => {
            const pa = getPrioScore(a, examUrgencyMap, m.nom), pb = getPrioScore(b, examUrgencyMap, m.nom);
            if (Math.abs(pa - pb) > 0.0001) return pb - pa;
            return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
          });

        const doneTPToday = (m.listeTP || []).filter(ex => ex.dernierePratique === todayStr).length;
        const tpLimit = Math.max(0, 1 - doneTPToday);
        let tpCount = 0;
        for (const ex of tps) {
          if (tpCount >= tpLimit) break;
          taches.push({
            matiere: m.nom,
            type: "TP",
            titre: ex.titre,
            dureeMinutes: 30,
            pdfSource: ex.pdfSource || "",
            page: ex.page || 1,
            difficulte: ex.difficulte || ""
          });
          tempsRequisMin += 30;
          tpCount++;
        }
      }
    }
  }
  }

  rapport.tempsRequisMin = tempsRequisMin;
  rapport.tachesDuJour = taches;
  rapport.statut = (tempsRequisMin > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

module.exports = { genererRapportQuotidien };
