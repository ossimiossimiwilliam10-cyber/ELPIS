const { parseDateLocal, normalizeDateStr } = require('./utils');
const { getCapitalisedUEs } = require('./scoring');

/**
 * Calcule une simulation des 52 prochaines semaines pour estimer les matières dominantes
 * et la charge de travail basée sur les examens (evaluations) de l'utilisateur.
 * 
 * @param {Object} crs L'objet cours (cours.json)
 * @returns {Array} Un tableau de 52 objets représentant chaque semaine
 */
function genererSimulationAnnuelle(crs) {
  const weeks = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Pour chaque semaine sur 52 semaines (1 an)
  for (let w = 0; w < 52; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + (w * 7) - now.getDay() + 1); // Début = Lundi
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Fin = Dimanche

    const weekExams = [];
    const subjectPressures = {};

    let totalCMsDansSemestre = 0;

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
              
              const matiereNom = m.nom.toLowerCase().trim();
              if (!subjectPressures[matiereNom]) {
                subjectPressures[matiereNom] = { nom: m.nom, score: 0 };
              }

              // Pression de base: le poids de la matière (coef) + nombre de CM (volume estimé)
              const coeff = m.coefficient || 1;
              const nbCM = m.listeCM ? m.listeCM.length : 0;
              subjectPressures[matiereNom].score += (coeff * 0.5) + (nbCM * 0.1);
              totalCMsDansSemestre += nbCM;

              // Analyser les évaluations (examens)
              if (m.evaluations) {
                for (const evalObj of m.evaluations) {
                  if (evalObj.date) {
                    const evalDate = parseDateLocal(normalizeDateStr(evalObj.date));
                    if (!isNaN(evalDate.getTime())) {
                      // Est-ce que l'examen tombe cette semaine ?
                      if (evalDate >= weekStart && evalDate <= weekEnd) {
                        weekExams.push({
                          matiere: m.nom,
                          titre: evalObj.titre || "Évaluation",
                          date: evalDate.toISOString().split('T')[0]
                        });
                        subjectPressures[matiereNom].score += 50; // Pression critique la semaine de l'exam
                      } 
                      // Est-ce que l'examen approche ? (ex: dans les 3 semaines suivantes)
                      else if (evalDate > weekEnd) {
                        const daysUntilExam = (evalDate - weekEnd) / (1000 * 3600 * 24);
                        if (daysUntilExam <= 21) {
                          // Plus on s'approche de l'examen, plus la pression monte (x3 à J-7, x1.5 à J-21)
                          const urgenceScore = 100 / Math.max(1, daysUntilExam);
                          subjectPressures[matiereNom].score += urgenceScore;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Trier les matières par pression
    const sortedSubjects = Object.values(subjectPressures)
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score > 2) // Garder seulement les matières significatives
      .slice(0, 3) // Top 3 des matières
      .map(s => s.nom);

    // Estimation de la charge de travail (Workload)
    // Basée empiriquement sur les examens + un fond de roulement
    let workloadScore = 0;
    if (weekExams.length > 0) {
      workloadScore += weekExams.length * 30; // 30 points par examen cette semaine-là
    }
    // Les matières avec de hauts scores d'approche d'examen (urgence) rajoutent de la charge
    const topPressures = Object.values(subjectPressures).sort((a, b) => b.score - a.score).slice(0, 3);
    const sumTopPressures = topPressures.reduce((acc, p) => acc + p.score, 0);
    workloadScore += sumTopPressures;

    let workloadIntensity = "Légère";
    if (workloadScore > 80) workloadIntensity = "Critique";
    else if (workloadScore > 40) workloadIntensity = "Intense";
    else if (workloadScore > 15) workloadIntensity = "Modérée";
    else if (totalCMsDansSemestre === 0) workloadIntensity = "Repos";

    // Si pas de matières ni d'exams, c'est sûrement les vacances ou semestre fini
    if (sortedSubjects.length === 0 && weekExams.length === 0) {
      workloadIntensity = "Repos";
    }

    weeks.push({
      weekIndex: w,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      workloadIntensity,
      dominantSubjects: sortedSubjects,
      exams: weekExams
    });
  }

  return weeks;
}

module.exports = {
  genererSimulationAnnuelle
};
