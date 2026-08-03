import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore, { useChronoStore } from './store';
import { useWorkloadEngine } from './useWorkloadEngine';
import { useToast } from './ToastProvider';
import { useSoundEffects } from './hooks/useSoundEffects';
import { useTaskCompletion } from './hooks/useTaskCompletion';
import { useDashboardStats } from './hooks/useDashboardStats';
import TaskCompletionModal from './components/TaskCompletionModal';
import AuditDashboard from './components/AuditDashboard';
import WelcomeCard from './components/dashboard/WelcomeCard';
import TaskList from './components/dashboard/TaskList';
import CustomTaskModal from './components/dashboard/CustomTaskModal';
import InsightsPanel from './components/dashboard/InsightsPanel';
import ProjectsWidget from './components/dashboard/ProjectsWidget';
import StatsSection from './components/dashboard/StatsSection';
import { DIFFICULTY_LEVELS } from './constants';
import { getApiUrl } from './utils/apiConfig';
import { getTodayStr } from './utils/dateUtils';
import { useICalExport } from './hooks/useICalExport';

function Dashboard() {
  const {
    config, coursConfig, loading: storeLoading, historique, projets,
    orchestratorData, fetchOrchestrator, intelligence, pendingTasksCount,
    dailyFillGap, setDailyFillGap, setConfig, addHistoriqueEntry,
    activateRestDay, activateExtendedRestDay, declineExtendedRestDay
  } = useStore();

  const { completeTask, suspendCM } = useTaskCompletion();
  const { stats, globalPercent, allMatieres, restDaysUsed, todayStr, isRestDayToday, tempsTravailleToday } = useDashboardStats();
  const recommendedDailyHours = useWorkloadEngine();
  const { toast } = useToast();
  const { playTaskComplete } = useSoundEffects();
  const { exportToICal } = useICalExport(orchestratorData);

  const [orderedTaches, setOrderedTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraTime, setExtraTime] = useState(0);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const taskModalLockRef = useRef(false);
  const [customTaskModalOpen, setCustomTaskModalOpen] = useState(false);
  const [customTaskParams, setCustomTaskParams] = useState({ titre: '', type: 'PERSO', matiere: '' });
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [acceptedRest, setAcceptedRest] = useState(false);
  const [restDayConfirmOpen, setRestDayConfirmOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // ---- Orchestrator fetch ----
  useEffect(() => {
    const doFetch = async () => {
      try {
        await fetchOrchestrator({ extraTime, fillGap: dailyFillGap });
      } catch (err) {
        toast.error("Impossible de charger le planning. Vérifie que le serveur est lancé.");
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraTime, dailyFillGap, fetchOrchestrator]);

  const [prevOrchestratorData, setPrevOrchestratorData] = useState(null);
  useEffect(() => {
    if (orchestratorData && orchestratorData !== prevOrchestratorData) {
      setPrevOrchestratorData(orchestratorData);
      if (orchestratorData?.tachesDuJour) {
        const alreadyDoneIds = new Set(historique?.filter(h => h.date === todayStr).map(h => h.tacheId) || []);
        
        const filtered = orchestratorData.tachesDuJour.filter(t => {
          if (t.type === 'ANKI' && config?.dernierePratiqueAnki === todayStr) return false;
          if (alreadyDoneIds.has(t.id)) return false;
          return true;
        });

        const savedOrderStr = sessionStorage.getItem(`elpis_task_order_${todayStr}`);
        if (savedOrderStr) {
          try {
            const savedOrder = JSON.parse(savedOrderStr);
            filtered.sort((a, b) => {
              const idxA = savedOrder.indexOf(a.id);
              const idxB = savedOrder.indexOf(b.id);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            });
          } catch(e) {}
        }

        setOrderedTaches(filtered);
      }
    }
  }, [orchestratorData, prevOrchestratorData, config?.dernierePratiqueAnki, todayStr, historique]);

  // ---- Actions ----
  const handleAddExtraTime = () => setExtraTime(prev => prev + 30);

  const handleSkipRest = async () => {
    try {
      const apiBase = getApiUrl();
      const res = await fetch(`${apiBase}/config/skip-rest`, { method: 'POST' });
      if (res.ok) {
        toast.success("Jour de repos ignoré ! Reprise du travail.");
        await fetchOrchestrator({ fillGap: dailyFillGap, extraTime });
      } else {
        toast.error("Erreur lors de l'annulation du repos.");
      }
    } catch { toast.error("Erreur serveur."); }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedTaches);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedTaches(items);
    sessionStorage.setItem(`elpis_task_order_${todayStr}`, JSON.stringify(items.map(t => t.id)));
  };

  const handleCustomTaskSubmit = () => {
    if (!customTaskParams.titre.trim()) { toast.error("Veuillez entrer un titre."); return; }
    if (!customTaskParams.matiere) { toast.error("Veuillez sélectionner une matière."); return; }
    const newTask = { id: 'custom-' + Date.now(), titre: customTaskParams.titre, type: customTaskParams.type, matiereNom: customTaskParams.matiere, isCustom: true, dureeMinutes: 30 };
    useChronoStore.getState().startGlobalChrono(newTask);
    setCustomTaskModalOpen(false);
    toast.info("Chronomètre lancé pour l'activité libre !");
  };

  // ---- Task completion flow ----
  const handleTaskComplete = (tache, difficulteKey) => {
    if (tache.type === 'ANKI') {
      const today = getTodayStr();
      setConfig({ ...config, dernierePratiqueAnki: today });
      setOrderedTaches(prev => prev.filter(t => t.id !== tache.id && t.titre !== tache.titre));
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#818CF8', '#34D399', '#FBBF24'] });
      playTaskComplete();
      addHistoriqueEntry({ type: 'ANKI', titre: tache.titre, matiere: tache.matiere, action: 'Terminé', dureeMinutes: tache.dureeMinutes || 0 });
      return;
    }

    if (taskModalLockRef.current) {
      toast.info("Termine d'abord l'activité en cours avant d'en commencer une autre.");
      return;
    }
    taskModalLockRef.current = true;
    setPendingTask({ ...tache, difficulteKey });
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = useCallback(({ minutes, sm2Score, difficulte }) => {
    if (!pendingTask) return;
    const tache = pendingTask;
    const finalDifficulte = difficulte || tache.difficulteKey;

    const success = completeTask(tache, { minutes, sm2Score, difficulte: finalDifficulte }, () => {
      setOrderedTaches(prev => prev.filter(t => t.id !== tache.id && t.titre !== tache.titre));
      playTaskComplete();
    });

    if (!success) toast.error(`Tâche "${tache.titre}" introuvable.`);

    setPendingTask(null);
    setTaskModalOpen(false);
    taskModalLockRef.current = false;
  }, [pendingTask, completeTask, playTaskComplete, toast]);

  const handleSuspendCM = useCallback((tache) => {
    suspendCM(tache, config?.defaultDurationRevCM || 30);
    setOrderedTaches(prev => prev.filter(t => t.id !== tache.id && t.titre !== tache.titre));
    toast.success(`⏸️ Séance suspendue — "${tache.titre}" reviendra demain.`);
  }, [suspendCM, config, toast]);

  // ---- Dynamic greeting ----
  const hour = new Date().getHours();
  let greeting = 'Bonsoir';
  if (hour >= 5 && hour < 12) greeting = 'Bonjour';
  else if (hour >= 12 && hour < 18) greeting = 'Bon après-midi';

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={{padding: '2rem 0'}}>
        <div className="skeleton skeleton-text" style={{height:'28px', width:'40%', marginBottom:'1.5rem'}}></div>
        <div style={{display:'flex', gap:'1.5rem', marginBottom:'2rem', flexWrap:'wrap'}}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem'}}>
              <div className="skeleton skeleton-circle" style={{width:'36px', height:'36px'}}></div>
              <div className="skeleton skeleton-text" style={{width:'48px', height:'12px'}}></div>
            </div>
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{height:'200px', marginBottom:'1.5rem'}}></div>
        <div className="skeleton skeleton-card" style={{height:'140px', width:'65%'}}></div>
      </div>
    );
  }

  if (!orchestratorData || orchestratorData.error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card glass-panel" style={{textAlign:'center', marginTop:'3rem'}}>
        <h2>{greeting} ! Bienvenue sur ELPIS</h2>
        <p style={{color:'var(--text-secondary)'}}>Configure tes objectifs et tes cours pour activer le Planificateur.</p>
      </motion.div>
    );
  }

  const { statut, tempsDispoMin, tempsRequisMin } = orchestratorData;
  const surcharge = statut === "SURCHARGE";
  const pourcentageCharge = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  // ---- Render ----
  return (
    <motion.div className="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {config && !config.inscriptionPedagogiqueDone && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ background: 'var(--danger-color)', color: 'white', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
          <div>
            <strong>⚠️ Rappel Administratif :</strong> N'oublie pas de finaliser ton <strong>Inscription Pédagogique</strong> sur le site de l'Université. C'est obligatoire pour pouvoir te présenter aux examens !
          </div>
          <button onClick={() => setConfig({ ...config, inscriptionPedagogiqueDone: true })} style={{ background: 'white', color: 'var(--danger-color)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={e => e.target.style.transform = 'scale(1.05)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>
            C'est fait !
          </button>
        </motion.div>
      )}

      <WelcomeCard greeting={greeting} orderedTaches={orderedTaches} recommendedDailyHours={recommendedDailyHours} tempsRequisMin={tempsRequisMin} globalPercent={globalPercent} config={config} tempsTravailleToday={tempsTravailleToday} />

      {/* Action buttons */}
      <div className="dashboard-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => { setCustomTaskParams({ titre: '', type: 'PERSO', matiere: allMatieres[0] || '' }); setCustomTaskModalOpen(true); }}
          style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', background: 'var(--success-color)'}} title="Ajouter une activit\u00e9 libre">
          ✨ Activit\u00e9 Libre
        </button>

        {statut !== "REPOS" && !isRestDayToday && (
          <button className="btn-secondary" onClick={() => setRestDayConfirmOpen(true)}
            disabled={restDaysUsed >= 1}
            style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', opacity: restDaysUsed >= 1 ? 0.5 : 1}}
            title={restDaysUsed >= 1 ? "Quota de repos (1/semaine) atteint" : "Suspendre le programme pour aujourd'hui"}>
            ☕ Activer Jour de Repos ({restDaysUsed}/1)
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button className="btn-secondary" onClick={() => setExportMenuOpen(!exportMenuOpen)} style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}}>
            ⬇️ Exporter
          </button>
          {exportMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <button className="btn-secondary" onClick={() => { window.print(); setExportMenuOpen(false); }} style={{padding: '0.4rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)'}}>📄 Format PDF</button>
              <button className="btn-secondary" onClick={() => { exportToICal(); setExportMenuOpen(false); }} style={{padding: '0.4rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: '#60a5fa'}}>📅 Format iCal</button>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Objectives */}
        <motion.div className="card glass-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <h2>🎯 Objectifs du Jour</h2>
          {orchestratorData?.tempsDispoMin > 0 && statut !== "REPOS" && (
            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--bg-tertiary)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Progression de la Journée</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>{Math.floor((orchestratorData.tempsDejaTravailleMin || 0) / 60)}h{String((orchestratorData.tempsDejaTravailleMin || 0) % 60).padStart(2, '0')} travaillées</span>
                <span>Objectif IA : {Math.floor(orchestratorData.tempsDispoMin / 60)}h{String(orchestratorData.tempsDispoMin % 60).padStart(2, '0')}</span>
              </div>
              <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: (orchestratorData.tempsDejaTravailleMin || 0) >= orchestratorData.tempsDispoMin ? 'var(--success-color)' : 'var(--accent-primary)', width: `${Math.min(100, ((orchestratorData.tempsDejaTravailleMin || 0) / orchestratorData.tempsDispoMin) * 100)}%`, transition: 'width 1s ease-out' }} />
              </div>
            </div>
          )}

          {(statut === "REPOS" || statut === "REPOS_OPTIONNEL") ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state-container">
              <div className="empty-state-icon" style={{ filter: 'drop-shadow(0 10px 20px rgba(59, 130, 246, 0.3))' }}>☕</div>
              <h3 style={{color:'var(--accent-primary)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Mode Repos Activé</h3>
              <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>{orchestratorData.message}</p>
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem'}}>
                {surcharge && statut === "REPOS" && (
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAddExtraTime} className="btn-primary" style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}>🔥 J'ai encore de l'énergie (+30 min)</motion.button>
                )}
                {statut === "REPOS_OPTIONNEL" && !acceptedRest && (
                  <>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSkipRest} className="btn-primary" style={{background: 'var(--success-color)', padding: '0.8rem 1.5rem', fontWeight: 'bold', color: '#000'}}>🚀 Non, je suis en forme ! (Travailler)</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary" style={{padding: '0.8rem 1.5rem', fontWeight: 'bold', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)'}} onClick={() => { setAcceptedRest(true); toast.success("Bon repos !"); }}>😌 Oui, me reposer</motion.button>
                  </>
                )}
              </div>
            </motion.div>
          ) : orderedTaches.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state-container">
              <div className="empty-state-icon">✨</div>
              <h3 style={{color:'var(--success-color)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Tout est terminé !</h3>
              <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>Tu as accompli toutes tes tâches pour aujourd'hui. Profite de ton temps libre, tu l'as bien mérité !</p>
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem'}}>
                {surcharge && <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAddExtraTime} className="btn-primary" style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}>🔥 J'ai encore de l'énergie (+30 min)</motion.button>}
                {orchestratorData && !dailyFillGap && (
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setDailyFillGap(true); toast.info("Recherche de tâches supplémentaires en cours..."); }} className="btn-primary" style={{background: 'var(--accent-primary)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}>🚀 Demander plus de tâches</motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <TaskList orderedTaches={orderedTaches} onDragEnd={onDragEnd} onTaskComplete={handleTaskComplete} onSuspendCM={handleSuspendCM} />
          )}
        </motion.div>

        {/* Charge du Jour */}
        <motion.div className="card glass-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>⚡</div>
            <h2 style={{ margin: 0 }}>Charge du Jour</h2>
            {surcharge && <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>RETARD ACCUMULÉ</span>}
          </div>
          <div style={{marginTop:'2rem', marginBottom:'1rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
              <span style={{color:'var(--text-secondary)'}}>Prévu : <strong>{Math.round(tempsRequisMin/60 * 10)/10}h</strong></span>
              <span style={{color:'var(--text-secondary)'}}>Cible IA : <strong>{Math.round(tempsDispoMin/60 * 10)/10}h</strong></span>
            </div>
            <div className="progress-bar-container">
              <motion.div className={`progress-bar-fill ${surcharge ? 'surcharge' : ''}`} initial={{ width: 0 }} animate={{ width: `${pourcentageCharge}%` }} transition={{ duration: 1, ease: "easeOut" }} style={{ backgroundColor: surcharge ? 'var(--danger-color)' : 'var(--success-color)' }} />
            </div>
          </div>
          {surcharge ? (
            <div style={{background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
              <p style={{color: 'var(--danger-color)', margin: 0}}><strong>⚠️ Attention :</strong> Tu as accumulé du retard. L'IA a étalé la charge, mais reste concentré !</p>
            </div>
          ) : (
            <div style={{background:'rgba(16, 185, 129, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--success-color)'}}>
              <strong>Équilibre parfait :</strong> Ta charge de travail est compatible avec tes objectifs de santé.
            </div>
          )}
        </motion.div>
      </div>

      <InsightsPanel intelligence={intelligence} />
      <ProjectsWidget projets={projets} pendingTasksCount={pendingTasksCount} />
      <StatsSection stats={stats} globalPercent={globalPercent} />

      {/* Code Health Footer */}
      <div style={{ marginTop: '3rem', textAlign: 'center', borderTop: '1px solid var(--bg-tertiary)', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <button onClick={() => setAuditModalOpen(true)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7, transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
          title="Voir le rapport d'audit du code">
          🛡️ M\u00e9triques Code Health
        </button>
      </div>

      {/* Modals */}
      <TaskCompletionModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setPendingTask(null); taskModalLockRef.current = false; }}
        onSubmit={handleTaskSubmit} taskTitle={pendingTask?.titre || ''}
        defaultMinutes={pendingTask?.dureeMinutes || (config?.defaultDurationRevCM || 30)} taskType={pendingTask?.type || 'CM'} />

      <CustomTaskModal 
        isOpen={customTaskModalOpen} 
        onClose={() => setCustomTaskModalOpen(false)} 
        params={customTaskParams} 
        setParams={setCustomTaskParams} 
        onSubmit={handleCustomTaskSubmit} 
        allMatieres={allMatieres} 
      />

      <AuditDashboard isOpen={auditModalOpen} onClose={() => setAuditModalOpen(false)} />

      {/* Confirmation modale pour jour de repos (remplace window.confirm) */}
      <AnimatePresence>
        {restDayConfirmOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content glass-panel" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ maxWidth: '420px', width: '90%', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☕</div>
              <h2 style={{ marginBottom: '0.5rem' }}>Activer un jour de repos ?</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Il te reste <strong>{1 - restDaysUsed}</strong> jour{1 - restDaysUsed > 1 ? 's' : ''} de repos pour cette semaine.
                Ton streak ne sera pas brisé.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setRestDayConfirmOpen(false)}>Annuler</button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" style={{ background: 'var(--accent-primary)' }} onClick={() => { activateRestDay(); setRestDayConfirmOpen(false); toast.success('Jour de repos activé. Bon repos !'); }}>Confirmer</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default Dashboard;
