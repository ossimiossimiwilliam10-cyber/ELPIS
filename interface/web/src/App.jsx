import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import CoursPage from './CoursPage';
import EntrainementPage from './EntrainementPage';
import Dashboard from './Dashboard';
import Sidebar from './Sidebar';
import StatistiquesPage from './StatistiquesPage';
import GlobalSearchModal from './GlobalSearchModal';
import { ToastProvider, useToast } from './ToastProvider';
import useStore from './store';

function AppInner() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { addToast } = useToast();
  
  const { config, coursConfig, loading, error, initData, setConfig, activeTab, setActiveTab, pendingTasksCount } = useStore();

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    
    // Demander la permission pour les notifications (Service Worker)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [theme]);
  
  useEffect(() => {
    initData();
  }, [initData]);

  useEffect(() => {
    if (error) addToast(error, 'error');
  }, [error, addToast]);


  // Déclencher une notification Push si tâches en attente (1x par jour max)
  useEffect(() => {
    if (pendingTasksCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const today = new Date().toISOString().split('T')[0];
      const lastNotified = localStorage.getItem('elpisLastNotified');
      
      if (lastNotified !== today) {
        new Notification("ELPIS - Objectif 10/10", {
          body: `Vous avez ${pendingTasksCount} tâche(s) en attente aujourd'hui. C'est le moment de garder votre Streak ! 🔥`,
          icon: '/vite.svg'
        });
        localStorage.setItem('elpisLastNotified', today);
      }
    }
  }, [pendingTasksCount]);

  // Profile summary for config page
  const profileSummary = useMemo(() => {
    if (!coursConfig) return { semestres: 0, ues: 0, matieres: 0, cm: 0, td: 0, tp: 0 };
    let ues = 0, matieres = 0, cm = 0, td = 0, tp = 0;
    let semestres = 0;
    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        semestres++;
        s.ues?.forEach(u => {
          ues++;
          u.matieres?.forEach(m => {
            matieres++;
            cm += m.listeCM?.length || 0;
            td += m.listeTD?.length || 0;
            tp += m.listeTP?.length || 0;
          });
        });
      });
    });
    return { semestres, ues, matieres, cm, td, tp };
  }, [coursConfig]);



  // --- Subjects (Sujets à étudier avec dates d'examens, liés à coursConfig) ---
  const updateMatiereField = (lIndex, sIndex, uIndex, mIndex, field, value) => {
    const newCours = JSON.parse(JSON.stringify(coursConfig));
    newCours.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex][field] = value;
    useStore.getState().setCoursConfig(newCours);
  };

  const addMatiereExamDate = (lIndex, sIndex, uIndex, mIndex) => {
    const newCours = JSON.parse(JSON.stringify(coursConfig));
    const mat = newCours.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
    if (!mat.examDates) mat.examDates = [];
    mat.examDates.push("");
    useStore.getState().setCoursConfig(newCours);
  };

  const updateMatiereExamDate = (lIndex, sIndex, uIndex, mIndex, dIndex, value) => {
    const newCours = JSON.parse(JSON.stringify(coursConfig));
    newCours.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].examDates[dIndex] = value;
    useStore.getState().setCoursConfig(newCours);
  };

  const removeMatiereExamDate = (lIndex, sIndex, uIndex, mIndex, dIndex) => {
    const newCours = JSON.parse(JSON.stringify(coursConfig));
    newCours.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].examDates.splice(dIndex, 1);
    useStore.getState().setCoursConfig(newCours);
  };

  const downloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(coursConfig, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "espoir_cours_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addToast("Backup exporté avec succès !", 'success');
  };

  const handleImportBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.licences || json.semestres) {
          useStore.getState().setCoursConfig(json);
          addToast("Backup importé avec succès ! Auto-sauvegarde en cours...", 'success');
        } else {
          addToast("Fichier invalide : pas de données de cours détectées.", 'error');
        }
      } catch (err) {
        addToast("Impossible de lire le fichier (JSON invalide).", 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleFactoryReset = async () => {
    if (window.confirm("ATTENTION : Supprimer toutes les données ? Cette action est IRREVERSIBLE.")) {
      if (window.confirm("Derniere chance ! Confirmez la suppression totale ?")) {
        try {
          const emptyConfig = { studyStartDate: "07-09-2026", bedtime: "23:00", wakeUpTime: "07:00", maxStudyHoursPerDay: 8, targetGrade: 14, summerStudyHoursCompleted: 0, maxSubjectsPerDay: 3, studyBlockDurationMinutes: 50, activeRecallMinutesPerDay: 30, subjects: [], fixedCommitments: [], theme: "dark", pomoWork: 25, pomoBreak: 5, lastActiveDate: "", currentStreak: 0 };
          useStore.getState().setConfig(emptyConfig);
          const emptyCours = { licences: [] };
          useStore.getState().setCoursConfig(emptyCours);
          addToast("Reinitialisation terminee. Rechargement...", 'info');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addToast("Erreur lors de la reinitialisation : " + err.message, 'error');
        }
      }
    }
  };

  if (loading) return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'1rem', color: 'var(--text-primary)'}}>
      <div className="spinner" style={{width:'40px', height:'40px', border:'4px solid var(--bg-tertiary)', borderTop:'4px solid var(--accent-primary)', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
      <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>Initialisation des Cerveaux...</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(t) => setActiveTab(t)} 
        theme={theme}
        setTheme={setTheme}
        streak={config?.currentStreak || 0}
        pendingTasksCount={pendingTasksCount}
      />

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard key="dash" />
          )}

          {activeTab === 'statistiques' && (
            <motion.div 
              key="statistiques"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StatistiquesPage />
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div 
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Profile Summary */}
              <div className="config-profile-summary">
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.semestres}</div>
                  <div className="stat-label">Semestres</div>
                </div>
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.ues}</div>
                  <div className="stat-label">UEs</div>
                </div>
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.matieres}</div>
                  <div className="stat-label">Matieres</div>
                </div>
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.cm}</div>
                  <div className="stat-label">CM</div>
                </div>
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.td}</div>
                  <div className="stat-label">TD</div>
                </div>
                <div className="profile-stat-card">
                  <div className="stat-value">{profileSummary.tp}</div>
                  <div className="stat-label">TP</div>
                </div>
              </div>

              <div className="card glass-panel config-panel">
                <h2 style={{marginBottom:'2rem'}}>Preferences Generales</h2>
                
                <div style={{marginBottom:'1.5rem'}}>
                  <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Objectif d'heures d'étude pour aujourd'hui :</label>
                  <input 
                    type="number" 
                    value={config.maxStudyHoursPerDay || 0}
                    onChange={e => {
                      const newConf = {...config};
                      newConf.maxStudyHoursPerDay = parseInt(e.target.value) || 0;
                      setConfig(newConf);
                    }}
                    min="0" max="24"
                    style={{width:'100%', maxWidth:'200px'}}
                  />
                  <small style={{display:'block', color:'var(--text-secondary)', marginTop:'0.5rem', fontSize:'0.8rem'}}>Le système déduira automatiquement le temps que tu as déjà passé à étudier aujourd'hui.</small>
                </div>
                <h2 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem'}}>Estimation des Durées (Minutes)</h2>
                <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem'}}>
                  Temps par défaut alloué par l'algorithme lorsqu'un exercice n'a pas encore de moyenne personnalisée.
                </p>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'1rem', marginBottom:'2rem'}}>
                  <div>
                    <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>CM (Première fois) :</label>
                    <input type="number" min="5" value={config.defaultDurationNewCM || 120} onChange={e => {
                      const newConf = {...config, defaultDurationNewCM: parseInt(e.target.value) || 120};
                      setConfig(newConf);
                    }} style={{width:'100%'}}/>
                  </div>
                  <div>
                    <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>CM (Révision) :</label>
                    <input type="number" min="5" value={config.defaultDurationRevCM || 30} onChange={e => {
                      const newConf = {...config, defaultDurationRevCM: parseInt(e.target.value) || 30};
                      setConfig(newConf);
                    }} style={{width:'100%'}}/>
                  </div>
                  <div>
                    <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Travaux Dirigés (TD) :</label>
                    <input type="number" min="5" value={config.defaultDurationTD || 20} onChange={e => {
                      const newConf = {...config, defaultDurationTD: parseInt(e.target.value) || 20};
                      setConfig(newConf);
                    }} style={{width:'100%'}}/>
                  </div>
                  <div>
                    <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Travaux Pratiques (TP) :</label>
                    <input type="number" min="5" value={config.defaultDurationTP || 30} onChange={e => {
                      const newConf = {...config, defaultDurationTP: parseInt(e.target.value) || 30};
                      setConfig(newConf);
                    }} style={{width:'100%'}}/>
                  </div>
                  <div>
                    <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Annales (Examens) :</label>
                    <input type="number" min="5" value={config.defaultDurationAnnales || 60} onChange={e => {
                      const newConf = {...config, defaultDurationAnnales: parseInt(e.target.value) || 60};
                      setConfig(newConf);
                    }} style={{width:'100%'}}/>
                  </div>
                </div>


                {/* Section Matières avec Dates d'Examen */}
                <h2 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem'}}>Matières & Dates d'Examens</h2>
                <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem'}}>
                  Enregistre tes matières et leurs dates d'examens. L'orchestrateur augmentera automatiquement la priorité des matières dont l'examen approche.
                </p>

                <div style={{marginBottom:'2rem'}}>
                  <AnimatePresence>
                    {coursConfig?.licences?.map((l, lIndex) => 
                      l.semestres?.map((s, sIndex) => 
                        s.ues?.map((u, uIndex) => 
                          u.matieres?.map((matiere, mIndex) => {
                            // Countdown to nearest exam
                            let countdown = null;
                            if (matiere.examDates && matiere.examDates.length > 0) {
                              const today = new Date(); today.setHours(0,0,0,0);
                              const upcoming = matiere.examDates
                                .filter(d => d)
                                .map(d => new Date(d.split('-').reverse().join('-') + 'T00:00:00'))
                                .filter(d => !isNaN(d.getTime()) && d >= today)
                                .sort((a,b) => a - b);
                              if (upcoming.length > 0) {
                                const diff = Math.ceil((upcoming[0] - today) / (1000 * 60 * 60 * 24));
                                countdown = diff === 0 ? "Aujourd'hui !" : diff === 1 ? "Demain !" : `${diff} jours`;
                              }
                            }

                            return (
                              <motion.div
                                key={`${lIndex}-${sIndex}-${uIndex}-${mIndex}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{display:'flex', gap:'0.75rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'1rem', borderRadius:'8px', marginBottom:'0.75rem', flexWrap:'wrap'}}
                              >
                                <input
                                  type="color"
                                  value={matiere.color || '#3B82F6'}
                                  onChange={e => updateMatiereField(lIndex, sIndex, uIndex, mIndex, 'color', e.target.value)}
                                  style={{width:'36px', height:'36px', border:'none', borderRadius:'50%', cursor:'pointer', padding:0, background:'transparent'}}
                                  title="Couleur de la matière"
                                />

                                <div style={{flex: '1 1 180px'}}>
                                  <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{matiere.nom || "Sans nom"}</div>
                                  <div style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>
                                    {l.nom} • {s.nom} • {u.nom}
                                  </div>
                                  <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem'}}>
                                    <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Coeff :</label>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      max="10" 
                                      value={matiere.coefficient || 1} 
                                      onChange={e => updateMatiereField(lIndex, sIndex, uIndex, mIndex, 'coefficient', parseFloat(e.target.value) || 1)}
                                      style={{width:'50px', fontSize:'0.8rem', padding:'2px 4px', background:'var(--surface-color)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-color)', borderRadius:'4px'}}
                                      title="Coefficient (1-10) - Permet d'intensifier les révisions"
                                    />
                                  </div>
                                </div>

                                <div style={{display:'flex', flexDirection:'column', gap:'0.3rem', flex:'2 1 300px'}}>
                                  {(matiere.examDates || []).map((date, dIndex) => (
                                    <div key={dIndex} style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                                      <input
                                        type="date"
                                        value={date}
                                        onChange={e => updateMatiereExamDate(lIndex, sIndex, uIndex, mIndex, dIndex, e.target.value)}
                                        style={{flex:1, fontSize:'0.85rem'}}
                                      />
                                      <button
                                        onClick={() => removeMatiereExamDate(lIndex, sIndex, uIndex, mIndex, dIndex)}
                                        style={{background:'transparent', border:'none', cursor:'pointer', color:'var(--danger-color)', fontSize:'0.8rem', padding:'2px 6px'}}
                                        title="Supprimer cette date"
                                      >✕</button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addMatiereExamDate(lIndex, sIndex, uIndex, mIndex)}
                                    style={{background:'transparent', border:'1px dashed var(--text-secondary)', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.75rem', padding:'4px 8px', borderRadius:'4px', alignSelf:'flex-start'}}
                                  >+ Ajouter une date d'examen</button>
                                </div>

                                {countdown && (
                                  <div style={{
                                    background: countdown.includes("Aujourd'hui") ? 'rgba(239,68,68,0.2)' : countdown === "Demain !" ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.15)',
                                    color: countdown.includes("Aujourd'hui") ? '#ef4444' : countdown === "Demain !" ? '#F59E0B' : '#3B82F6',
                                    padding:'0.35rem 0.75rem',
                                    borderRadius:'20px',
                                    fontWeight:'bold',
                                    fontSize:'0.8rem',
                                    whiteSpace:'nowrap'
                                  }}>
                                    {countdown}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })
                        )
                      )
                    )}
                  </AnimatePresence>
                  {/* Removed addSubject button because we read from coursConfig now */}
                  <div style={{color:'var(--text-secondary)', fontSize:'0.85rem', fontStyle:'italic'}}>
                    Les matières sont gérées dans l'onglet "Cours". Tu peux ajouter des dates d'examen ici pour chacune d'entre elles.
                  </div>
                </div>

                <div className="config-actions">
                  <div className="config-actions-left">
                    <button 
                      className="btn-danger"
                      onClick={handleFactoryReset}
                      title="Effacer TOUTES les donnees de l'application"
                    >
                      Reinitialiser l'App
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={downloadBackup}
                      title="Telecharger une sauvegarde locale"
                    >
                      Exporter Backup
                    </button>
                    <div>
                      <input 
                        type="file" 
                        accept=".json"
                        id="import-backup"
                        style={{display:'none'}}
                        onChange={handleImportBackup}
                      />
                      <label 
                        htmlFor="import-backup" 
                        className="btn-secondary" 
                        style={{display: 'inline-block', cursor:'pointer'}}
                        title="Importer une ancienne sauvegarde"
                      >
                        Importer Backup
                      </label>
                    </div>
                  </div>
                  <div style={{color:'var(--text-secondary)', fontSize:'0.9rem', fontStyle:'italic'}}>
                    Sauvegarde automatique activée
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'cours' && (
            <motion.div 
              key="cours"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CoursPage />
            </motion.div>
          )}

          {activeTab === 'entrainement' && (
            <motion.div 
              key="entrain"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <EntrainementPage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <GlobalSearchModal />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

export default App;
