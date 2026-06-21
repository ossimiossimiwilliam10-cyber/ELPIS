import { useState, useEffect, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { evaluateFSRS, migrateToFSRSCard, Rating } from './fsrsEngine';
import { useWorkloadEngine } from './useWorkloadEngine';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from './ToastProvider';
import CMCompletionModal from './components/CMCompletionModal';
import InfoTooltip from './components/InfoTooltip';
import { DIFFICULTY_LEVELS } from './constants';

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

function Dashboard() {
  const { config, setConfig, coursConfig, setCoursConfig, addHistoriqueEntry, activateRestDay, dailyFillGap, setDailyFillGap, orchestratorData, intelligence, fetchOrchestrator } = useStore();
  const [orderedTaches, setOrderedTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraTime, setExtraTime] = useState(0);
  const { toast } = useToast();
  
  // CM modal state
  const [cmModalOpen, setCmModalOpen] = useState(false);
  const [pendingCMTask, setPendingCMTask] = useState(null);

  const recommendedDailyHours = useWorkloadEngine();

  const getRestDaysUsed = () => {
    if (!config || !config.restDays) return 0;
    const now = new Date();
    now.setHours(now.getHours() - 4); // Night Owl
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0,0,0,0);
    return config.restDays.filter(d => {
      const date = new Date(d + 'T00:00:00');
      return date >= startOfWeek;
    }).length;
  };

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const restDaysUsed = getRestDaysUsed();
  const todayStr = getTodayStr();
  const isRestDayToday = config?.restDays?.includes(todayStr);

  // Fetch orchestrator via store (global) — triggers on param changes
  useEffect(() => {
    const doFetch = async () => {
      try {
        await fetchOrchestrator({ extraTime, fillGap: dailyFillGap });
      } catch (err) {
        console.error(err);
        toast.error("Impossible de charger le planning. Vérifie que le serveur est lancé.");
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursConfig, extraTime, dailyFillGap, fetchOrchestrator]);

  const [prevOrchestratorData, setPrevOrchestratorData] = useState(null);
  if (orchestratorData !== prevOrchestratorData) {
    setPrevOrchestratorData(orchestratorData);
    if (orchestratorData?.tachesDuJour) {
      setOrderedTaches(orchestratorData.tachesDuJour);
    }
  }

  const handleAddExtraTime = () => {
    const newTime = extraTime + 30;
    setExtraTime(newTime);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedTaches);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedTaches(items);
  };

  const handleTaskComplete = (tache, difficulte = "") => {
    if (!coursConfig) return;
    
    // For CM tasks, open the mini-modal to capture real time and retention score
    if (tache.type === 'CM') {
      setPendingCMTask(tache);
      setCmModalOpen(true);
      return;
    }
    
    const today = getTodayStr();

    let taskFound = false;
    
    if (tache.type === 'ANKI') {
      setConfig({ ...config, dernierePratiqueAnki: today });
      taskFound = true;
    } else {
      const configLocal = coursConfig;
      const newConfig = produce(configLocal, draft => {
      draft.licences.forEach(licence =>
        licence.semestres.forEach(semestre =>
          semestre.ues.forEach(ue =>
            ue.matieres.forEach(matiere => {
              if (matiere.nom !== tache.matiere) return;
              if (tache.type === 'TD') {
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
    if (taskFound && tache.type !== 'ANKI') {
      setCoursConfig(newConfig);
    }
    }

    if (taskFound) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#818CF8', '#34D399', '#FBBF24']
      });
      addHistoriqueEntry({ 
        type: tache.type, 
        titre: tache.titre, 
        matiere: tache.matiere,
        action: 'Terminé',
        dureeMinutes: tache.dureeMinutes || 0
      });
    } else if (tache.type !== 'ANKI' && tache.type !== 'CM') {
      toast.error(`Tâche "${tache.titre}" introuvable. Recharge le planning.`);
    }
  };

  // Called by CMCompletionModal when user submits real time + retention score
  const handleCMComplete = useCallback(({ minutes, sm2Score }) => {
    if (!coursConfig || !pendingCMTask) return;
    const tache = pendingCMTask;
    const today = getTodayStr();

    // AXE 9: Personalized Decay Multiplier (cohérent avec EntrainementPage)
    let personalizedDecayMultiplier = 1.0;
    if (intelligence?.velocityMap && tache.matiere) {
      const vData = intelligence.velocityMap[tache.matiere];
      if (vData && vData.isSlowLearner) {
        personalizedDecayMultiplier = 0.8;
      } else if (vData && vData.avgSessionsToMaster && vData.avgSessionsToMaster <= 2) {
        personalizedDecayMultiplier = 1.2;
      }
    }

    let finalScore = sm2Score;

    const newConfig = produce(coursConfig, draft => {
      draft.licences.forEach(licence =>
        licence.semestres.forEach(semestre =>
          semestre.ues.forEach(ue =>
            ue.matieres.forEach(matiere => {
              if (matiere.nom !== tache.matiere) return;
              matiere.listeCM.forEach(cm => {
                if (cm.titre !== tache.titre) return;

                // --- Pénalité / Bonus Temporel (cohérent avec EntrainementPage) ---
                if (minutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
                  const ratio = minutes / cm.tempsMoyen;
                  if (ratio > 1.5 && finalScore > 1) finalScore -= 1;
                  if (ratio > 2.0 && finalScore > 1) finalScore -= 1;
                  if (ratio < 0.5 && finalScore < 4) finalScore += 1;
                }

                // --- FSRS : Migration ou récupération de la carte ---
                let fsrsCard = cm.fsrsCard ? { ...cm.fsrsCard } : migrateToFSRSCard(cm);
                if (typeof fsrsCard.due === 'string') fsrsCard.due = new Date(fsrsCard.due);
                if (typeof fsrsCard.last_review === 'string') fsrsCard.last_review = new Date(fsrsCard.last_review);

                const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
                const fsrsRating = ratingMap[finalScore] || Rating.Good;

                const newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);
                cm.fsrsCard = newCard;

                // Rétrocompatibilité SM-2
                cm.jActuel = newCard.scheduled_days || 1;
                cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3;
                cm.repetitions = newCard.reps;
                cm.derniereRevision = today;
                cm.prochaineRevisionDate = newCard.due instanceof Date
                  ? newCard.due.toISOString().split('T')[0]
                  : new Date(newCard.due).toISOString().split('T')[0];
                // Tracking tempsMoyen with real elapsed minutes
                const currentAvg = cm.tempsMoyen || 0;
                const currentCount = cm.nombreRevisionsTemps || 0;
                cm.tempsMoyen = ((currentAvg * currentCount) + minutes) / (currentCount + 1);
                cm.nombreRevisionsTemps = currentCount + 1;
              });
            })
          )
        )
      );
    });

    setCoursConfig(newConfig);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#818CF8', '#34D399', '#FBBF24']
    });
    addHistoriqueEntry({
      type: 'CM',
      titre: tache.titre,
      matiere: tache.matiere,
      action: `Révisé (${finalScore}/4)`,
      dureeMinutes: minutes
    });
    setPendingCMTask(null);
  }, [coursConfig, pendingCMTask, setCoursConfig, addHistoriqueEntry, intelligence]);

  // Dynamic greeting (must be before early returns)
  const hour = new Date().getHours();
  let greeting = 'Bonsoir';
  if (hour >= 5 && hour < 12) greeting = 'Bonjour';
  else if (hour >= 12 && hour < 18) greeting = 'Bon après-midi';

  const stats = useMemo(() => {
    if (!coursConfig) return { total: 0, done: 0, perMatiere: [] };
    let total = 0;
    let done = 0;
    let perMatiere = [];

    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            let mTotal = 0;
            let mDone = 0;
            if (m.listeCM) { mTotal += m.listeCM.length; mDone += m.listeCM.filter(cm => cm.jActuel > 0).length; }
            if (m.listeTD) { mTotal += m.listeTD.length; mDone += m.listeTD.filter(td => td.nombrePratiques > 0).length; }
            if (m.listeTP) { mTotal += m.listeTP.length; mDone += m.listeTP.filter(tp => tp.nombrePratiques > 0).length; }
            if (m.listeAnnales) { mTotal += m.listeAnnales.length; mDone += m.listeAnnales.filter(a => a.nombrePratiques > 0).length; }
            total += mTotal;
            done += mDone;
            if (mTotal > 0) perMatiere.push({ nom: m.nom, total: mTotal, done: mDone, percent: Math.round((mDone/mTotal)*100) });
          });
        });
      });
    });
    return { total, done, perMatiere };
  }, [coursConfig]);
  
  const globalPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div style={{textAlign:'center', marginTop:'5rem'}}>
        Analyse des données en cours...
      </div>
    );
  }

  if (!orchestratorData || orchestratorData.error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card glass-panel" 
        style={{textAlign:'center', marginTop:'3rem'}}
      >
        <h2>{greeting} ! Bienvenue sur ELPIS</h2>
        <p style={{color:'var(--text-secondary)'}}>Configure tes objectifs et tes cours pour activer l'Orchestrateur.</p>
      </motion.div>
    );
  }

  const { statut, tempsDispoMin, tempsRequisMin } = orchestratorData;
  const surcharge = statut === "SURCHARGE";
  const pourcentageCharge = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <motion.div 
      className="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* === WELCOME CARD === */}
      <div className="welcome-card">
        <div>
          <h2>{greeting} ! 👋</h2>
          <p>
            {orderedTaches.length > 0 
              ? `Tu as ${orderedTaches.length} objectif${orderedTaches.length > 1 ? 's' : ''} à accomplir aujourd'hui.`
              : "Tu as tout terminé pour aujourd'hui. Bravo !"}
          </p>
        </div>
        <div className="welcome-stats" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="welcome-stat">
            <div className="welcome-stat-value" style={{color: 'var(--success-color)'}}>{recommendedDailyHours}h</div>
            <div className="welcome-stat-label"><InfoTooltip content="Calculé dynamiquement par le moteur de charge selon tes coefficients et les jours restants avant l'examen.">Cible IA <span style={{fontSize:'0.8rem'}}>ℹ️</span></InfoTooltip></div>
          </div>
          <div className="welcome-stat">
            <div className="welcome-stat-value">{orderedTaches.length}</div>
            <div className="welcome-stat-label">Tâches</div>
          </div>
          <div className="welcome-stat">
            <div className="welcome-stat-value">{Math.round(tempsRequisMin/60 * 10)/10}h</div>
            <div className="welcome-stat-label"><InfoTooltip content="Temps total estimé par l'Orchestrateur pour accomplir toutes les tâches planifiées aujourd'hui.">Requis <span style={{fontSize:'0.8rem'}}>ℹ️</span></InfoTooltip></div>
          </div>
          <div className="welcome-stat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <CircularProgress percent={globalPercent} />
            <div className="welcome-stat-label"><InfoTooltip content="Pourcentage global d'avancement (tous cours et exercices confondus).">Global <span style={{fontSize:'0.8rem'}}>ℹ️</span></InfoTooltip></div>
          </div>
          <div className="welcome-stat" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="welcome-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F59E0B' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))', fontSize: '2rem', animation: 'float 4s ease-in-out infinite' }}>🔥</span> 
              <span style={{ fontSize: '2.4rem' }}>{config?.currentStreak || 0}</span>
            </div>
            <div className="welcome-stat-label" style={{ color: 'var(--text-secondary)' }}><InfoTooltip content="Le nombre de jours consécutifs où tu as validé une tâche ou pris un jour de repos autorisé. Ne brise pas la chaîne !">Record : {config?.bestStreak || 0} <span style={{fontSize:'0.8rem'}}>ℹ️</span></InfoTooltip></div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'1rem', gap: '1rem'}}>
        {statut !== "REPOS" && !isRestDayToday && (
          <button 
            className="btn-secondary" 
            onClick={() => {
              if (window.confirm(`Activer un jour de repos ? Il te reste ${1 - restDaysUsed} repos pour cette semaine.`)) {
                activateRestDay();
              }
            }} 
            disabled={restDaysUsed >= 1}
            style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', opacity: restDaysUsed >= 1 ? 0.5 : 1}}
            title={restDaysUsed >= 1 ? "Quota de repos (1/semaine) atteint" : "Suspendre le programme pour aujourd'hui"}
          >
            ☕ Activer Jour de Repos ({restDaysUsed}/1)
          </button>
        )}
        <button 
          className="btn-secondary" 
          onClick={() => window.print()} 
          style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}}
          title="Imprimer ou sauvegarder le planning en PDF"
        >
          Exporter PDF
        </button>
      </div>

      <div className="dashboard-grid">
        {/* === OBJECTIFS (FIRST, more prominent) === */}
        <motion.div 
          className="card glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h2>🎯 Objectifs du Jour</h2>
          
          {/* PROGRESSION QUOTIDIENNE */}
          {orchestratorData && orchestratorData.tempsDispoMin > 0 && statut !== "REPOS" && (
            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--bg-tertiary)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Progression de la Journée</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>{Math.floor((orchestratorData.tempsDejaTravailleMin || 0) / 60)}h{String((orchestratorData.tempsDejaTravailleMin || 0) % 60).padStart(2, '0')} travaillées</span>
                <span>Objectif IA : {Math.floor(orchestratorData.tempsDispoMin / 60)}h{String(orchestratorData.tempsDispoMin % 60).padStart(2, '0')}</span>
              </div>
              <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: (orchestratorData.tempsDejaTravailleMin || 0) >= orchestratorData.tempsDispoMin ? 'var(--success-color)' : 'var(--accent-primary)',
                  width: `${Math.min(100, ((orchestratorData.tempsDejaTravailleMin || 0) / orchestratorData.tempsDispoMin) * 100)}%`,
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>
          )}

          {statut === "REPOS" ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state-container"
            >
              <div className="empty-state-icon" style={{ filter: 'drop-shadow(0 10px 20px rgba(59, 130, 246, 0.3))' }}>☕</div>
              <h3 style={{color:'var(--accent-primary)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Mode Repos Activé</h3>
              <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>{orchestratorData.message}</p>
              <p style={{marginTop: '1rem', fontStyle: 'italic', fontSize: '0.95rem', opacity: 0.8}}>Les tâches prévues aujourd'hui ont été suspendues sans pénalité. Prends ce temps pour toi !</p>
              
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem'}}>
                {surcharge && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddExtraTime}
                    className="btn-primary" 
                    style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}
                  >
                    🔥 J'ai encore de l'énergie (+30 min)
                  </motion.button>
                )}
                
                {orchestratorData && (orchestratorData.tempsDejaTravailleMin || 0) < orchestratorData.tempsDispoMin && !dailyFillGap && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      toast("Génération de nouvelles tâches en cours...", "info");
                      await fetchOrchestrator({ fillGap: true, extraTime });
                    }}
                    className="btn-primary"
                    style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}
                  >
                    🔥 Demander plus de tâches
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : orderedTaches.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state-container"
            >
              <div className="empty-state-icon">✨</div>
              <h3 style={{color:'var(--success-color)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Tout est terminé !</h3>
              <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>Tu as accompli toutes tes tâches pour aujourd'hui. Profite de ton temps libre, tu l'as bien mérité !</p>
              
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem'}}>
                {surcharge && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddExtraTime}
                    className="btn-primary" 
                    style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}
                  >
                    🔥 J'ai encore de l'énergie (+30 min)
                  </motion.button>
                )}
                
                {orchestratorData && (orchestratorData.tempsDejaTravailleMin || 0) < orchestratorData.tempsDispoMin && !dailyFillGap && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setDailyFillGap(true);
                      toast("Recherche de tâches supplémentaires en cours...", "info");
                    }}
                    className="btn-primary"
                    style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}
                  >
                    🚀 Demander plus de tâches à l'IA
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="taches">
                {(provided) => (
                  <motion.div 
                    className="todo-list"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{display:'flex', flexDirection:'column', gap:'0.8rem', marginTop:'1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem'}}
                  >
                    <AnimatePresence>
                      {orderedTaches?.map((t, index) => {
                        const dragId = t.matiere + t.titre + index;
                        return (
                          <Draggable key={dragId} draggableId={dragId} index={index}>
                            {(provided) => (
                            <motion.div 
                              variants={itemVariants}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="todo-item"
                              style={{ marginLeft: '20px' }}
                            >
                              <div className="timeline-connector"></div>
                              <div className="timeline-dot"></div>
                              <div style={{flex: 1}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)'}}>
                                  <span style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                  }}>#{index + 1}</span>
                                  {t.titre}
                                </div>
                                <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                  {t.matiere} • {t.type}
                                  {t.moment === 'matin' && <span style={{marginLeft: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>🌅 Matin</span>}
                                  {t.moment === 'aprem' && <span style={{marginLeft: '0.5rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>☀️ Après-midi</span>}
                                  {t.moment === 'soir' && <span style={{marginLeft: '0.5rem', background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>🌙 Soir</span>}
                                </div>
                              </div>
                              <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flexShrink: 0}}>
                                <div style={{background:'var(--bg-tertiary)', padding:'0.3rem 0.6rem', borderRadius:'6px', fontSize:'0.8rem'}}>
                                  ~{t.dureeMinutes || 0} min
                                </div>
                                <button 
                                  onClick={() => handleTaskComplete(t)}
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: 'var(--success-color)',
                                    border: 'none',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.4)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                                >
                                  Fait
                                </button>
                                {t.type !== 'CM' && DIFFICULTY_LEVELS?.map(dl => (
                                  <button
                                    key={dl.key}
                                    onClick={() => handleTaskComplete(t, dl.key)}
                                    title={dl.title}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      padding: '0.1rem',
                                      flexShrink: 0,
                                      opacity: 0.7,
                                      transition: 'opacity 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                                  >
                                    {dl.label}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </Draggable>
                      );})}
                    </AnimatePresence>
                    {provided.placeholder}
                  </motion.div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </motion.div>

        {/* === CHARGE DU JOUR === */}
        <motion.div 
          className="card glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>⚡</div>
              <h2 style={{ margin: 0 }}>Charge du Jour</h2>
              {surcharge && (
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  RETARD ACCUMULÉ
                </span>
              )}
            </div>
          
          <div style={{marginTop:'2rem', marginBottom:'1rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
              <span style={{color:'var(--text-secondary)'}}>Prévu : <strong>{Math.round(tempsRequisMin/60 * 10)/10}h</strong></span>
              <span style={{color:'var(--text-secondary)'}}>Cible IA : <strong>{Math.round(tempsDispoMin/60 * 10)/10}h</strong></span>
            </div>
            <div className="progress-bar-container">
              <motion.div 
                className={`progress-bar-fill ${surcharge ? 'surcharge' : ''}`}
                initial={{ width: 0 }}
                animate={{ width: `${pourcentageCharge}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  backgroundColor: surcharge ? 'var(--danger-color)' : 'var(--success-color)'
                }}
              />
            </div>
          </div>
          
          {surcharge ? (
            <div style={{background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
                <p style={{color: 'var(--danger-color)', margin: 0}}>
                  <strong>⚠️ Attention :</strong> Tu as accumulé du retard sur tes révisions (CM/Annales). L'IA a étalé la charge pour te protéger, mais reste concentré pour tout rattraper !
                </p>
              </div>
          ) : (
            <div style={{background:'rgba(16, 185, 129, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--success-color)'}}>
              <strong>Équilibre parfait :</strong> Ta charge de travail est compatible avec tes objectifs de santé.
            </div>
          )}


        </motion.div>
      </div>

      {/* === INSIGHTS IA v2 === */}
      {intelligence && (
        <motion.div 
          className="card glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{ marginTop: '2rem', borderLeft: '4px solid #a78bfa', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(167, 139, 250, 0.05))' }}
        >
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa', marginBottom: '1.5rem' }}>
            🧠 Insights IA
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Burnout Risk */}
            {intelligence?.burnoutRisk && intelligence.burnoutRisk.riskLevel !== 'none' && (
              <div style={{ 
                background: intelligence.burnoutRisk.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.15)' : intelligence.burnoutRisk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                border: `1px solid ${intelligence.burnoutRisk.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.3)' : intelligence.burnoutRisk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                padding: '1rem', borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: intelligence.burnoutRisk.riskLevel === 'high' ? 'var(--danger-color)' : '#f59e0b' }}>
                  {intelligence.burnoutRisk.riskLevel === 'high' ? '🚨 Risque de Burnout Élevé' : intelligence.burnoutRisk.riskLevel === 'medium' ? '⚠️ Fatigue Détectée' : '💤 Sommeil Perturbé'}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{intelligence.burnoutRisk.reason}</div>
              </div>
            )}

            {/* Velocity Insights */}
            {intelligence?.velocityMap && (() => {
              const slowSubjects = Object.entries(intelligence.velocityMap).filter(([, v]) => v.isSlowLearner);
              if (slowSubjects.length === 0) return null;
              return (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#f59e0b' }}>🐢 Matières à Apprentissage Lent</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {slowSubjects.map(([name, v]) => (
                      <div key={name} style={{ marginBottom: '0.3rem' }}>
                        <strong>{name}</strong> — {v.avgSessionsToMaster?.toFixed(1)} sessions/CM en moyenne 
                        ({v.masteredCMs}/{v.totalCMs} CM maîtrisés, ~{Math.round(v.estimatedRemainingMinutes/60)}h restantes estimées)
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Cognitive Load Summary */}
            {intelligence?.cognitiveLoadMap && (() => {
              const heavy = Object.entries(intelligence.cognitiveLoadMap).filter(([, v]) => v.cognitiveLoad === 'heavy');
              const light = Object.entries(intelligence.cognitiveLoadMap).filter(([, v]) => v.cognitiveLoad === 'light');
              if (heavy.length === 0 && light.length === 0) return null;
              return (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#818cf8' }}>🧬 Chronobiologie Activée</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {heavy.length > 0 && <div>🌅 <strong>Matin</strong> (charge cognitive élevée) : {heavy.map(([n]) => n).join(', ')}</div>}
                    {light.length > 0 && <div>🌙 <strong>Soir</strong> (charge cognitive légère) : {light.map(([n]) => n).join(', ')}</div>}
                  </div>
                </div>
              );
            })()}

            {/* Remaining Weight */}
            {intelligence?.remainingWeightMap && (() => {
              const highRemaining = Object.entries(intelligence.remainingWeightMap)
                .filter(([, v]) => v.remainingRatio === 1 && v.totalCoef > 0)
                .sort((a, b) => b[1].totalCoef - a[1].totalCoef);
              if (highRemaining.length === 0) return null;
              return (
                <div style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--success-color)' }}>📊 Matières Sans Notes (100% du coefficient à jouer)</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {highRemaining.map(([name, v]) => (
                      <span key={name} style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                        {name} (Coef total: {v.totalCoef.toFixed(1)})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* All clear */}
            {intelligence?.burnoutRisk?.riskLevel === 'none' && (
              <div style={{ background: 'rgba(52, 211, 153, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✅ Burnout : Aucun risque détecté</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  ({intelligence.burnoutRisk.daysWithoutRest}j sans repos, {Math.round(intelligence.burnoutRisk.avgDailyMinutes/60 * 10)/10}h/jour moy.)
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* === STATISTIQUES === */}
      <motion.div 
        className="card glass-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        style={{ marginTop: '2rem' }}
      >
        <h2>Statistiques de Progression</h2>
        <div style={{display:'flex', gap:'2rem', alignItems:'center', marginBottom:'1.5rem', flexWrap: 'wrap'}}>
          <div style={{width:'100px', height:'100px', borderRadius:'50%', background:`conic-gradient(var(--success-color) ${globalPercent}%, var(--bg-tertiary) 0)`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
            <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', fontWeight:'bold', color:'var(--text-primary)'}}>
              {globalPercent}%
            </div>
          </div>
          <div>
            <h3 style={{marginTop:0}}>Progression Globale</h3>
            <p style={{color:'var(--text-secondary)'}}>{stats.done} objectifs (CM/TD/TP) réalisés sur {stats.total} programmés au total.</p>
          </div>
        </div>

        {stats.perMatiere?.length > 0 ? (
          <div className="stats-carousel" style={{display:'flex', gap:'1rem', overflowX:'auto', paddingBottom:'1rem'}}>
            {stats.perMatiere?.map(m => (
              <div key={m.nom} style={{minWidth:'250px', flexShrink:0, background:'rgba(255,255,255,0.02)', padding:'1rem', borderRadius:'8px', border:'1px solid var(--bg-tertiary)'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem'}}>
                  <strong style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={m.nom}>{m.nom}</strong>
                  <span style={{color:'var(--success-color)', fontWeight:'bold'}}>{m.percent}%</span>
                </div>
                <div className="progress-bar-container" style={{height:'6px', marginTop:0}}>
                  <div className="progress-bar-fill" style={{width:`${m.percent}%`, background:'var(--success-color)'}}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{color:'var(--text-secondary)'}}>Aucune donnée disponible. Ajoute des cours pour voir tes statistiques.</p>
        )}
      </motion.div>
      {/* === CM Completion Modal === */}
      <CMCompletionModal
        isOpen={cmModalOpen}
        onClose={() => { setCmModalOpen(false); setPendingCMTask(null); }}
        onSubmit={handleCMComplete}
        taskTitle={pendingCMTask?.titre || ''}
        defaultMinutes={pendingCMTask?.dureeMinutes || (config?.defaultDurationRevCM || 30)}
      />
    </motion.div>
  );
}

export default Dashboard;
