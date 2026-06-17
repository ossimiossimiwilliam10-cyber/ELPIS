export function getLoadForDate(dateStr, configLocal) {
  let count = 0;
  configLocal.licences?.forEach(l => {
    l.semestres?.forEach(s => {
      s.ues?.forEach(u => {
        u.matieres?.forEach(m => {
          m.listeCM?.forEach(cm => {
            if (cm.prochaineRevisionDate) {
              if (cm.prochaineRevisionDate === dateStr) {
                count++;
              }
            } else if (cm.jActuel > 0 && cm.derniereRevision) {
              const nextDate = new Date(cm.derniereRevision + 'T00:00:00');
              nextDate.setDate(nextDate.getDate() + cm.jActuel);
              if (nextDate.toISOString().split('T')[0] === dateStr) {
                count++;
              }
            }
          });
        });
      });
    });
  });
  return count;
}

export function findOptimalInterval(baseDateStr, targetInterval, configLocal) {
  if (targetInterval <= 1) return targetInterval;

  const baseDate = new Date(baseDateStr + 'T00:00:00');
  
  // Define a search window based on interval size
  // e.g., if interval is 30 days, we can shift by +/- 3 days.
  // If interval is 4 days, shift by +/- 1 day.
  let windowSize = Math.max(1, Math.floor(targetInterval * 0.15));
  if (windowSize > 7) windowSize = 7; // Max shift 1 week

  let bestInterval = targetInterval;
  let minLoad = Infinity;

  for (let offset = -windowSize; offset <= windowSize; offset++) {
    const testInterval = targetInterval + offset;
    if (testInterval <= 0) continue; // Don't allow 0 or negative intervals here

    const testDate = new Date(baseDate);
    testDate.setDate(testDate.getDate() + testInterval);
    const testDateStr = testDate.toISOString().split('T')[0];

    const load = getLoadForDate(testDateStr, configLocal);
    
    // Prefer original interval if loads are equal
    // To do this, we add a tiny penalty to the load based on distance from original target
    const penalty = Math.abs(offset) * 0.1;
    const penalizedLoad = load + penalty;

    if (penalizedLoad < minLoad) {
      minLoad = penalizedLoad;
      bestInterval = testInterval;
    }
  }

  return bestInterval;
}

export function calculateSM2(score, previousInterval, easeFactor, repetitions, configLocal, actualDaysElapsed = -1) {
  // score: 1 (Fail), 2 (Hard), 3 (Good), 4 (Perfect)
  let newEaseFactor = easeFactor || 2.5;
  let newRepetitions = repetitions || 0;
  let newInterval;

  if (score === 1) {
    // Échec
    newRepetitions = 0;
    newInterval = 1;
    // L'ease factor ne baisse pas drastiquement, on le réduit légèrement
    newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
  } else {
    // Succès
    if (score === 2) {
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.15);
    } else if (score === 4) {
      newEaseFactor += 0.15;
    }

    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 3; // On commence par un petit saut
    } else {
      // Late review bonus : Si révision en retard et succès, on utilise le temps réel
      let effectivePreviousInterval = previousInterval;
      if (actualDaysElapsed > previousInterval && score >= 3) {
        effectivePreviousInterval = actualDaysElapsed;
      }
      
      newInterval = Math.round(effectivePreviousInterval * newEaseFactor);
      
      // Bonus pour le score 4
      if (score === 4) {
        newInterval = Math.round(newInterval * 1.3);
      }
    }
    newRepetitions += 1;
  }

  // Load balancing : ajuster l'intervalle
  const todayStr = new Date().toISOString().split('T')[0];
  const optimalInterval = findOptimalInterval(todayStr, newInterval, configLocal);

  const [y, m, dNum] = todayStr.split('-').map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, dNum + optimalInterval));
  const prochaineRevisionDate = nextDate.toISOString().split('T')[0];

  return {
    interval: optimalInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
    prochaineRevisionDate
  };
}
