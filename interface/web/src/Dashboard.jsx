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
import InsightsPanel from './components/dashboard/InsightsPanel';
import ProjectsWidget from './components/dashboard/ProjectsWidget';
import StatsSection from './components/dashboard/StatsSection';
import { DIFFICULTY_LEVELS } from './constants';
import { getApiUrl } from './utils/apiConfig';

function Dashboard() {
  const {
    config, coursConfig, loading: storeLoading, historique, projets,
    orchestratorData, fetchOrchestrator, intelligence, pendingTasksCount,
    dailyFillGap, setDailyFillGap, setConfig, addHistoriqueEntry,
    activateRestDay, activateExtendedRestDay, declineExtendedRestDay
  } = useStore();

  const { completeTask, suspendCM } = useTaskCompletion();
  const { stats, globalPercent, allMatieres, restDaysUsed, todayStr, isRestDayToday } = useDashboardStats();
  const recommendedDailyHours = useWorkloadEngine();
  const { toast } = useToast();
  const { playTaskComplete } = useSoundEffects();

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
  if (orchestratorData !== prevOrchestratorData) {
    setPrevOrchestratorData(orchestratorData);
    if (orchestratorData?.tachesDuJour) {
      const filtered = orchestratorData.tachesDuJour.filter(t => {
        if (t.type === 'ANKI' && config?.dernierePratiqueAnki === todayStr) return false;
        return true;
      });
      setOrderedTaches(filtered);
    }
  }

  // ---- Actions ----
  const handleAddExtraTime = () => setExtraTime(prev => prev + 30);

  const handleSkipRest = async () => {
    try {
      const res = await fetch('/api/skip-rest', { method: 'POST' });
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

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  // ---- iCal export ----
  const exportToICal = () => {
    if (!orchestratorData?.tachesDuJour?.length) { alert("Aucune tâche à exporter."); return; }
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ELPIS//Planning//FR\n";
    let currentBlockStart = new Date(); currentBlockStart.setHours(8, 0, 0, 0);
    orchestratorData.tachesDuJour.forEach((tache, index) => {
      const durationStr = typeof tache.dureeEstimee === 'number' ? tache.dureeEstimee : parseInt(tache.dureeEstimee) || 30;
      const endBlock = new Date(currentBlockStart.getTime() + durationStr * 60000);
      const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
      const title = tache.type === 'ANKI' ? 'Révisions (Anki)' : `[${tache.type}] ${tache.titre || 'Tâche'}`;
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${Date.now()}-${index}@elpis.app\nDTSTAMP:${formatICSDate(new Date())}\nDTSTART:${formatICSDate(currentBlockStart)}\nDTEND:${formatICSDate(endBlock)}\nSUMMARY:${title}\nEND:VEVENT\n`;
      currentBlockStart = new Date(endBlock.getTime() + 5 * 60000);
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `elpis_planning_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

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

      <WelcomeCard greeting={greeting} orderedTaches={orderedTaches} recommendedDailyHours={recommendedDailyHours} tempsRequisMin={tempsRequisMin} globalPercent={globalPercent} config={config} />

      {/* Action buttons */}
      <div className="dashboard-actions">
        <button className="btn-primary" onClick={() => { setCustomTaskParams({ titre: '', type: 'PERSO', matiere: allMatieres[0] || '' }); setCustomTaskModalOpen(true); }}
          style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', background: 'var(--success-color)'}} title="Ajouter une activité libre">
          ✨ Activité Libre
        </button>
        <button className="btn-secondary" onClick={() => setAuditModalOpen(true)}
          style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}} title="Voir le rapport d'audit du code">
          🛡️ Code Health
        </button>
        {statut !== "REPOS" && !isRestDayToday && (
          <button className="btn-secondary" onClick={() => { if (window.confirm(`Activer un jour de repos ? Il te reste ${1 - restDaysUsed} repos pour cette semaine.`)) activateRestDay(); }}
            disabled={restDaysUsed >= 1}
            style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', opacity: restDaysUsed >= 1 ? 0.5 : 1}}
            title={restDaysUsed >= 1 ? "Quota de repos (1/semaine) atteint" : "Suspendre le programme pour aujourd'hui"}>
            ☕ Activer Jour de Repos ({restDaysUsed}/1)
          </button>
        )}
        <button className="btn-secondary" onClick={() => window.print()} style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}}>Exporter PDF</button>
        <button className="btn-secondary" onClick={exportToICal} style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.4)'}}>📅 Exporter iCal</button>
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

      {/* Modals */}
      <TaskCompletionModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setPendingTask(null); taskModalLockRef.current = false; }}
        onSubmit={handleTaskSubmit} taskTitle={pendingTask?.titre || ''}
        defaultMinutes={pendingTask?.dureeMinutes || (config?.defaultDurationRevCM || 30)} taskType={pendingTask?.type || 'CM'} />

      <AnimatePresence>
        {customTaskModalOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content glass-panel" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ maxWidth: '400px', width: '90%' }}>
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--success-color)' }}>✨ Nouvelle Activité Libre</h2>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Titre de l'activité</label>
                <input type="text" value={customTaskParams.titre} onChange={(e) => setCustomTaskParams({...customTaskParams, titre: e.target.value})} placeholder="ex: Vidéo YouTube, Projet Perso..." style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }} autoFocus />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Catégorie</label>
                <select value={customTaskParams.type} onChange={(e) => setCustomTaskParams({...customTaskParams, type: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="PERSO">Perso / Projet</option><option value="LECTURE">Lecture / Veille</option><option value="ANKI">Anki (Flashcards)</option><option value="CM">CM (Cours)</option><option value="TD">TD (Exercices)</option><option value="TP">TP (Pratique)</option><option value="ANNALE">Annale (Examen)</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Matière rattachée</label>
                <select value={customTaskParams.matiere} onChange={(e) => setCustomTaskParams({...customTaskParams, matiere: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {allMatieres.length === 0 && <option value="">Aucune matière disponible</option>}
                  {allMatieres.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setCustomTaskModalOpen(false)}>Annuler</button>
                <button className="btn-primary" onClick={() => {
                  if (!customTaskParams.titre.trim()) { toast.error("Veuillez entrer un titre."); return; }
                  if (!customTaskParams.matiere) { toast.error("Veuillez sélectionner une matière."); return; }
                  const newTask = { id: 'custom-' + Date.now(), titre: customTaskParams.titre, type: customTaskParams.type, matiereNom: customTaskParams.matiere, isCustom: true, dureeMinutes: 30 };
                  useChronoStore.getState().startGlobalChrono(newTask);
                  setCustomTaskModalOpen(false);
                  toast.info("Chronomètre lancé pour l'activité libre !");
                }} style={{ background: 'var(--success-color)' }}>▶ Lancer le Chrono</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuditDashboard isOpen={auditModalOpen} onClose={() => setAuditModalOpen(false)} />
    </motion.div>
  );
}

export default Dashboard;
