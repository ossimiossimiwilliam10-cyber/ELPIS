import { useState, useMemo, useEffect } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { useToast } from './ToastProvider';
import { evaluateFSRS, migrateToFSRSCard, Rating } from './fsrsEngine';
import ExerciceCard from './components/cours/ExerciceCard';

const CircularProgress = ({ percent, size = 64, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-progress-circle">
        <circle
          className="circular-progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          className="circular-progress-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <div className="circular-progress-text" style={{ fontSize: size * 0.25 }}>
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {percent}%
        </motion.span>
      </div>
    </div>
  );
};

function EntrainementPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry, config, setConfig, resetGlobalChrono, dailyFillGap, setDailyFillGap, intelligence, orchestratorData, fetchOrchestrator } = useStore();
  const { toast } = useToast();
  const [fatigueCounter, setFatigueCounter] = useState(0);

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const [configLocal, setConfigLocal] = useState(() => {
    if (coursConfig && coursConfig.licences) return JSON.parse(JSON.stringify(coursConfig));
    return { licences: [] };
  });
  const [filterMatiere, setFilterMatiere] = useState('all');
  const [tachesOrchestrateur, setTachesOrchestrateur] = useState(null);
  const [tempsDejaTravaille, setTempsDejaTravaille] = useState(0);
  const [tempsDispoMin, setTempsDispoMin] = useState(0);

  useEffect(() => {
    fetchOrchestrator({ fillGap: dailyFillGap, extraTime: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursConfig, dailyFillGap]);

  const [prevOrchestratorData, setPrevOrchestratorData] = useState(null);
  if (orchestratorData !== prevOrchestratorData) {
    setPrevOrchestratorData(orchestratorData);
    if (orchestratorData) {
      if (orchestratorData.tachesDuJour) {
        setTachesOrchestrateur(orchestratorData.tachesDuJour);
      }
      setTempsDejaTravaille(orchestratorData.tempsDejaTravailleMin || 0);
      setTempsDispoMin(orchestratorData.tempsDispoMin || 0);
    }
  }

  // Resynchroniser le state local quand le parent change
  const [prevCoursConfig, setPrevCoursConfig] = useState(null);
  if (coursConfig !== prevCoursConfig) {
    setPrevCoursConfig(coursConfig);
    if (coursConfig && coursConfig.licences) {
      setConfigLocal(coursConfig);
    }
  }

  // Filtered exercises directly matching the orchestrator
  const strategicExercices = useMemo(() => {
    if (!tachesOrchestrateur) return [];
    
    let exosToReview = [];
    
    const ankiTask = tachesOrchestrateur.find(t => t.type === 'ANKI');
    if (ankiTask) {
       exosToReview.push({
           type: 'ANKI',
           titre: ankiTask.titre,
           matiereNom: 'Routine',
           dureeMinutes: ankiTask.dureeMinutes,
           id: 'anki_task'
       });
    }

    configLocal.licences?.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            const extractAndFilter = (listeExos, type) => {
               if (!listeExos) return;
               listeExos.forEach((ex, exIndex) => {
                 const isInOrchestrator = tachesOrchestrateur.some(t => 
                   t.matiere === m.nom && t.type === type && t.titre === ex.titre
                 );
                 if (isInOrchestrator) {
                   exosToReview.push({
                     ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom, notebookLMLink: m.notebookLMLink
                   });
                 }
               });
            };
            extractAndFilter(m.listeTD, 'TD');
            extractAndFilter(m.listeTP, 'TP');
            extractAndFilter(m.listeCM, 'CM');
            extractAndFilter(m.listeAnnales, 'ANNALE');
          });
        });
      });
    });
    return exosToReview;
  }, [configLocal, tachesOrchestrateur]);

  // Get unique matiere names for filter pills
  const matiereNames = useMemo(() => {
    const names = new Set();
    strategicExercices.forEach(ex => names.add(ex.matiereNom));
    return Array.from(names);
  }, [strategicExercices]);

  // Remaining exercises
  const remainingExercises = useMemo(() => {
    const todayStr = getTodayStr();
    return strategicExercices.filter(exo => {
      if (exo.type === 'ANKI') return config?.dernierePratiqueAnki !== todayStr;
      if (exo.type === 'CM') return exo.derniereRevision !== todayStr;
      return exo.dernierePratique !== todayStr;
    });
  }, [strategicExercices, config]);

  // Filtered exercises
  const exercicesDuJour = useMemo(() => {
    if (filterMatiere === 'all') return remainingExercises;
    return remainingExercises.filter(ex => ex.matiereNom === filterMatiere);
  }, [remainingExercises, filterMatiere]);

  // Count total (including already completed today)
  const totalExercisesToday = useMemo(() => {
    let completedToday = 0;
    const todayStr = getTodayStr();
    
    if (config?.dernierePratiqueAnki === todayStr) {
      completedToday += 1;
    }

    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.listeTD) completedToday += m.listeTD.filter(td => td.dernierePratique === todayStr).length;
            if (m.listeTP) completedToday += m.listeTP.filter(tp => tp.dernierePratique === todayStr).length;
            if (m.listeAnnales) completedToday += m.listeAnnales.filter(a => a.dernierePratique === todayStr).length;
            if (m.listeCM) completedToday += m.listeCM.filter(cm => cm.derniereRevision === todayStr).length;
          });
        });
      });
    });
    return completedToday + remainingExercises.length;
  }, [configLocal, config, remainingExercises]);

  const evaluateCM = (exo, score, elapsedMinutes = 0) => {
    let finalJActuel = 0;
    let finalEaseFactor = 2.5;
    let finalEffectiveMinutes = 0;

    const newConf = produce(coursConfig, draft => {
      const cm = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];
    
    let finalScore = score;
    
    // --- PÉNALITÉ / BONUS TEMPOREL ---
    if (elapsedMinutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
      const ratio = elapsedMinutes / cm.tempsMoyen;
      if (ratio > 1.5 && finalScore > 1) finalScore -= 1;
      if (ratio > 2.0 && finalScore > 1) finalScore -= 1;
      if (ratio < 0.5 && finalScore < 4) finalScore += 1;
    }

    if (cm.derniereRevision) {
      // Pour une éventuelle logique future basée sur actualDaysElapsed
      // const todayStrLocal = getTodayStr();
      // const revDate = new Date(cm.derniereRevision + 'T00:00:00');
      // const nowDate = new Date(todayStrLocal + 'T00:00:00');
      // actualDaysElapsed = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));
    }

    // AXE 9: Personalized Decay Multiplier
    let personalizedDecayMultiplier = 1.0;
    if (intelligence?.velocityMap && exo.matiereNom) {
       const vData = intelligence.velocityMap[exo.matiereNom];
       if (vData && vData.isSlowLearner) {
          personalizedDecayMultiplier = 0.8; // Fragile subject -> retain more often
       } else if (vData && vData.avgSessionsToMaster && vData.avgSessionsToMaster <= 2) {
          personalizedDecayMultiplier = 1.2; // Fast learner -> retain less often
       }
    }

    // AXE 7: Fatigue tracking
    const expectedDuration = cm.jActuel === 0 ? (config?.defaultDurationNewCM || 120) : (config?.defaultDurationRevCM || 30);
    if (finalScore <= 2 || (elapsedMinutes > 0 && elapsedMinutes > expectedDuration * 1.5)) {
      setFatigueCounter(prev => prev + 1);
    } else if (finalScore === 4) {
      setFatigueCounter(0); // Good shape
    }

    // --- FSRS : Migration ou récupération de la carte ---
    let fsrsCard = cm.fsrsCard ? { ...cm.fsrsCard } : migrateToFSRSCard(cm);
    // Reconvertir les dates sérialisées (JSON → Date)
    if (typeof fsrsCard.due === 'string') fsrsCard.due = new Date(fsrsCard.due);
    if (typeof fsrsCard.last_review === 'string') fsrsCard.last_review = new Date(fsrsCard.last_review);

    // Mapper le score ELPIS (1-4) vers le Rating FSRS
    const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
    const fsrsRating = ratingMap[finalScore] || Rating.Good;

    // Évaluation FSRS
    const newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);

    // Stocker la carte FSRS complète pour les prochaines itérations
    cm.fsrsCard = newCard;

    // Rétrocompatibilité : maintenir les champs SM-2 pour l'orchestrateur et le reste de l'app
    cm.jActuel = newCard.scheduled_days || 1;
    cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3; // Approximation EF depuis difficulty FSRS
    cm.repetitions = newCard.reps;
    cm.prochaineRevisionDate = newCard.due instanceof Date
      ? newCard.due.toISOString().split('T')[0]
      : new Date(newCard.due).toISOString().split('T')[0];
    
    const today = getTodayStr();
    cm.derniereRevision = today;
    
    // Update tempsMoyen: use elapsedMinutes if > 0, otherwise use default duration
    let effectiveMinutes = elapsedMinutes;
    if (effectiveMinutes <= 0) {
      effectiveMinutes = (cm.jActuel === 0) ? (config?.defaultDurationNewCM || 120) : (config?.defaultDurationRevCM || 30);
    }
    
    const currentAvg = cm.tempsMoyen || 0;
    const currentCount = cm.nombreRevisionsTemps || 0;
    cm.tempsMoyen = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
    cm.nombreRevisionsTemps = currentCount + 1;

    // Capturer les valeurs avant la fermeture du scope produce
    finalJActuel = cm.jActuel;
    finalEaseFactor = cm.easeFactor;
    finalEffectiveMinutes = effectiveMinutes;
    });

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#ffffff']
    });

    setConfigLocal(newConf);
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: 'CM',
      titre: exo.titre,
      matiere: exo.matiereNom,
      action: `Révisé (J${finalJActuel})`,
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : (config?.defaultDurationRevCM || 30),
      easeFactor: finalEaseFactor
    });
    setTempsDejaTravaille(prev => prev + finalEffectiveMinutes);
  };

  const markAsDone = (exo, difficulte = "", elapsedMinutes = 0) => {
    const todayStr = getTodayStr();
    let effectiveMinutes = elapsedMinutes > 0 ? elapsedMinutes : (exo.tempsMoyen || 30);

    let actionLabel = 'Terminé';

    if (exo.type === 'ANKI') {
      setConfig({ ...config, dernierePratiqueAnki: todayStr });
      addHistoriqueEntry({
        type: 'ANKI',
        titre: exo.titre,
        matiere: exo.matiereNom,
        action: 'Terminé',
        dureeMinutes: effectiveMinutes || (config.defaultDurationAnki || 30)
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#818CF8', '#34D399', '#FBBF24']
      });
      resetGlobalChrono();
      setTempsDejaTravaille(prev => prev + effectiveMinutes);
      setTimeout(() => fetchOrchestrator({ fillGap: dailyFillGap, extraTime: 0 }), 600);
      return;
    }

    // Vérifier que les indices sont toujours valides (la config a pu changer)
    const licence = configLocal.licences?.[exo.lIndex];
    const semestre = licence?.semestres?.[exo.sIndex];
    const ue = semestre?.ues?.[exo.uIndex];
    const matiere = ue?.matieres?.[exo.mIndex];
    if (!matiere) {
      toast.error("Configuration modifiée. Recharge la page.");
      return;
    }

    const newConfig = produce(configLocal, draft => {
      let targetList;
      if (exo.type === 'TD') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD;
      else if (exo.type === 'TP') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;
      else if (exo.type === 'ANNALE') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeAnnales;

      const currentExo = targetList[exo.exIndex];
      currentExo.dernierePratique = todayStr;
      currentExo.nombrePratiques = (currentExo.nombrePratiques || 0) + 1;
      
      if (exo.type === 'ANNALE' && difficulte !== "") {
        // Pour les Annales, 'difficulte' contient en fait la note sur 20
        const note = parseFloat(difficulte);
        if (!isNaN(note)) {
          currentExo.derniereNote = note;
          actionLabel = `Terminé (Note: ${note}/20)`;
          if (note >= 18) currentExo.difficulte = 'tres_facile';
          else if (note >= 15) currentExo.difficulte = 'facile';
          else if (note >= 11) currentExo.difficulte = 'moyen';
          else if (note >= 9) currentExo.difficulte = 'assez_difficile';
          else currentExo.difficulte = 'difficile';
        }
      } else if (difficulte) {
        currentExo.difficulte = difficulte;
      }
      
      let effectiveMinutes = elapsedMinutes;
      if (effectiveMinutes <= 0) {
        if (exo.type === 'TD') effectiveMinutes = config?.defaultDurationTD || 20;
        else if (exo.type === 'TP') {
          const stepIndex = (currentExo.nombrePratiques || 1) - 1;
          const TP_STEP_DURATIONS = [
            config?.defaultDurationTP_Etape1 || 45, 
            config?.defaultDurationTP_Etape2 || 180, 
            config?.defaultDurationTP_Etape3 || 90, 
            config?.defaultDurationTP_Etape4 || 30
          ];
          effectiveMinutes = TP_STEP_DURATIONS[stepIndex] || 30;
        }
        else if (exo.type === 'ANNALE') effectiveMinutes = config?.defaultDurationAnnales || 60;
      }
      
      if (exo.type === 'TP') {
        const stepIndex = (currentExo.nombrePratiques || 1) - 1;
        if (!currentExo.tempsMoyenEtapes) {
          currentExo.tempsMoyenEtapes = [];
        }
        while(currentExo.tempsMoyenEtapes.length <= stepIndex) currentExo.tempsMoyenEtapes.push(null);
        
        if (!currentExo.nombreRevisionsEtapes) {
          currentExo.nombreRevisionsEtapes = [];
        }
        while(currentExo.nombreRevisionsEtapes.length <= stepIndex) currentExo.nombreRevisionsEtapes.push(0);
        
        const currentAvg = currentExo.tempsMoyenEtapes[stepIndex] || 0;
        const currentCount = currentExo.nombreRevisionsEtapes[stepIndex] || 0;
        currentExo.tempsMoyenEtapes[stepIndex] = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
        currentExo.nombreRevisionsEtapes[stepIndex] = currentCount + 1;
      } else {
        const currentAvg = currentExo.tempsMoyen || 0;
        const currentCount = currentExo.nombreRevisionsTemps || 0;
        currentExo.tempsMoyen = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
        currentExo.nombreRevisionsTemps = currentCount + 1;
      }
      
      // AXE 7: Fatigue Tracking for TP/TD/Annales
      let expectedDur = 30;
      if (exo.type === 'TD') expectedDur = config?.defaultDurationTD || 20;
      else if (exo.type === 'TP') expectedDur = config?.defaultDurationTP || 45;
      else if (exo.type === 'ANNALE') expectedDur = config?.defaultDurationAnnales || 60;
      
      if (difficulte === 'difficile' || (elapsedMinutes > 0 && elapsedMinutes > expectedDur * 1.5)) {
         setFatigueCounter(prev => prev + 1);
      } else if (difficulte === 'tres_facile') {
         setFatigueCounter(0);
      }
    });
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : exo.type === 'TP' ? ['#FBBF24', '#ffffff'] : ['#ef4444', '#ffffff']
    });

    setConfigLocal(newConfig);
    setCoursConfig(newConfig);
    let fallbackDuration = 30;
    if (exo.type === 'TD') fallbackDuration = config?.defaultDurationTD || 20;
    else if (exo.type === 'TP') fallbackDuration = config?.defaultDurationTP || 30;
    else if (exo.type === 'ANNALE') fallbackDuration = config?.defaultDurationAnnales || 60;

    // Find updated exo for history entry
    const updatedExo = newConfig.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex][
      exo.type === 'TD' ? 'listeTD' : exo.type === 'TP' ? 'listeTP' : 'listeAnnales'
    ][exo.exIndex];

    addHistoriqueEntry({
      type: exo.type,
      titre: updatedExo.titre,
      matiere: exo.matiereNom,
      action: actionLabel,
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : fallbackDuration
    });
    setTempsDejaTravaille(prev => prev + (elapsedMinutes > 0 ? elapsedMinutes : fallbackDuration));
  };

  // Progression : cible du jour - restants = déjà faits
  const progressPercent = totalExercisesToday > 0
    ? Math.round(((totalExercisesToday - remainingExercises.length) / totalExercisesToday) * 100)
    : 0;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  return (
    <div className="entrainement-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem'}}>
        <div style={{display:'flex', alignItems:'center', gap:'1.5rem'}}>
          <h2 style={{margin:0}}>Session du Jour</h2>
        </div>
        <span style={{color:'var(--text-secondary)'}}>{exercicesDuJour.length} exercice{exercicesDuJour.length > 1 ? 's' : ''} restant{exercicesDuJour.length > 1 ? 's' : ''}</span>
      </div>

      {/* === PROGRESS BAR === */}
      <div className="progress-header" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.12)' }}>
        <CircularProgress percent={progressPercent} size={80} strokeWidth={8} />
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: progressPercent === 100 ? 'var(--success-color)' : 'var(--text-primary)' }}>
            {progressPercent === 100 ? 'Session Terminée ! 🎉' : `${remainingExercises.length} exercice${remainingExercises.length > 1 ? 's' : ''} restant${remainingExercises.length > 1 ? 's' : ''}`}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
            Tu as complété {totalExercisesToday - remainingExercises.length} sur {totalExercisesToday} tâches pour aujourd'hui.
          </div>
        </div>
      </div>

      {/* === AXE 7: ALERTE FATIGUE === */}
      <AnimatePresence>
        {fatigueCounter >= 3 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
          >
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', padding: '1.2rem', borderRadius: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <strong style={{ fontSize: '1.1rem' }}>Fatigue Cognitive Détectée</strong>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  Tu as passé beaucoup de temps sur les derniers exercices ou cliqué répétitivement sur "Difficile". 
                  L'algorithme te conseille fortement de prendre une <strong>pause Pomodoro de 15 min</strong> ou de changer de matière (Interleaving).
                </div>
              </div>
              <button 
                onClick={() => setFatigueCounter(0)} 
                style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                Ignorer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === FILTER PILLS === */}
      {matiereNames.length > 1 && (
        <div className="filter-pills">
          <button 
            className={`filter-pill ${filterMatiere === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMatiere('all')}
          >
            Tout ({remainingExercises.length})
          </button>
          {matiereNames?.map(name => {
            const count = remainingExercises.filter(e => e.matiereNom === name).length;
            return (
              <button 
                key={name}
                className={`filter-pill ${filterMatiere === name ? 'active' : ''}`}
                onClick={() => setFilterMatiere(name)}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* PROGRESSION QUOTIDIENNE */}
      {tempsDispoMin > 0 && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--bg-tertiary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Progression de la Journée</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span>{Math.floor(tempsDejaTravaille / 60)}h{String(tempsDejaTravaille % 60).padStart(2, '0')} travaillées</span>
            <span>Objectif IA : {Math.floor(tempsDispoMin / 60)}h{String(tempsDispoMin % 60).padStart(2, '0')}</span>
          </div>
          <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: tempsDejaTravaille >= tempsDispoMin ? 'var(--success-color)' : 'var(--accent-primary)',
              width: `${Math.min(100, (tempsDejaTravaille / tempsDispoMin) * 100)}%`,
              transition: 'width 0.5s ease-out'
            }} />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {exercicesDuJour.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={remainingExercises.length === 0 ? "empty-state-container" : "card glass-panel"}
            style={remainingExercises.length > 0 ? {textAlign:'center', padding:'3rem'} : {}}
          >
            {remainingExercises.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', textAlign: 'center' }}>
                {tachesOrchestrateur === null ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <div className="empty-state-icon">🏆</div>
                    <h3 style={{color:'var(--success-color)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Tout est terminé !</h3>
                    <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>Tu as accompli toutes les tâches demandées par l'orchestrateur. Repose-toi bien !</p>
                    {tempsDejaTravaille < tempsDispoMin && !dailyFillGap && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setDailyFillGap(true);
                          toast("Recherche de tâches supplémentaires en cours...", "info");
                        }}
                        className="btn-primary"
                        style={{ marginTop: '2rem', background: 'var(--accent-primary)', padding: '1rem 2rem', fontSize: '1.1rem' }}
                      >
                        🔥 Demander plus de tâches à l'IA
                      </motion.button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔍</div>
                <h3>Aucun exercice pour "{filterMatiere}"</h3>
                <p style={{color:'var(--text-secondary)'}}>
                  Essaie un autre filtre ou clique sur "Tout" pour voir tous les exercices.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <div className="entrainement-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            <AnimatePresence>
              {exercicesDuJour?.map((exo, index) => (
                <motion.div 
                  key={`${exo.matiereNom}-${exo.titre}-${index}`}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{ position: 'relative', paddingLeft: '30px' }}
                >
                  <div className="timeline-connector"></div>
                  <div className="timeline-dot"></div>
                  <ExerciceCard 
                    exo={exo}
                    matiereNom={exo.matiereNom}
                    notebookLMLink={exo.notebookLMLink}
                    onMarkAsDone={(passedExo, difficulte, elapsedMinutes) => markAsDone(passedExo, difficulte, elapsedMinutes)}
                    onEvaluateCM={(passedExo, score, elapsedMinutes) => evaluateCM(passedExo, score, elapsedMinutes)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EntrainementPage;
