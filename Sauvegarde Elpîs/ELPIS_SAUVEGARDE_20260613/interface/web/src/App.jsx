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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { addToast } = useToast();
  
  const { config, coursConfig, loading, error, initData, setConfig } = useStore();

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
    coursConfig.semestres?.forEach(s => {
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
    // Cap at reasonable number
    return Math.min(count, 99);
  }, [coursConfig]);

  // Profile summary for config page
  const profileSummary = useMemo(() => {
    if (!coursConfig) return { semestres: 0, ues: 0, matieres: 0, cm: 0, td: 0, tp: 0 };
    let ues = 0, matieres = 0, cm = 0, td = 0, tp = 0;
    coursConfig.semestres?.forEach(s => {
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
    return { semestres: coursConfig.semestres?.length || 0, ues, matieres, cm, td, tp };
  }, [coursConfig]);



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
        if (json.semestres) {
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
          const emptyConfig = { maxStudyHoursPerDay: 8, fixedCommitments: [], pomoWork: 25, pomoBreak: 5 };
          useStore.getState().setConfig(emptyConfig);
          const emptyCours = { semestres: [] };
          useStore.getState().setCoursConfig(emptyCours);
          addToast("Reinitialisation terminee. Rechargement...", 'info');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addToast("Erreur lors de la reinitialisation : " + err.message, 'error');
        }
      }
    }
  };

  if (loading) return <div style={{textAlign:'center', marginTop:'5rem'}}>Initialisation des Cerveaux...</div>;

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
                    value={config.bedtime || "23:00"}
                    onChange={e => {
                      const newConf = {...config};
                      newConf.bedtime = e.target.value;
                      setConfig(newConf);
                    }}
                    style={{width:'100%', maxWidth:'200px'}}
                  />
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
