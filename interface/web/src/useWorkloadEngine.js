import { useEffect, useRef } from 'react';
import useStore from './store';
import { parseDateLocal } from './parseDateLocal';

// Helper function to calculate days between two dates
const getDaysBetween = (d1, d2) => {
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export function useWorkloadEngine() {
  const { config, coursConfig, historique, setConfig } = useStore();
  const lastUpdateRef = useRef(0); // throttle updates to prevent infinite loops

  useEffect(() => {
    if (!config || !coursConfig) return;

    let totalRecommendedMinutes = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Calculate per-subject requirement
    coursConfig.licences?.forEach(l => {
      if (l.archived) return; // Skip archived licences for workload calculation
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            // A. Base Effort
            const coeff = m.coefficient || 1;
            // Assuming 1 coeff = ~15 hours of personal work for a semester
            const baseEffortHours = coeff * 15;

            // B. Multipliers
            const targetGrade = config.targetGrade || 14;
            const targetRank = config.targetRank || 50;
            
            // Grade multiplier: 10/20 -> 1x, 20/20 -> 2x
            const gradeMultiplier = 1 + (targetGrade - 10) * 0.1;
            // Rank multiplier: Top 50% -> 1x, Top 1% -> 2x
            const rankMultiplier = 1 + (50 - targetRank) / 50;
            
            const totalMultiplier = (gradeMultiplier + rankMultiplier) / 2;
            
            let requiredEffortHours = baseEffortHours * totalMultiplier;

            // C. Subtract work already done (filtré par date de début d'étude)
            let hoursDone = 0;
            if (historique && config.studyStartDate) {
              const studyStart = parseDateLocal(config.studyStartDate);
              const subjectHistory = historique.filter(h => {
                if (h.matiere !== m.nom) return false;
                if (!h.timestamp) return false;
                const entryDate = new Date(h.timestamp);
                return studyStart ? entryDate >= studyStart : true;
              });
              hoursDone = subjectHistory.reduce((sum, h) => {
                let mins = h.dureeMinutes;
                if (mins == null || isNaN(mins)) {
                  if (h.type === 'ANKI') mins = config.defaultDurationAnki || 30;
                  else if (h.type === 'CM') mins = config.defaultDurationRevCM || 30;
                  else if (h.type === 'TD') mins = config.defaultDurationTD || 20;
                  else if (h.type === 'TP') mins = config.defaultDurationTP_Etape1 || 45;
                  else if (h.type === 'ANNALE') mins = config.defaultDurationAnnales || 60;
                  else mins = 30;
                }
                return sum + (mins / 60);
              }, 0);
            }
            
            let remainingEffortHours = Math.max(0, requiredEffortHours - hoursDone);

            // D. Calculate days left
            let examDateStr = (m.examDates && m.examDates.length > 0 && m.examDates[0]) 
              ? m.examDates[0] 
              : (config.defaultSemesterEndDate || "2027-01-15");
            const examDate = parseDateLocal(examDateStr);

            // If date is invalid or exam is passed, remaining effort for this subject is 0
            if (!examDate || examDate < today) {
              remainingEffortHours = 0;
            }

            const daysLeft = Math.max(1, getDaysBetween(today, examDate || today));

            // E. Calculate daily requirement for this subject
            const dailyRequirementHours = remainingEffortHours / daysLeft;
            totalRecommendedMinutes += dailyRequirementHours * 60;
          });
        });
      });
    });

    // We don't want the recommendation to go crazy high if the user falls behind.
    // Cap it at a realistic maximum (e.g. 10 hours/day).
    const cappedMinutes = Math.min(totalRecommendedMinutes, 10 * 60);
    // Convert to hours with 1 decimal
    const recommendedHours = Math.max(0.5, Math.round((cappedMinutes / 60) * 10) / 10);

    // Update config transparently so the orchestrator uses it
    // Throttle: only update once per 60 seconds to prevent cascading re-renders
    const now = Date.now();
    if (config.maxStudyHoursPerDay !== recommendedHours && recommendedHours > 0 && (now - lastUpdateRef.current) > 60000) {
      lastUpdateRef.current = now;
      setConfig({ ...config, maxStudyHoursPerDay: recommendedHours });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.targetGrade, config?.targetRank, config?.defaultSemesterEndDate, config?.studyStartDate, coursConfig, historique]);

  return config?.maxStudyHoursPerDay || 0;
}
