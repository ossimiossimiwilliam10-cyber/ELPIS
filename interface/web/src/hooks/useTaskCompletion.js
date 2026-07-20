import { useCallback } from 'react';
import { produce } from 'immer';
import confetti from 'canvas-confetti';
import useStore from '../store';
import { evaluateFSRS, migrateToFSRSCard, Rating } from '../fsrsEngine';

/**
 * Hook partagé entre Dashboard et EntrainementPage pour la complétion de tâches.
 * Centralise la logique métier CM (FSRS), TD/TP/Annales, et Anki.
 */
export function useTaskCompletion() {
  /**
   * @param {object} tache — la tâche à compléter
   * @param {object} opts
   * @param {number} opts.minutes — temps réel passé
   * @param {number} [opts.sm2Score] — score FSRS 1-4 (CM uniquement)
   * @param {string} [opts.difficulte] — difficulté ressentie
   * @param {function} onSuccess — callback après succès
   */
  const completeTask = useCallback((tache, { minutes, sm2Score, difficulte }, onSuccess) => {
    const state = useStore.getState();
    const { coursConfig, config, intelligence, addHistoriqueEntry, setConfig, setCoursConfig } = state;
    if (!coursConfig) return false;

    const getTodayStr = () => {
      const d = new Date();
      d.setHours(d.getHours() - 4);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const today = getTodayStr();
    let taskFound = false;

    if (tache.isCustom) {
      taskFound = true;
    } else {
      const newConfig = produce(coursConfig, draft => {
        draft.licences.forEach(licence =>
          licence.semestres.forEach(semestre =>
            semestre.ues.forEach(ue =>
              ue.matieres.forEach(matiere => {
                if (matiere.nom !== tache.matiere) return;

                if (tache.type === 'CM') {
                  matiere.listeCM.forEach(cm => {
                    if (cm.titre !== tache.titre) return;
                    taskFound = true;

                    let personalizedDecayMultiplier = 1.0;
                    if (intelligence?.velocityMap && tache.matiere) {
                      const vData = intelligence.velocityMap[(tache.matiere || '').toLowerCase().trim()];
                      if (vData?.isSlowLearner) personalizedDecayMultiplier = 0.8;
                      else if (vData?.avgSessionsToMaster && vData.avgSessionsToMaster <= 2) personalizedDecayMultiplier = 1.2;
                    }

                    let finalScore = sm2Score;
                    if (minutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
                      const ratio = minutes / cm.tempsMoyen;
                      if (ratio > 1.5 && finalScore > 1) finalScore -= 1;
                      if (ratio > 2.0 && finalScore > 1) finalScore -= 1;
                      if (ratio < 0.5 && finalScore < 4) finalScore += 1;
                    }

                    let fsrsCard = cm.fsrsCard ? { ...cm.fsrsCard } : migrateToFSRSCard(cm);
                    if (typeof fsrsCard.due === 'string') fsrsCard.due = new Date(fsrsCard.due);
                    if (typeof fsrsCard.last_review === 'string') fsrsCard.last_review = new Date(fsrsCard.last_review);

                    const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
                    const fsrsRating = ratingMap[finalScore] || Rating.Good;
                    const newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);

                    cm.fsrsCard = newCard;
                    cm.jActuel = newCard.scheduled_days || 1;
                    cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3;
                    cm.repetitions = newCard.reps;
                    cm.derniereRevision = today;
                    cm.prochaineRevisionDate = newCard.due instanceof Date
                      ? newCard.due.toISOString().split('T')[0]
                      : new Date(newCard.due).toISOString().split('T')[0];

                    const currentAvg = cm.tempsMoyen || 0;
                    const currentCount = cm.nombreRevisionsTemps || 0;
                    cm.tempsMoyen = ((currentAvg * currentCount) + minutes) / (currentCount + 1);
                    cm.nombreRevisionsTemps = currentCount + 1;
                  });
                } else if (tache.type === 'TD') {
                  matiere.listeTD?.forEach(td => {
                    if (td.titre !== tache.titre) return;
                    td.dernierePratique = today;
                    td.nombrePratiques = (td.nombrePratiques || 0) + 1;
                    if (difficulte) td.difficulte = difficulte;
                    taskFound = true;
                  });
                } else if (tache.type === 'TP') {
                  matiere.listeTP?.forEach(tp => {
                    if (tp.titre !== tache.titre) return;
                    tp.dernierePratique = today;
                    tp.nombrePratiques = (tp.nombrePratiques || 0) + 1;
                    if (difficulte) tp.difficulte = difficulte;
                    taskFound = true;
                  });
                } else if (tache.type === 'ANNALE') {
                  matiere.listeAnnales?.forEach(annale => {
                    if (annale.titre !== tache.titre) return;
                    annale.dernierePratique = today;
                    annale.nombrePratiques = (annale.nombrePratiques || 0) + 1;
                    if (difficulte) annale.difficulte = difficulte;
                    taskFound = true;
                  });
                }
              })
            )
          )
        );
      });
      if (taskFound) setCoursConfig(newConfig);
    }

    if (taskFound) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3B82F6', '#10B981', '#F59E0B'] });

      let actionLabel = 'Terminé';
      if (tache.type === 'CM' && sm2Score) actionLabel = `Révisé (${sm2Score}/4)`;
      else if (difficulte) actionLabel = `Terminé (${difficulte})`;

      addHistoriqueEntry({
        type: tache.type, titre: tache.titre, matiere: tache.matiere,
        action: actionLabel, dureeMinutes: minutes
      });

      if (onSuccess) onSuccess();
    }

    return taskFound;
  }, []);

  /** Suspend un CM — le repousse à demain sans pénalité */
  const suspendCM = useCallback((tache, defaultDuration = 30) => {
    const state = useStore.getState();
    const { coursConfig, config, setCoursConfig, addHistoriqueEntry } = state;
    if (!coursConfig) return;

    const now = new Date();
    now.setHours(now.getHours() - 4);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const effectiveDuration = defaultDuration || config?.defaultDurationRevCM || 30;

    const newConfig = produce(coursConfig, draft => {
      draft.licences.forEach(licence =>
        licence.semestres.forEach(semestre =>
          semestre.ues.forEach(ue =>
            ue.matieres.forEach(matiere => {
              if (matiere.nom !== tache.matiere) return;
              matiere.listeCM?.forEach(cm => {
                if (cm.titre !== tache.titre) return;
                cm.prochaineRevisionDate = tomorrowStr;
                const currentAvg = cm.tempsMoyen || 0;
                const currentCount = cm.nombreRevisionsTemps || 0;
                const weight = Math.min(currentCount, 4);
                cm.tempsMoyen = ((currentAvg * weight) + effectiveDuration) / (weight + 1);
                cm.nombreRevisionsTemps = currentCount + 1;
              });
            })
          )
        )
      );
    });

    setCoursConfig(newConfig);
    addHistoriqueEntry({
      type: 'CM', titre: tache.titre, matiere: tache.matiere,
      action: 'Suspendu (séance partielle)', dureeMinutes: effectiveDuration
    });
  }, []);

  return { completeTask, suspendCM };
}
