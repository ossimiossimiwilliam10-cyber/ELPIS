import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import CoursPage from './CoursPage';
import EntrainementPage from './EntrainementPage';
import Dashboard from './Dashboard';
import Sidebar from './Sidebar';
import StatistiquesPage from './StatistiquesPage';
import CalendrierPage from './CalendrierPage';
import GlobalSearchModal from './GlobalSearchModal';
import { ToastProvider, useToast } from './ToastProvider';
import useStore from './store';

function AppInner() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { addToast } = useToast();
  
  const { config, coursConfig, loading, error, initData, setConfig, activeTab, setActiveTab } = useStore();

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

  // Pending tasks count for sidebar badge
  const pendingTasksCount = useMemo(() => {
    if (!coursConfig) return 0;
    let count = 0;
    const today = new Date().toISOString().split('T')[0];
    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            m.listeCM?.forEach(cm => {
              if (!cm.derniereRevision) {
                count++; // J0 : jamais révisé = en attente
              } else if (cm.jActuel > 0) {
                const nextDate = new Date(cm.derniereRevision);
                nextDate.setDate(nextDate.getDate() + cm.jActuel);
                if (nextDate.toISOString().split('T')[0] <= today) count++;
              } else {
                // J0 déjà révisé au moins une fois : compter si pas aujourd'hui
                if (cm.derniereRevision !== today) count++;
              }
            });
            m.listeTD?.forEach(td => {
              // Compter dans la limite du quota journalier : max 2 TD/matière/jour
            });
            // Respecter le quota : max 2 TD - déjà faits aujourd'hui
            if (m.listeTD) {
              const doneTDToday = m.listeTD.filter(td => td.dernierePratique === today).length;
              const tdQuota = Math.min(2, m.listeTD.length);
              count += Math.max(0, tdQuota - doneTDToday);
            }
            m.listeTP?.forEach(tp => {
              // Compter dans la limite du quota journalier : max 1 TP/matière/jour
            });
            if (m.listeTP) {
              const doneTPToday = m.listeTP.filter(tp => tp.dernierePratique === today).length;
              const tpQuota = Math.min(1, m.listeTP.length);
              count += Math.max(0, tpQuota - doneTPToday);
            }
          });
        });
      });
    });
    // Cap at reasonable number
    return Math.min(count, 99);
  }, [coursConfig]);

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



  // --- Subjects (Sujets à étudier avec dates d'examens) ---
  const addSubject = () => {
    const newConf = { ...config };
    if (!newConf.subjects) newConf.subjects = [];
    newConf.subjects.push({
      name: "Nouvelle Matière",
      color: "#3B82F6",
      examDates: []
    });
    setConfig(newConf);
  };

  const removeSubject = (index) => {
    if (window.confirm("Supprimer cette matière ?")) {
      const newConf = { ...config };
      newConf.subjects.splice(index, 1);
      setConfig(newConf);
    }
  };

  const updateSubject = (index, field, value) => {
    const newConf = { ...config };
    newConf.subjects[index][field] = value;
    setConfig(newConf);
  };

  const addExamDate = (subjectIndex) => {
    const newConf = { ...config };
    if (!newConf.subjects[subjectIndex].examDates) newConf.subjects[subjectIndex].examDates = [];
    newConf.subjects[subjectIndex].examDates.push("");
    setConfig(newConf);
  };

  const updateExamDate = (subjectIndex, dateIndex, value) => {
    const newConf = { ...config };
    newConf.subjects[subjectIndex].examDates[dateIndex] = value;
    setConfig(newConf);
  };

  const removeExamDate = (subjectIndex, dateIndex) => {
    const newConf = { ...config };
    newConf.subjects[subjectIndex].examDates.splice(dateIndex, 1);
    setConfig(newConf);
  };

  const addFixedCommitment = () => {
    const newConf = { ...config };
    if (!newConf.fixedCommitments) newConf.fixedCommitments = [];
    newConf.fixedCommitments.push({
      title: "Nouvel Engagement",
      dayOfWeek: "Lundi",
      startTime: "08:00",
      endTime: "10:00"
    });
    setConfig(newConf);
  };

  const removeFixedCommitment = (index) => {
    if (window.confirm("Supprimer cet engagement ?")) {
      const newConf = { ...config };
      newConf.fixedCommitments.splice(index, 1);
      setConfig(newConf);
    }
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

  const updateFixedCommitment = (index, field, value) => {
    const newConf = { ...config };
    newConf.fixedCommitments[index][field] = value;
    setConfig(newConf);
  };

  const handleFactoryReset = async () => {
    if (window.confirm("ATTENTION : Supprimer toutes les données ? Cette action est IRREVERSIBLE.")) {
      if (window.confirm("Derniere chance ! Confirmez la suppression totale ?")) {
        try {
          const emptyConfig = { studyStartDate: "07-09-2026", bedtime: "23:00", wakeUpTime: "07:00", maxStudyHoursPerDay: 8, targetGrade: 14.0, summerStudyHoursCompleted: 0, maxSubjectsPerDay: 3, studyBlockDurationMinutes: 50, activeRecallMinutesPerDay: 30, subjects: [], fixedCommitments: [], theme: "dark", pomoWork: 25, pomoBreak: 5, lastActiveDate: "", currentStreak: 0 };
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

          {activeTab === 'calendrier' && (
            <motion.div 
              key="calendrier"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CalendrierPage />
            </motion.div>
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
                  <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Heures d'etude maximum par jour :</label>
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
                </div>
                
                <div style={{marginBottom:'1.5rem'}}>
                  <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Heure de coucher :</label>
                  <input 
                    type="time" 
                    step="60"
                    value={config.bedtime || "23:00"}
                    onChange={e => {
                      const newConf = {...config};
                      newConf.bedtime = e.target.value;
                      setConfig(newConf);
                    }}
                    style={{width:'100%', maxWidth:'200px'}}
                  />
                  <small style={{display:'block', color:'var(--text-secondary)', marginTop:'0.5rem', fontSize:'0.8rem'}}>Format 24h enregistré en base (l'affichage dépend de votre système).</small>
                </div>

                {/* Pomodoro Settings */}
                <h3 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'1.5rem'}}>Minuteur Pomodoro</h3>
                <div className="pomo-settings">
                  <div className="pomo-setting">
                    <label>Duree de travail (min) :</label>
                    <input 
                      type="number"
                      value={config.pomoWork || 25}
                      onChange={e => {
                        const newConf = {...config};
                        newConf.pomoWork = Math.max(1, Math.min(120, parseInt(e.target.value) || 25));
                        setConfig(newConf);
                      }}
                      min="1" max="120"
                    />
                  </div>
                  <div className="pomo-setting">
                    <label>Duree de pause (min) :</label>
                    <input 
                      type="number"
                      value={config.pomoBreak || 5}
                      onChange={e => {
                        const newConf = {...config};
                        newConf.pomoBreak = Math.max(1, Math.min(60, parseInt(e.target.value) || 5));
                        setConfig(newConf);
                      }}
                      min="1" max="60"
                    />
                  </div>
                </div>

                {/* Section Matières avec Dates d'Examen */}
                <h2 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem'}}>Matières & Dates d'Examens</h2>
                <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem'}}>
                  Enregistre tes matières et leurs dates d'examens. L'orchestrateur augmentera automatiquement la priorité des matières dont l'examen approche.
                </p>

                <div style={{marginBottom:'2rem'}}>
                  <AnimatePresence>
                    {config.subjects?.map((subject, sIndex) => {
                      // Countdown to nearest exam
                      let countdown = null;
                      if (subject.examDates && subject.examDates.length > 0) {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const upcoming = subject.examDates
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
                          key={sIndex}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          style={{display:'flex', gap:'0.75rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'1rem', borderRadius:'8px', marginBottom:'0.75rem', flexWrap:'wrap'}}
                        >
                          <button onClick={() => removeSubject(sIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--danger-color)', padding:0}} title="Supprimer">X</button>

                          <input
                            type="color"
                            value={subject.color || '#3B82F6'}
                            onChange={e => updateSubject(sIndex, 'color', e.target.value)}
                            style={{width:'36px', height:'36px', border:'none', borderRadius:'50%', cursor:'pointer', padding:0, background:'transparent'}}
                            title="Couleur de la matière"
                          />

                          <input
                            type="text"
                            value={subject.name}
                            onChange={e => updateSubject(sIndex, 'name', e.target.value)}
                            placeholder="Nom de la matière"
                            style={{flex: '1 1 180px', fontWeight:'bold'}}
                          />

                          <div style={{display:'flex', flexDirection:'column', gap:'0.3rem', flex:'2 1 300px'}}>
                            {(subject.examDates || []).map((date, dIndex) => (
                              <div key={dIndex} style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                                <input
                                  type="date"
                                  value={date}
                                  onChange={e => updateExamDate(sIndex, dIndex, e.target.value)}
                                  style={{flex:1, fontSize:'0.85rem'}}
                                />
                                <button
                                  onClick={() => removeExamDate(sIndex, dIndex)}
                                  style={{background:'transparent', border:'none', cursor:'pointer', color:'var(--danger-color)', fontSize:'0.8rem', padding:'2px 6px'}}
                                  title="Supprimer cette date"
                                >✕</button>
                              </div>
                            ))}
                            <button
                              onClick={() => addExamDate(sIndex)}
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
                    })}
                  </AnimatePresence>
                  <button className="btn-secondary" style={{marginTop:'0.5rem'}} onClick={addSubject}>+ Ajouter une Matière</button>
                </div>

                {/* Section Engagements Fixes */}
                <h2 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem'}}>Engagements Fixes (Emploi du temps)</h2>
                <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem'}}>
                  Ajoute tes horaires de cours, de travail ou d'activites regulieres. Le systeme deduira automatiquement ce temps de ta disponibilite pour generer ton planning d'etude.
                </p>
                
                <div style={{marginBottom:'2rem'}}>
                  <AnimatePresence>
                    {config.fixedCommitments?.map((fc, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{display:'flex', gap:'1rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'1rem', borderRadius:'8px', marginBottom:'0.5rem', flexWrap:'wrap'}}
                      >
                        <button onClick={() => removeFixedCommitment(index)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--danger-color)', padding:0}} title="Supprimer">X</button>
                        <input 
                          type="text" 
                          value={fc.title}
                          onChange={(e) => updateFixedCommitment(index, 'title', e.target.value)}
                          placeholder="Titre (ex: CM Math)"
                          style={{flex: '1 1 150px'}}
                        />
                        <select 
                          value={fc.dayOfWeek}
                          onChange={(e) => updateFixedCommitment(index, 'dayOfWeek', e.target.value)}
                          style={{flex: '1 1 120px'}}
                        >
                          <option value="Lundi">Lundi</option>
                          <option value="Mardi">Mardi</option>
                          <option value="Mercredi">Mercredi</option>
                          <option value="Jeudi">Jeudi</option>
                          <option value="Vendredi">Vendredi</option>
                          <option value="Samedi">Samedi</option>
                          <option value="Dimanche">Dimanche</option>
                          <option value="Tous les jours">Tous les jours</option>
                        </select>
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', flex: '1 1 200px'}}>
                          <input 
                            type="time" 
                            value={fc.startTime}
                            onChange={(e) => updateFixedCommitment(index, 'startTime', e.target.value)}
                            style={{width:'100px'}}
                          />
                          <span style={{color:'var(--text-secondary)'}}>a</span>
                          <input 
                            type="time" 
                            value={fc.endTime}
                            onChange={(e) => updateFixedCommitment(index, 'endTime', e.target.value)}
                            style={{width:'100px'}}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <button className="btn-secondary" style={{marginTop:'1rem'}} onClick={addFixedCommitment}>+ Ajouter un Engagement</button>
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
