import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore, { useChronoStore } from './store';
import logger from './utils/logger';
import { useToast } from './ToastProvider';
import { evaluateFSRS, migrateToFSRSCard, Rating } from './fsrsEngine';
import ExerciceCard from './components/cours/ExerciceCard';
import { getTodayStr } from './utils/dateUtils';
import { getApiUrl } from './utils/apiConfig';
import { buildTaskKey } from './utils/taskKey';
import { dureeValidation, moyenneGlissante, difficulteDepuisNote } from './utils/completion';
import CircularProgress from './components/CircularProgress';
import { Bouton, Carte, EtatVide, Jauge, Rang, TitrePage } from './components/ui';

const pluriel = (n, singulier, plurielMot = `${singulier}s`) => (n > 1 ? plurielMot : singulier);

/** Identifiant d'un exercice affiché, stable d'un rendu à l'autre. */
export const cleExercice = (exo) =>
  exo?.id || buildTaskKey({ type: exo?.type, matiere: exo?.matiereNom, titre: exo?.titre });

function EntrainementPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry, config, setConfig, dailyFillGap, setDailyFillGap, intelligence, orchestratorData, fetchOrchestrator, notifyTaskCompleted } = useStore();
  const { resetGlobalChrono } = useChronoStore();
  const { toast } = useToast();
  const [fatigueCounter, setFatigueCounter] = useState(0);

  const [configLocal, setConfigLocal] = useState(() => {
    if (coursConfig && coursConfig.licences) return JSON.parse(JSON.stringify(coursConfig));
    return { licences: [] };
  });
  const [filterMatiere, setFilterMatiere] = useState('all');
  const [tachesOrchestrateur, setTachesOrchestrateur] = useState(null);
  const [tempsDejaTravaille, setTempsDejaTravaille] = useState(0);
  const [tempsDispoMin, setTempsDispoMin] = useState(0);
  // Tâches sans ancrage dans le cursus (mémoire de stage, activité libre) : elles n'ont
  // pas de `dernierePratique` à inspecter, on mémorise donc localement ce qui a été validé.
  const [validees, setValidees] = useState(() => new Set());
  // Verrou synchrone : un second clic arrive avant que React n'ait propagé l'état,
  // ce qui créait deux entrées d'historique pour un seul exercice.
  const validationEnCours = useRef(new Set());

  useEffect(() => {
    const store = useStore.getState();
    if (store.forcedTask) {
      setTachesOrchestrateur([store.forcedTask]);
      store.setForcedTask(null);
    } else {
      fetchOrchestrator({ fillGap: dailyFillGap, extraTime: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyFillGap]);

  // Un ref plutôt qu'un state : mémoriser la valeur précédente ne doit pas
  // déclencher de rendu supplémentaire.
  const prevOrchestratorData = useRef(null);
  useEffect(() => {
    if (orchestratorData && orchestratorData !== prevOrchestratorData.current) {
      prevOrchestratorData.current = orchestratorData;
      if (orchestratorData.tachesDuJour) {
        setTachesOrchestrateur(orchestratorData.tachesDuJour);
      }
      setTempsDejaTravaille(orchestratorData.tempsDejaTravailleMin || 0);
      setTempsDispoMin(orchestratorData.tempsDispoMin || 0);
    }
  }, [orchestratorData]);

  // Resynchroniser l'état local quand le store change
  const prevCoursConfig = useRef(null);
  useEffect(() => {
    if (coursConfig && coursConfig !== prevCoursConfig.current) {
      prevCoursConfig.current = coursConfig;
      if (coursConfig.licences) {
        setConfigLocal(coursConfig);
      }
    }
  }, [coursConfig]);

  // Exercices correspondant aux tâches de l'orchestrateur, dans son ordre.
  const strategicExercices = useMemo(() => {
    if (!tachesOrchestrateur || !configLocal.licences) return [];

    const exosToReview = [];

    // Index préalable : évite de reparcourir tout le cursus pour chaque tâche.
    const exoMap = new Map();
    configLocal.licences.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            const addToMap = (listeExos, type) => {
               if (!listeExos) return;
               listeExos.forEach((ex, exIndex) => {
                 const key = `${m.nom}-${type}-${ex.titre}`;
                 if (!exoMap.has(key)) exoMap.set(key, []);
                 exoMap.get(key).push({
                   ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom, notebookLMLink: m.notebookLMLink, ankiDeckName: m.ankiDeckName
                 });
               });
            };
            addToMap(m.listeTD, 'TD');
            addToMap(m.listeTP, 'TP');
            addToMap(m.listeCM, 'CM');
            addToMap(m.listeAnnales, 'ANNALE');
          });
        });
      });
    });

    tachesOrchestrateur.forEach((t) => {
      if (t.type === 'ANKI') {
        exosToReview.push({
           type: 'ANKI',
           titre: t.titre,
           matiereNom: 'Routine',
           dureeMinutes: t.dureeMinutes,
           raisons: t.raisons,
           id: 'anki_task'
        });
        return;
      }

      const key = `${t.matiere}-${t.type}-${t.titre}`;
      const candidates = exoMap.get(key);
      if (candidates && candidates.length > 0) {
        // Retirer le candidat retenu de la file pour ne pas le proposer deux fois.
        const match = candidates.shift();
        // Les motifs de planification viennent du rapport, pas du cursus : sans cette
        // reprise, les badges « Examen proche », « Urgence note »… n'apparaissaient jamais.
        exosToReview.push({
          ...match,
          raisons: t.raisons,
          moment: t.moment,
          dureeMinutes: t.dureeMinutes,
          // Score borné et sa décomposition : permettent d'expliquer le rang.
          priorite: t.priorite,
          explication: t.explication,
        });
        return;
      }

      // Tâche planifiée sans exercice correspondant : mémoire de stage, activité
      // libre, ou exercice renommé depuis la génération du rapport. Elle était
      // purement et simplement ignorée — y compris le mémoire de substitution, que
      // l'orchestrateur marque pourtant comme obligatoire et prioritaire.
      exosToReview.push({
        ...t,
        matiereNom: t.matiere,
        horsCursus: true,
        id: t.id || buildTaskKey(t)
      });
    });

    return exosToReview;
  }, [configLocal, tachesOrchestrateur]);

  const matiereNames = useMemo(() => {
    const names = new Set();
    strategicExercices.forEach(ex => names.add(ex.matiereNom));
    return Array.from(names);
  }, [strategicExercices]);

  const remainingExercises = useMemo(() => {
    const todayStr = getTodayStr();
    return strategicExercices.filter(exo => {
      if (validees.has(cleExercice(exo))) return false;
      if (exo.horsCursus) return true;
      if (exo.type === 'ANKI') return config?.dernierePratiqueAnki !== todayStr;
      if (exo.type === 'CM') return exo.derniereRevision !== todayStr;
      return exo.dernierePratique !== todayStr;
    });
  }, [strategicExercices, config, validees]);

  const exercicesDuJour = useMemo(() => {
    if (filterMatiere === 'all') return remainingExercises;
    return remainingExercises.filter(ex => ex.matiereNom === filterMatiere);
  }, [remainingExercises, filterMatiere]);

  // Progression de la session : ne porte que sur les tâches planifiées aujourd'hui.
  // Comptabiliser tout le cursus faussait le chiffre — dix révisions bonus faisaient
  // afficher « 67 % » alors qu'aucune tâche du jour n'était entamée.
  const totalSession = strategicExercices.length;
  const faitesSession = Math.max(0, totalSession - remainingExercises.length);
  const progressPercent = totalSession > 0 ? Math.round((faitesSession / totalSession) * 100) : 0;

  // Exercices travaillés aujourd'hui hors de la session planifiée (Avance & Bonus).
  const bonusHorsSession = useMemo(() => {
    const todayStr = getTodayStr();
    let total = 0;
    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            total += (m.listeTD || []).filter(td => td.dernierePratique === todayStr).length;
            total += (m.listeTP || []).filter(tp => tp.dernierePratique === todayStr).length;
            total += (m.listeAnnales || []).filter(a => a.dernierePratique === todayStr).length;
            total += (m.listeCM || []).filter(cm => cm.derniereRevision === todayStr).length;
          });
        });
      });
    });
    return Math.max(0, total - faitesSession);
  }, [configLocal, faitesSession]);

  /**
   * Vérifie que les indices mémorisés pointent toujours sur l'exercice attendu.
   * Le cursus peut avoir changé (autre onglet, resynchronisation) entre l'affichage
   * de la carte et le clic : sans ce contrôle, `evaluateCM` et `suspendCM`
   * déréférençaient `undefined` et faisaient tomber la page entière.
   */
  const localiserExercice = useCallback((exo, listeNom) => {
    const matiere = configLocal.licences?.[exo.lIndex]?.semestres?.[exo.sIndex]?.ues?.[exo.uIndex]?.matieres?.[exo.mIndex];
    const liste = matiere?.[listeNom];
    if (!Array.isArray(liste) || !liste[exo.exIndex]) return null;
    return matiere;
  }, [configLocal]);

  /** Empêche une double validation ; renvoie false si l'exercice est déjà en cours. */
  const reserverValidation = (exo) => {
    const cle = cleExercice(exo);
    if (validationEnCours.current.has(cle)) return false;
    validationEnCours.current.add(cle);
    return true;
  };
  const libererValidation = (exo) => validationEnCours.current.delete(cleExercice(exo));

  const lancerConfetti = (couleurs) => confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: couleurs
  });

  const evaluateCM = (exo, score, elapsedMinutes = 0) => {
    if (!reserverValidation(exo)) return;

    if (!localiserExercice(exo, 'listeCM')) {
      libererValidation(exo);
      toast.error("Ce cours n'existe plus dans le cursus. Recharge la page.");
      return;
    }

    let finalJActuel = 0;
    let finalEaseFactor = 2.5;
    let dureeComptee = 0;

    // On part de `configLocal`, comme les autres validations. Partir de `coursConfig`
    // faisait perdre la validation précédente lorsque deux exercices étaient enchaînés
    // plus vite que l'aller-retour avec le store.
    const newConf = produce(configLocal, draft => {
      const cm = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];

      // Capturé avant la mise à jour FSRS : `jActuel` est réécrit plus bas, si bien
      // qu'un premier passage sur un cours neuf n'était jamais crédité de sa durée
      // longue (defaultDurationNewCM) mais toujours de celle d'une simple révision.
      const estNouveauCM = !cm.jActuel;

      let finalScore = score;

      // --- PÉNALITÉ / BONUS TEMPOREL ---
      if (elapsedMinutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
        const ratio = elapsedMinutes / cm.tempsMoyen;
        if (ratio > 1.5 && finalScore > 1) finalScore -= 1;
        if (ratio > 2.0 && finalScore > 1) finalScore -= 1;
        if (ratio < 0.5 && finalScore < 4) finalScore += 1;
      }

      // AXE 9 : décroissance personnalisée
      let personalizedDecayMultiplier = 1.0;
      if (intelligence?.velocityMap && exo.matiereNom) {
         const vData = intelligence.velocityMap[(exo.matiereNom || '').toLowerCase().trim()];
         if (vData && vData.isSlowLearner) {
            personalizedDecayMultiplier = 0.8; // Matière fragile -> réviser plus souvent
         } else if (vData && vData.avgSessionsToMaster && vData.avgSessionsToMaster <= 2) {
            personalizedDecayMultiplier = 1.2; // Apprentissage rapide -> espacer
         }
      }

      // AXE 7 : suivi de la fatigue
      const expectedDuration = dureeValidation(exo, 0, config, { estNouveauCM });
      if (finalScore <= 2 || (elapsedMinutes > 0 && elapsedMinutes > expectedDuration * 1.5)) {
        setFatigueCounter(prev => prev + 1);
      } else if (finalScore === 4) {
        setFatigueCounter(0);
      }

      // --- FSRS : migration ou récupération de la carte ---
      let fsrsCard = cm.fsrsCard ? { ...cm.fsrsCard } : migrateToFSRSCard(cm);
      // Reconvertir les dates sérialisées (JSON → Date)
      if (typeof fsrsCard.due === 'string') fsrsCard.due = new Date(fsrsCard.due);
      if (typeof fsrsCard.last_review === 'string') fsrsCard.last_review = new Date(fsrsCard.last_review);

      const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
      const fsrsRating = ratingMap[finalScore] || Rating.Good;

      const newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);

      cm.fsrsCard = newCard;

      // Rétrocompatibilité : l'orchestrateur et le reste de l'app lisent encore SM-2.
      cm.jActuel = newCard.scheduled_days || 1;
      cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3;
      cm.repetitions = newCard.reps;
      cm.prochaineRevisionDate = newCard.due instanceof Date
        ? newCard.due.toISOString().split('T')[0]
        : new Date(newCard.due).toISOString().split('T')[0];

      cm.derniereRevision = getTodayStr();

      const effectiveMinutes = dureeValidation(exo, elapsedMinutes, config, { estNouveauCM });

      cm.tempsMoyen = moyenneGlissante(cm.tempsMoyen, cm.nombreRevisionsTemps, effectiveMinutes);
      cm.nombreRevisionsTemps = (cm.nombreRevisionsTemps || 0) + 1;

      // Capturer les valeurs avant la fermeture du scope produce
      finalJActuel = cm.jActuel;
      finalEaseFactor = cm.easeFactor;
      dureeComptee = effectiveMinutes;
    });

    lancerConfetti(['#3b82f6', '#ffffff']);

    setConfigLocal(newConf);
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: 'CM',
      titre: exo.titre,
      matiere: exo.matiereNom,
      action: `Révisé (J${finalJActuel})`,
      // Même durée que celle enregistrée dans l'exercice : l'historique et la
      // progression du jour divergeaient de 90 min sur un cours neuf.
      dureeMinutes: dureeComptee,
      easeFactor: finalEaseFactor
    });
    setTempsDejaTravaille(prev => prev + dureeComptee);
    // Déverrouille « Avance & Bonus » et « Projets » sans attendre le prochain rapport.
    notifyTaskCompleted?.();
  };

  const markAsDone = (exo, difficulte = "", elapsedMinutes = 0) => {
    if (!reserverValidation(exo)) return;

    const todayStr = getTodayStr();

    if (exo.type === 'ANKI') {
      const dureeAnki = dureeValidation(exo, elapsedMinutes, config);
      setConfig({ ...config, dernierePratiqueAnki: todayStr });
      addHistoriqueEntry({
        type: 'ANKI',
        titre: exo.titre,
        matiere: exo.matiereNom,
        action: 'Terminé',
        dureeMinutes: dureeAnki
      });
      lancerConfetti(['#818CF8', '#34D399', '#FBBF24']);
      resetGlobalChrono();
      setTempsDejaTravaille(prev => prev + dureeAnki);
      notifyTaskCompleted?.();
      return;
    }

    // Une séance de langue met aussi à jour le relevé de sa langue. Le moteur
    // sait déjà lire l'historique pour la journée en cours, mais celui-ci est
    // élagué à 10 000 entrées : le relevé, lui, ne se perd pas.
    if (exo.type === 'LANGUE' && exo.volet) {
      const langues = Array.isArray(config.langues) ? config.langues : [];
      const cible = langues.find(l => l.id === exo.langueId || l.nom === exo.matiereNom);
      if (cible) {
        setConfig({
          ...config,
          langues: langues.map(l => (l === cible
            ? { ...l, dernieresPratiques: { ...l.dernieresPratiques, [exo.volet]: todayStr } }
            : l)),
        });
      }
    }

    // Tâche planifiée sans exercice dans le cursus : rien à mettre à jour côté
    // cursus, on trace le travail et on la retire de la liste du jour.
    if (exo.horsCursus) {
      const duree = dureeValidation(exo, elapsedMinutes, config);
      addHistoriqueEntry({
        type: exo.type,
        titre: exo.titre,
        matiere: exo.matiereNom,
        action: 'Terminé',
        dureeMinutes: duree
      });
      setValidees(prev => new Set(prev).add(cleExercice(exo)));
      lancerConfetti(['#a855f7', '#ffffff']);
      resetGlobalChrono();
      setTempsDejaTravaille(prev => prev + duree);
      notifyTaskCompleted?.();
      return;
    }

    const listeNom = exo.type === 'TD' ? 'listeTD' : exo.type === 'TP' ? 'listeTP' : 'listeAnnales';
    if (!localiserExercice(exo, listeNom)) {
      libererValidation(exo);
      toast.error("Configuration modifiée. Recharge la page.");
      return;
    }

    let actionLabel = 'Terminé';
    let dureeComptee = 0;

    const newConfig = produce(configLocal, draft => {
      const targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex][listeNom];
      const currentExo = targetList[exo.exIndex];
      currentExo.dernierePratique = todayStr;
      currentExo.nombrePratiques = (currentExo.nombrePratiques || 0) + 1;

      if (exo.type === 'ANNALE' && difficulte !== "") {
        // Pour les annales, `difficulte` transporte la note sur 20.
        const note = parseFloat(difficulte);
        if (!isNaN(note)) {
          currentExo.derniereNote = note;
          actionLabel = `Terminé (Note: ${note}/20)`;
          currentExo.difficulte = difficulteDepuisNote(note);
        }
      } else if (difficulte) {
        currentExo.difficulte = difficulte;
      }

      const stepIndex = Math.max(0, (currentExo.nombrePratiques || 1) - 1);
      const effectiveMinutes = dureeValidation(exo, elapsedMinutes, config, { etapeIndex: stepIndex });
      dureeComptee = effectiveMinutes;

      if (exo.type === 'TP') {
        if (!currentExo.tempsMoyenEtapes) currentExo.tempsMoyenEtapes = [];
        while (currentExo.tempsMoyenEtapes.length <= stepIndex) currentExo.tempsMoyenEtapes.push(null);

        if (!currentExo.nombreRevisionsEtapes) currentExo.nombreRevisionsEtapes = [];
        while (currentExo.nombreRevisionsEtapes.length <= stepIndex) currentExo.nombreRevisionsEtapes.push(0);

        const currentCount = currentExo.nombreRevisionsEtapes[stepIndex] || 0;
        currentExo.tempsMoyenEtapes[stepIndex] = moyenneGlissante(currentExo.tempsMoyenEtapes[stepIndex], currentCount, effectiveMinutes);
        currentExo.nombreRevisionsEtapes[stepIndex] = currentCount + 1;
      } else {
        currentExo.tempsMoyen = moyenneGlissante(currentExo.tempsMoyen, currentExo.nombreRevisionsTemps, effectiveMinutes);
        currentExo.nombreRevisionsTemps = (currentExo.nombreRevisionsTemps || 0) + 1;
      }

      // AXE 7 : suivi de la fatigue
      const expectedDur = dureeValidation(exo, 0, config, { etapeIndex: stepIndex });
      if (difficulte === 'difficile' || (elapsedMinutes > 0 && elapsedMinutes > expectedDur * 1.5)) {
         setFatigueCounter(prev => prev + 1);
      } else if (difficulte === 'tres_facile') {
         setFatigueCounter(0);
      }
    });

    lancerConfetti(
      exo.type === 'TD' ? ['#34D399', '#ffffff'] :
      exo.type === 'TP' ? ['#FBBF24', '#ffffff'] : ['#ef4444', '#ffffff']
    );

    setConfigLocal(newConfig);
    setCoursConfig(newConfig);

    addHistoriqueEntry({
      type: exo.type,
      titre: exo.titre,
      matiere: exo.matiereNom,
      action: actionLabel,
      dureeMinutes: dureeComptee
    });
    setTempsDejaTravaille(prev => prev + dureeComptee);
    // Déverrouille « Avance & Bonus » et « Projets » sans attendre le prochain rapport.
    notifyTaskCompleted?.();
  };

  // --- SUSPENDRE UN CM : clore une séance partielle sans terminer le cours ---
  const suspendCM = (exo, elapsedMinutes = 0) => {
    if (!reserverValidation(exo)) return;

    if (!localiserExercice(exo, 'listeCM')) {
      libererValidation(exo);
      toast.error("Ce cours n'existe plus dans le cursus. Recharge la page.");
      return;
    }

    // « Demain » selon la logique Night Owl (journée décalée de 4 h)
    const now = new Date();
    now.setHours(now.getHours() - 4);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const effectiveMinutes = dureeValidation(exo, elapsedMinutes, config);

    const newConfig = produce(configLocal, draft => {
      const cm = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];

      // Reporter à demain SANS toucher à l'état FSRS : ni derniereRevision, ni
      // jActuel, ni easeFactor, ni fsrsCard, ni repetitions.
      cm.prochaineRevisionDate = tomorrowStr;

      // Enregistrer le temps passé (même calcul que evaluateCM)
      cm.tempsMoyen = moyenneGlissante(cm.tempsMoyen, cm.nombreRevisionsTemps, effectiveMinutes);
      cm.nombreRevisionsTemps = (cm.nombreRevisionsTemps || 0) + 1;
    });

    setConfigLocal(newConfig);
    setCoursConfig(newConfig);

    addHistoriqueEntry({
      type: 'CM',
      titre: exo.titre,
      matiere: exo.matiereNom,
      action: 'Suspendu (séance partielle)',
      dureeMinutes: effectiveMinutes
    });

    // Une séance suspendue n'écrit pas `derniereRevision` : sans marquage local,
    // la carte resterait affichée comme si rien ne s'était passé.
    setValidees(prev => new Set(prev).add(cleExercice(exo)));

    resetGlobalChrono();
    setTempsDejaTravaille(prev => prev + effectiveMinutes);
    notifyTaskCompleted?.();
    toast.success(`⏸️ Séance suspendue — "${exo.titre}" reviendra demain.`);
  };

  const ignorerAlerteFatigue = () => {
    setFatigueCounter(0);
    // Télémétrie : envoi opportuniste, un échec ne doit pas gêner l'utilisateur.
    fetch(`${getApiUrl()}/telemetry/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'ignored_fatigue_alert',
        taskContext: { fatigueCounter }
      })
    }).catch(e => logger.error("Erreur télémétrie:", e));
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  // --- Situations particulières, de la plus bloquante à la plus ordinaire ---
  const enChargement = tachesOrchestrateur === null && !orchestratorData;
  const statut = orchestratorData?.statut;
  const enRepos = statut === 'REPOS' || statut === 'REPOS_OPTIONNEL';
  const cursusVide = !configLocal.licences?.some(
    l => l.semestres?.some(s => s.ues?.some(u => u.matieres?.length > 0))
  );

  const renderContenu = () => {
    if (enChargement) {
      return (
        <div className="session-chargement">
          <div className="loading-spinner" role="status" aria-label="Chargement de la session" />
        </div>
      );
    }

    if (orchestratorData?.error) {
      return (
        <Carte>
          <EtatVide
            icone="📡"
            titre="Planificateur injoignable"
            texte="Le serveur ELPIS n'a pas répondu. Vérifie qu'il est démarré, puis relance la recherche."
            actions={
              <Bouton variante="primaire" grand onClick={() => fetchOrchestrator({ fillGap: dailyFillGap, extraTime: 0 })}>
                Réessayer
              </Bouton>
            }
          />
        </Carte>
      );
    }

    // Un jour de repos affichait « Tout est terminé ! », ce qui laissait croire
    // que le programme de la journée avait été accompli.
    if (enRepos && remainingExercises.length === 0) {
      return (
        <Carte>
          <EtatVide
            icone="☕"
            titre="Journée de repos"
            texte={orchestratorData?.message || "Aucune séance n'est prévue aujourd'hui. La récupération fait partie du programme."}
            actions={
              <Bouton grand onClick={() => useStore.getState().setActiveTab('dashboard')}>
                Retour à l'accueil
              </Bouton>
            }
          />
        </Carte>
      );
    }

    // Premier lancement : aucun cours enregistré. Annoncer « Tout est terminé ! »
    // à quelqu'un qui n'a encore rien saisi n'a aucun sens.
    if (cursusVide && remainingExercises.length === 0) {
      return (
        <Carte>
          <EtatVide
            icone="📚"
            titre="Aucun cours enregistré"
            texte="Ajoute tes matières et tes cours dans la Bibliothèque : le planificateur construira ta première session dès qu'il aura de quoi travailler."
            actions={
              <Rang serre>
                <Bouton variante="primaire" grand onClick={() => useStore.getState().setActiveTab('cours')}>
                  Ouvrir la Bibliothèque
                </Bouton>
                <Bouton grand onClick={() => useStore.getState().setActiveTab('config')}>
                  Régler mes disponibilités
                </Bouton>
              </Rang>
            }
          />
        </Carte>
      );
    }

    if (remainingExercises.length === 0) {
      return (
        <Carte>
          <EtatVide
            icone="🏆"
            titre="Tout est terminé !"
            texte="Tu as accompli toutes les tâches prévues aujourd'hui. Le reste de la journée t'appartient."
            actions={
              <Rang serre>
                {!dailyFillGap && (
                  <Bouton
                    variante="primaire"
                    grand
                    onClick={() => {
                      setDailyFillGap(true);
                      toast.info('Recherche de tâches supplémentaires…');
                    }}
                  >
                    Demander plus de tâches
                  </Bouton>
                )}
                <Bouton grand onClick={() => useStore.getState().setActiveTab('revisions_avancees')}>
                  Aller dans Avance & Bonus
                </Bouton>
              </Rang>
            }
          />
        </Carte>
      );
    }

    // Le filtre actif masque tout ce qui reste.
    if (exercicesDuJour.length === 0) {
      return (
        <Carte>
          <EtatVide
            icone="🔍"
            titre={`Rien à faire en ${filterMatiere}`}
            texte={`Il reste ${remainingExercises.length} ${pluriel(remainingExercises.length, 'exercice')} dans les autres matières.`}
            actions={
              <Bouton variante="primaire" onClick={() => setFilterMatiere('all')}>
                Voir tous les exercices
              </Bouton>
            }
          />
        </Carte>
      );
    }

    return (
      <div className="session-fil entrainement-timeline">
        <AnimatePresence>
          {exercicesDuJour.map((exo) => (
            <motion.div
              // Clé stable : y inclure l'index faisait remonter toutes les cartes
              // suivantes à chaque validation, réinitialisant leur chronomètre.
              key={cleExercice(exo)}
              className="session-fil__element"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="timeline-connector" />
              <div className="timeline-dot" />
              <ExerciceCard
                exo={exo}
                matiereNom={exo.matiereNom}
                notebookLMLink={exo.notebookLMLink}
                onMarkAsDone={markAsDone}
                onEvaluateCM={evaluateCM}
                onSuspendCM={exo.horsCursus ? undefined : suspendCM}
                ankiDeckName={exo.ankiDeckName}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="session-page entrainement-page">
      <div className="session-entete">
        <TitrePage>Session du jour</TitrePage>
        <span className="session-entete__reste">
          {remainingExercises.length} {pluriel(remainingExercises.length, 'exercice')} {pluriel(remainingExercises.length, 'restant')}
        </span>
      </div>

      {/* === Avancement de la session === */}
      {totalSession > 0 && (
        <div className="session-avancement">
          <CircularProgress
            percent={progressPercent}
            size={80}
            strokeWidth={8}
            libelle="Progression de la session du jour"
          />
          <div>
            <div className={`session-avancement__etat${progressPercent === 100 ? ' est-terminee' : ''}`}>
              {progressPercent === 100
                ? 'Session terminée'
                : `${remainingExercises.length} ${pluriel(remainingExercises.length, 'exercice')} ${pluriel(remainingExercises.length, 'restant')}`}
            </div>
            <div className="session-avancement__detail">
              {faitesSession} sur {totalSession} {pluriel(totalSession, 'tâche')} de la session du jour
              {bonusHorsSession > 0 && ` · ${bonusHorsSession} en bonus`}
            </div>
          </div>
        </div>
      )}

      {/* === Alerte de fatigue cognitive === */}
      <AnimatePresence>
        {fatigueCounter >= 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div role="alert" className="session-fatigue">
              <div className="session-fatigue__corps">
                <div className="session-fatigue__titre">Signes de fatigue</div>
                <div className="session-fatigue__texte">
                  Les derniers exercices ont pris plus de temps que d'habitude, ou tu les as
                  jugés difficiles plusieurs fois de suite. Une pause de 15 minutes, ou un
                  changement de matière, sera plus efficace que d'insister.
                </div>
              </div>
              <Bouton onClick={ignorerAlerteFatigue}>Ignorer</Bouton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Filtre par matière === */}
      {matiereNames.length > 1 && remainingExercises.length > 0 && (
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill ${filterMatiere === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMatiere('all')}
            aria-pressed={filterMatiere === 'all'}
          >
            Tout ({remainingExercises.length})
          </button>
          {matiereNames.map(name => {
            const count = remainingExercises.filter(e => e.matiereNom === name).length;
            if (count === 0) return null;
            return (
              <button
                type="button"
                key={name}
                className={`filter-pill ${filterMatiere === name ? 'active' : ''}`}
                onClick={() => setFilterMatiere(name)}
                aria-pressed={filterMatiere === name}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* === Temps travaillé aujourd'hui === */}
      {tempsDispoMin > 0 && (
        <div className="tdb-progression">
          <div className="tdb-progression__chiffres">
            <span>
              <strong>{Math.floor(tempsDejaTravaille / 60)}h{String(tempsDejaTravaille % 60).padStart(2, '0')}</strong> travaillées
            </span>
            <span>
              objectif <strong>{Math.floor(tempsDispoMin / 60)}h{String(tempsDispoMin % 60).padStart(2, '0')}</strong>
            </span>
          </div>
          <Jauge
            valeur={tempsDejaTravaille}
            max={tempsDispoMin}
            ton={tempsDejaTravaille >= tempsDispoMin ? 'succes' : undefined}
            libelle="Temps travaillé par rapport à l'objectif du jour"
          />
        </div>
      )}

      {renderContenu()}
    </div>
  );
}

export default EntrainementPage;
