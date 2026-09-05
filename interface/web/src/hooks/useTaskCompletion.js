import { useCallback } from 'react';
import { produce } from 'immer';
import confetti from 'canvas-confetti';
import useStore from '../store';
import { evaluateFSRS, migrateToFSRSCard, Rating } from '../fsrsEngine';
import { getTodayStr } from '../utils/dateUtils';
import { dureeValidation, moyenneGlissante, difficulteDepuisNote } from '../utils/completion';

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
   * @param {string} [opts.difficulte] — clé de difficulté ressentie (voir DIFFICULTY_LEVELS)
   * @param {number} [opts.note] — note sur 20 (annales uniquement)
   * @param {function} onSuccess — callback après succès
   */
  const completeTask = useCallback((tache, { minutes, sm2Score, difficulte, note }, onSuccess) => {
    const state = useStore.getState();
    const { coursConfig, config, intelligence, addHistoriqueEntry, setCoursConfig, setConfig, notifyTaskCompleted } = state;
    if (!coursConfig) return false;

    const today = getTodayStr();
    let taskFound = false;
    let actionLabel = 'Terminé';
    // Durée réellement comptabilisée : sans repli, une validation sans chrono
    // enregistrait zéro minute et le temps de travail du jour n'avançait pas.
    let dureeComptee = dureeValidation(tache, minutes, config);

    if (tache.isCustom) {
      taskFound = true;
    } else if (tache.type === 'LANGUE') {
      // Une langue ne figure pas dans l'arbre des cours : la parcourir ne
      // trouverait rien et la tâche serait déclarée introuvable. Le relevé de
      // la langue tient lieu de progression.
      taskFound = true;
      const langues = Array.isArray(config?.langues) ? config.langues : [];
      const cible = langues.find(l => l.id === tache.langueId || l.nom === tache.matiere);
      if (cible && tache.volet) {
        setConfig({
          ...config,
          langues: langues.map(l => (l === cible
            ? { ...l, dernieresPratiques: { ...l.dernieresPratiques, [tache.volet]: today } }
            : l)),
        });
      }
    } else {
      const newConfig = produce(coursConfig, draft => {
        draft.licences.forEach(licence =>
          licence.semestres.forEach(semestre =>
            semestre.ues.forEach(ue =>
              ue.matieres.forEach(matiere => {
                if (matiere.nom !== tache.matiere) return;

                if (tache.type === 'CM') {
                  matiere.listeCM.forEach(cm => {
                    // Un titre déjà validé ne doit pas l'être une seconde fois :
                    // deux cours homonymes étaient auparavant traités ensemble.
                    if (cm.titre !== tache.titre || taskFound) return;
                    taskFound = true;

                    const estNouveauCM = !cm.jActuel;

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

                    /*
                     * Une date de dernière révision postérieure à maintenant fait
                     * lever `Invalid delta_t` à la bibliothèque FSRS, et la
                     * validation cassait sans rien enregistrer. Le cas n'a rien
                     * de théorique avec deux appareils synchronisés : il suffit
                     * que l'horloge du téléphone avance sur celle du PC.
                     */
                    const maintenant = new Date();
                    if (fsrsCard.last_review instanceof Date && fsrsCard.last_review > maintenant) {
                      fsrsCard.last_review = maintenant;
                    }

                    const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
                    const fsrsRating = ratingMap[finalScore] || Rating.Good;

                    let newCard = null;
                    try {
                      newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);
                    } catch (erreur) {
                      // Filet de sécurité : mieux vaut un intervalle prudent
                      // qu'une séance travaillée puis perdue.
                      console.error('FSRS a refusé la carte, repli sur un intervalle court.', erreur);
                    }

                    if (newCard) {
                      cm.fsrsCard = newCard;
                      cm.jActuel = newCard.scheduled_days || 1;
                      cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3;
                      cm.repetitions = newCard.reps;
                      cm.prochaineRevisionDate = newCard.due instanceof Date
                        ? newCard.due.toISOString().split('T')[0]
                        : new Date(newCard.due).toISOString().split('T')[0];
                    } else {
                      // Repli : on repart d'un jour, sans perdre le travail fait.
                      cm.jActuel = 1;
                      cm.repetitions = (cm.repetitions || 0) + 1;
                      const demain = new Date();
                      demain.setDate(demain.getDate() + 1);
                      cm.prochaineRevisionDate = demain.toISOString().split('T')[0];
                    }
                    cm.derniereRevision = today;

                    dureeComptee = dureeValidation(tache, minutes, config, { estNouveauCM });
                    /*
                     * Le temps des séances suspendues appartient au coût réel du
                     * chapitre, mais pas à la journée d'aujourd'hui : `tempsMoyen`
                     * le récupère, l'historique n'enregistre que les minutes du
                     * jour. Sans cela, suspendre après vingt minutes un chapitre
                     * qui en demande quatre-vingt-dix apprenait à ELPIS que ce
                     * chapitre coûte vingt minutes.
                     */
                    const coutTotal = dureeComptee + (cm.tempsPartielMin || 0);
                    cm.tempsMoyen = moyenneGlissante(cm.tempsMoyen, cm.nombreRevisionsTemps, coutTotal);
                    cm.nombreRevisionsTemps = (cm.nombreRevisionsTemps || 0) + 1;
                    cm.tempsPartielMin = 0;
                  });
                } else if (['TD', 'TP', 'ANNALE'].includes(tache.type)) {
                  const liste = tache.type === 'TD' ? matiere.listeTD
                    : tache.type === 'TP' ? matiere.listeTP
                    : matiere.listeAnnales;

                  liste?.forEach(exo => {
                    if (exo.titre !== tache.titre || taskFound) return;
                    taskFound = true;

                    exo.dernierePratique = today;
                    exo.nombrePratiques = (exo.nombrePratiques || 0) + 1;
                    if (difficulte) exo.difficulte = difficulte;

                    // La note d'une annale pilote l'urgence côté orchestrateur
                    // (URGENCE_NOTE) : la perdre revient à désactiver la règle.
                    if (tache.type === 'ANNALE' && note !== undefined && note !== null && !isNaN(note)) {
                      exo.derniereNote = note;
                      exo.difficulte = difficulteDepuisNote(note);
                      actionLabel = `Terminé (Note: ${note}/20)`;
                    }

                    const stepIndex = Math.max(0, (exo.nombrePratiques || 1) - 1);
                    dureeComptee = dureeValidation(tache, minutes, config, { etapeIndex: stepIndex });

                    // Sans ces mesures, l'estimation de durée d'un exercice validé
                    // depuis l'accueil ne s'affinait jamais.
                    if (tache.type === 'TP') {
                      if (!exo.tempsMoyenEtapes) exo.tempsMoyenEtapes = [];
                      while (exo.tempsMoyenEtapes.length <= stepIndex) exo.tempsMoyenEtapes.push(null);
                      if (!exo.nombreRevisionsEtapes) exo.nombreRevisionsEtapes = [];
                      while (exo.nombreRevisionsEtapes.length <= stepIndex) exo.nombreRevisionsEtapes.push(0);

                      const count = exo.nombreRevisionsEtapes[stepIndex] || 0;
                      exo.tempsMoyenEtapes[stepIndex] = moyenneGlissante(exo.tempsMoyenEtapes[stepIndex], count, dureeComptee);
                      exo.nombreRevisionsEtapes[stepIndex] = count + 1;
                    } else {
                      exo.tempsMoyen = moyenneGlissante(exo.tempsMoyen, exo.nombreRevisionsTemps, dureeComptee);
                      exo.nombreRevisionsTemps = (exo.nombreRevisionsTemps || 0) + 1;
                    }
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

      if (tache.type === 'CM' && sm2Score) actionLabel = `Révisé (${sm2Score}/4)`;
      else if (actionLabel === 'Terminé' && difficulte) actionLabel = `Terminé (${difficulte})`;

      addHistoriqueEntry({
        type: tache.type, titre: tache.titre, matiere: tache.matiere,
        action: actionLabel, dureeMinutes: dureeComptee
      });

      // Déverrouille « Avance & Bonus » et « Projets » sans attendre le prochain rapport.
      notifyTaskCompleted?.();

      if (onSuccess) onSuccess();
    }

    return taskFound;
  }, []);

  /** Suspend un CM — le repousse à demain sans pénalité */
  const suspendCM = useCallback((tache, defaultDuration = 30) => {
    const state = useStore.getState();
    const { coursConfig, config, setCoursConfig, addHistoriqueEntry, notifyTaskCompleted } = state;
    if (!coursConfig) return;

    const now = new Date();
    now.setHours(now.getHours() - 4);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const effectiveDuration = defaultDuration || config?.defaultDurationRevCM || 30;
    let suspendu = false;

    const newConfig = produce(coursConfig, draft => {
      draft.licences.forEach(licence =>
        licence.semestres.forEach(semestre =>
          semestre.ues.forEach(ue =>
            ue.matieres.forEach(matiere => {
              if (matiere.nom !== tache.matiere) return;
              matiere.listeCM?.forEach(cm => {
                if (cm.titre !== tache.titre || suspendu) return;
                suspendu = true;
                cm.prochaineRevisionDate = tomorrowStr;
                /*
                 * Une séance suspendue n'est pas une mesure du temps que ce
                 * chapitre demande : l'enregistrer comme telle faisait croire à
                 * ELPIS qu'un chapitre interrompu au bout de vingt minutes en
                 * coûte vingt. Les minutes sont mises de côté et rejoindront la
                 * moyenne le jour où le chapitre sera réellement terminé.
                 */
                cm.tempsPartielMin = (cm.tempsPartielMin || 0) + effectiveDuration;
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

    // Une séance suspendue quitte elle aussi la liste du jour.
    if (suspendu) notifyTaskCompleted?.();
  }, []);

  return { completeTask, suspendCM };
}
