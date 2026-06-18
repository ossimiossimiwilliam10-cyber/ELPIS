import { useState, useEffect } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { calculateSM2 } from './sm2';
import { useWorkloadEngine } from './useWorkloadEngine';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from './ToastProvider';

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
  const { config, setConfig, coursConfig, setCoursConfig, addHistoriqueEntry, activateRestDay, dailyFillGap, setDailyFillGap } = useStore();
  const [data, setData] = useState(null);
  const [orderedTaches, setOrderedTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraTime, setExtraTime] = useState(0);
  const { toast } = useToast();

  const recommendedDailyHours = useWorkloadEngine();

  const getRestDaysUsed = () => {
    if (!config || !config.restDays) return 0;
    const now = new Date();
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

  const DIFFICULTY_LEVELS = [
    { key: 'difficile', label: '🔴', title: 'Difficile' },
    { key: 'assez_difficile', label: '🟠', title: 'Assez difficile' },
    { key: 'moyen', label: '🟡', title: 'Moyen' },
    { key: 'facile', label: '🟢', title: 'Facile' },
    { key: 'tres_facile', label: '🔵', title: 'Très facile' },
  ];

  const fetchDashboard = (currentExtraTime = extraTime) => {
    fetch(`/api/orchestrateur?extraTime=${currentExtraTime}&fillGap=${dailyFillGap}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        if (d.tachesDuJour) {
          setOrderedTaches(d.tachesDuJour);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard(extraTime);
  }, [coursConfig, extraTime, dailyFillGap]);

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
              if (tache.type === 'CM') {
                matiere.listeCM.forEach(cm => {
                  if (cm.titre !== tache.titre) return;
                  let actualDaysElapsed = -1;
                  if (cm.derniereRevision) {
                    const revDate = new Date(cm.derniereRevision + 'T00:00:00');
                    const nowDate = new Date(today + 'T00:00:00');
                    actualDaysElapsed = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));
                  }
                  const { interval, easeFactor, repetitions, prochaineRevisionDate } = calculateSM2(
                    3, cm.jActuel || 0, cm.easeFactor || 2.5, cm.repetitions || 0,
                    coursConfig, actualDaysElapsed, tache.matiere
                  );
                  cm.jActuel = interval;
                  cm.easeFactor = easeFactor;
                  cm.repetitions = repetitions;
                  cm.derniereRevision = today;
                  cm.prochaineRevisionDate = prochaineRevisionDate;
                  taskFound = true;
                });
              } else if (tache.type === 'TD') {
                matiere.listeTD.forEach(td => {
                  if (td.titre !== tache.titre) return;
                  td.dernierePratique = today;
                  td.nombrePratiques = (td.nombrePratiques || 0) + 1;
                  if (difficulte) td.difficulte = difficulte;
                  taskFound = true;
                });
              } else if (tache.type === 'TP') {
                matiere.listeTP.forEach(tp => {
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
    }
  };

  // Dynamic greeting (must be before early returns)
  const hour = new Date().getHours();
  let greeting = 'Bonsoir';
  if (hour >= 5 && hour < 12) greeting = 'Bonjour';
  else if (hour >= 12 && hour < 18) greeting = 'Bon après-midi';

  if (loading) {
    return (
      <div style={{textAlign:'center', marginTop:'5rem'}}>
        Analyse des donnees en cours...
      </div>
    );
  }

  if (!data || data.error) {
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

  const { statut, tempsDispoMin, tempsRequisMin } = data;
  const surcharge = statut === "SURCHARGE";
  const pourcentageCharge = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  const getStats = () => {
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
  };

  const stats = getStats();
  const globalPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

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
            <div className="welcome-stat-label">Cible IA</div>
          </div>
          <div className="welcome-stat">
            <div className="welcome-stat-value">{orderedTaches.length}</div>
            <div className="welcome-stat-label">Tâches</div>
          </div>
          <div className="welcome-stat">
            <div className="welcome-stat-value">{Math.round(tempsRequisMin/60 * 10)/10}h</div>
            <div className="welcome-stat-label">Requis</div>
          </div>
          <div className="welcome-stat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <CircularProgress percent={globalPercent} />
            <div className="welcome-stat-label">Global</div>
          </div>
          <div className="welcome-stat" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="welcome-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F59E0B' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))', fontSize: '2rem', animation: 'float 4s ease-in-out infinite' }}>🔥</span> 
              <span style={{ fontSize: '2.4rem' }}>{config?.currentStreak || 0}</span>
            </div>
            <div className="welcome-stat-label" style={{ color: 'var(--text-secondary)' }}>Record : {config?.bestStreak || 0}</div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'1rem', gap: '1rem'}}>
        {statut !== "REPOS" && !isRestDayToday && (
          <button 
            className="btn-secondary" 
            onClick={() => {
              if (window.confirm(`Activer un jour de repos ? Il te reste ${2 - restDaysUsed} repos pour cette semaine.`)) {
                activateRestDay();
              }
            }} 
            disabled={restDaysUsed >= 2}
            style={{padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', opacity: restDaysUsed >= 2 ? 0.5 : 1}}
            title={restDaysUsed >= 2 ? "Quota de repos (2/semaine) atteint" : "Suspendre le programme pour aujourd'hui"}
          >
            ☕ Activer Jour de Repos ({restDaysUsed}/2)
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
          {data && data.tempsDispoMin > 0 && statut !== "REPOS" && (
            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--bg-tertiary)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Progression de la Journée</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>{Math.floor((data.tempsDejaTravailleMin || 0) / 60)}h{String((data.tempsDejaTravailleMin || 0) % 60).padStart(2, '0')} travaillées</span>
                <span>Objectif IA : {Math.floor(data.tempsDispoMin / 60)}h{String(data.tempsDispoMin % 60).padStart(2, '0')}</span>
              </div>
              <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: (data.tempsDejaTravailleMin || 0) >= data.tempsDispoMin ? 'var(--success-color)' : 'var(--accent-color)',
                  width: `${Math.min(100, ((data.tempsDejaTravailleMin || 0) / data.tempsDispoMin) * 100)}%`,
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            </div>
          )}

          {statut === "REPOS" ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state-container"
              style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05))' }}
            >
              <div className="empty-state-icon" style={{ filter: 'drop-shadow(0 10px 20px rgba(59, 130, 246, 0.3))' }}>☕</div>
              <h3 style={{color:'var(--accent-color)', marginBottom: '0.5rem', fontSize:'1.8rem'}}>Mode Repos Activé</h3>
              <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>{data.message}</p>
              <p style={{marginTop: '1rem', fontStyle: 'italic', fontSize: '0.95rem', opacity: 0.8}}>Les tâches prévues aujourd'hui ont été suspendues sans pénalité. Prends ce temps pour toi !</p>
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
                    style={{background: 'var(--accent-color)', padding: '0.8rem 1.5rem', fontWeight: 'bold'}}
                  >
                    🔥 J'ai encore de l'énergie (+30 min)
                  </motion.button>
                )}
                
                {data && (data.tempsDejaTravailleMin || 0) < data.tempsDispoMin && !dailyFillGap && (
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
          <h2 style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
            ⚡ Charge du Jour
            <span className={`status-badge ${surcharge ? 'status-surcharge' : 'status-ok'}`}>
              {surcharge ? 'SURCHARGE' : 'OK'}
            </span>
          </h2>
          
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
            <div style={{background:'rgba(239, 68, 68, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--danger-color)'}}>
              <strong>Alerte Burnout :</strong> Tu as prévu trop de choses aujourd'hui. Pense à reporter certaines tâches !
            </div>
          ) : (
            <div style={{background:'rgba(16, 185, 129, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--success-color)'}}>
              <strong>Equilibre parfait :</strong> Ta charge de travail est compatible avec tes objectifs de santé.
            </div>
          )}


        </motion.div>
      </div>

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
    </motion.div>
  );
}

export default Dashboard;
