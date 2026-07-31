const { parseDateLocal, normalizeDateStr } = require('./utils');
const { getCapitalisedUEs } = require('./scoring');
const { loadConfig } = require('./config');

/**
 * Calcule une simulation déterministe (Forward-Scheduling) sur 52 semaines.
 * Remplit une grille horaire en plaçant les tâches restantes.
 * 
 * @param {Object} crs L'objet cours (cours.json)
 * @returns {Array} Un tableau de 52 objets représentant chaque semaine avec ses créneaux
 */
function genererSimulationAnnuelle(crs) {
  const cfg = loadConfig();
  const weeks = [];
  const now = new Date();
  // On commence demain pour éviter les conflits avec la journée en cours
  const startSimulationDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  
  // 1. Extraire toutes les tâches en attente
  let pendingTasks = [];
  
  if (crs && crs.licences) {
    for (const l of crs.licences) {
      if (l.archived) continue;
      const capitalisedUEs = getCapitalisedUEs(l);

      for (const s of (l.semestres || [])) {
        if (s.archived) continue;
        for (const ue of (s.ues || [])) {
          if (capitalisedUEs.has(ue.nom)) continue;
          for (const m of (ue.matieres || [])) {
            if (m.dispense) continue;
            
            const coeff = m.coefficient || 1;
            
            // Map des examens pour la matière
            const examDates = [];
            if (m.evaluations) {
              for (const ev of m.evaluations) {
                if (ev.date) {
                  const d = parseDateLocal(normalizeDateStr(ev.date));
                  if (!isNaN(d.getTime())) examDates.push(d);
                }
              }
            }

            // CMs
            if (m.listeCM) {
              for (const cm of m.listeCM) {
                if (!cm.derniereRevision) { // Uniquement les nouveaux CMs pour le scheduler forward
                  pendingTasks.push({
                    id: `CM_${m.nom}_${cm.titre}`,
                    matiere: m.nom,
                    titre: cm.titre,
                    type: 'CM',
                    duree: cfg.defaultDurationNewCM || 120,
                    coeff,
                    examDates,
                    datePrevue: cm.dateCM ? parseDateLocal(normalizeDateStr(cm.dateCM)) : null
                  });
                }
              }
            }
            
            // TDs
            if (m.listeTD && cfg.enableTD) {
              for (const td of m.listeTD) {
                if (!td.dernierePratique) {
                  pendingTasks.push({
                    id: `TD_${m.nom}_${td.titre}`,
                    matiere: m.nom,
                    titre: td.titre,
                    type: 'TD',
                    duree: cfg.defaultDurationTD || 20,
                    coeff,
                    examDates,
                    datePrevue: td.datePrevue ? parseDateLocal(normalizeDateStr(td.datePrevue)) : null
                  });
                }
              }
            }

            // TPs
            if (m.listeTP) {
              for (const tp of m.listeTP) {
                if (!tp.dernierePratique) {
                  pendingTasks.push({
                    id: `TP_${m.nom}_${tp.titre}`,
                    matiere: m.nom,
                    titre: tp.titre,
                    type: 'TP',
                    duree: cfg.defaultDurationTP || 30,
                    coeff,
                    examDates,
                    datePrevue: tp.datePrevue ? parseDateLocal(normalizeDateStr(tp.datePrevue)) : null
                  });
                }
              }
            }

            // Annales
            if (m.listeAnnales && cfg.enableAnnales) {
              for (const an of m.listeAnnales) {
                if (!an.dernierePratique) {
                  pendingTasks.push({
                    id: `ANNALE_${m.nom}_${an.titre}`,
                    matiere: m.nom,
                    titre: an.titre,
                    type: 'ANNALE',
                    duree: cfg.defaultDurationAnnales || 60,
                    coeff,
                    examDates,
                    datePrevue: an.datePrevue ? parseDateLocal(normalizeDateStr(an.datePrevue)) : null
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // 2. Paramètres de temps
  const wakeUpStr = cfg.wakeUpTime || "07:00";
  const [wakeHour, wakeMin] = wakeUpStr.split(':').map(Number);
  const maxMinsPerDay = (cfg.maxStudyHoursPerDay || 8) * 60;
  const breakMin = cfg.pomoBreak || 5;

  // Initialisation des semaines
  for (let w = 0; w < 52; w++) {
    const weekStart = new Date(startSimulationDate);
    weekStart.setDate(startSimulationDate.getDate() + (w * 7) - (startSimulationDate.getDay() || 7) + 1); // Lundi
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      weekDays.push({
        date: d,
        slots: []
      });
    }

    weeks.push({
      weekIndex: w,
      startDate: weekStart.toISOString().split('T')[0],
      days: weekDays
    });
  }

  // 3. Boucle de Simulation (Forward Scheduling)
  const totalDays = 52 * 7;
  for (let d = 0; d < totalDays; d++) {
    if (pendingTasks.length === 0) break; // Tout est planifié !

    // Trouver la date courante de la simulation
    const wIndex = Math.floor(d / 7);
    const dayIndex = d % 7;
    const currentSimDate = weeks[wIndex].days[dayIndex].date;

    // Recalculer la priorité dynamiquement
    for (const t of pendingTasks) {
      t.prio = t.coeff;
      // Boost d'urgence si examen proche
      let nearestExamDays = 999;
      for (const exDate of t.examDates) {
        const diff = (exDate - currentSimDate) / (1000 * 3600 * 24);
        if (diff > 0 && diff < nearestExamDays) nearestExamDays = diff;
      }
      if (nearestExamDays <= 14) {
        t.prio *= (100 / Math.max(1, nearestExamDays));
      } else if (nearestExamDays <= 30) {
        t.prio *= (10 / Math.max(1, nearestExamDays));
      }
      // Règle: Théorie (CM) passe avant Pratique (TD/TP)
      if (t.type === 'CM') t.prio *= 1.2;
    }

    // Trier les tâches par priorité décroissante
    pendingTasks.sort((a, b) => b.prio - a.prio);

    // Allouer le temps de la journée
    let currentMins = wakeHour * 60 + wakeMin + 60; // On commence 1h après le réveil
    let remainingDailyTime = maxMinsPerDay;

    // Ajouter un bloc statique de révision (Anki / Active Recall) tous les jours
    if (remainingDailyTime > 0) {
      const revTime = cfg.activeRecallMinutesPerDay || 30;
      weeks[wIndex].days[dayIndex].slots.push({
        id: `rev_${d}`,
        matiere: "Général",
        titre: "Révisions (Anki / Active Recall)",
        type: "REVISION",
        startMin: currentMins,
        duree: revTime
      });
      currentMins += revTime + breakMin;
      remainingDailyTime -= revTime;
    }

    // Remplir avec les tâches de la pile
    let i = 0;
    while (i < pendingTasks.length && remainingDailyTime > 0) {
      const task = pendingTasks[i];
      if (task.datePrevue && currentSimDate < task.datePrevue) {
        // Tâche prévue plus tard, on l'ignore pour cette journée
        i++;
        continue;
      }

      if (task.duree <= remainingDailyTime) {
        // La tâche rentre complètement
        weeks[wIndex].days[dayIndex].slots.push({
          id: task.id,
          matiere: task.matiere,
          titre: task.titre,
          type: task.type,
          startMin: currentMins,
          duree: task.duree
        });
        currentMins += task.duree + breakMin;
        remainingDailyTime -= task.duree;
        pendingTasks.splice(i, 1); // Retirer la tâche
      } else {
        // La tâche est trop longue, on la coupe
        weeks[wIndex].days[dayIndex].slots.push({
          id: `${task.id}_part`,
          matiere: task.matiere,
          titre: task.titre + " (Part 1)",
          type: task.type,
          startMin: currentMins,
          duree: remainingDailyTime
        });
        currentMins += remainingDailyTime + breakMin;
        task.duree -= remainingDailyTime; // Réduire la durée pour les jours suivants
        remainingDailyTime = 0;
      }
    }
  }

  return weeks;
}

module.exports = {
  genererSimulationAnnuelle
};
