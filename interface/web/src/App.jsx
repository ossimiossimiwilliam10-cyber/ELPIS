import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import CoursPage from './CoursPage';
import EntrainementPage from './EntrainementPage';
import Dashboard from './Dashboard';
import Sidebar from './Sidebar';
import { ToastProvider, useToast } from './ToastProvider';

function AppInner() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { addToast } = useToast();
  
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);
  
  // States pour la Config
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States pour les Cours
  const [coursConfig, setCoursConfig] = useState(null);
  const [loadingCours, setLoadingCours] = useState(true);
  const [savingCours, setSavingCours] = useState(false);

  // Pending tasks count for sidebar badge
  const pendingTasksCount = useMemo(() => {
    if (!coursConfig) return 0;
    let count = 0;
    const today = new Date().toISOString().split('T')[0];
    coursConfig.semestres?.forEach(s => {
      s.ues?.forEach(u => {
        u.matieres?.forEach(m => {
          m.listeCM?.forEach(cm => {
            if (cm.jActuel > 0 && cm.derniereRevision) {
              const nextDate = new Date(cm.derniereRevision);
              nextDate.setDate(nextDate.getDate() + (cm.jActuel || 0));
              if (nextDate.toISOString().split('T')[0] <= today) count++;
            }
          });
          m.listeTD?.forEach(td => {
            if (td.dernierePratique !== today) count++;
          });
          m.listeTP?.forEach(tp => {
            if (tp.dernierePratique !== today) count++;
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

  const calculateStreak = (configData) => {
    const today = new Date().toISOString().split('T')[0];
    let streak = configData.currentStreak || 0;
    let lastActive = configData.lastActiveDate || "";

    if (lastActive !== today) {
      if (lastActive) {
        const lastDate = new Date(lastActive);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      
      const newConfig = { ...configData, lastActiveDate: today, currentStreak: streak };
      setConfig(newConfig);
      
      // Quiet save
      fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      }).catch(err => console.error("Streak save failed", err));
    } else {
      setConfig(configData);
    }
  };

  useEffect(() => {
    fetch('http://localhost:3001/api/config')
      .then(res => res.json())
      .then(data => {
        calculateStreak(data);
        setLoading(false);
      })
      .catch(err => {
        addToast("Impossible de contacter le serveur (Config)", 'error');
        setLoading(false);
      });

    fetch('http://localhost:3001/api/cours')
      .then(res => res.json())
      .then(data => {
        setCoursConfig(data);
        setLoadingCours(false);
      })
      .catch(err => {
        addToast("Impossible de contacter le serveur (Cours)", 'error');
        setLoadingCours(false);
      });
  }, []);

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
          handleSaveCours(json);
          setCoursConfig(json);
          addToast("Backup importé avec succès !", 'success');
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

  const handleSaveConfig = () => {
    let isValid = true;
    if (config.fixedCommitments) {
      for (const fc of config.fixedCommitments) {
        if (!fc.title || fc.title.trim() === '') isValid = false;
        if (!fc.startTime || !fc.endTime) isValid = false;
        if (fc.startTime && fc.endTime && fc.startTime >= fc.endTime) {
          addToast(`L'heure de fin doit être après l'heure de début pour "${fc.title}".`, 'error');
          return;
        }
      }
    }
    if (!isValid) {
      addToast("Veuillez remplir tous les champs correctement.", 'error');
      return;
    }

    setSaving(true);
    fetch('http://localhost:3001/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      addToast("Configuration sauvegardée !", 'success');
    })
    .catch(err => {
      addToast(err.message, 'error');
    })
    .finally(() => {
      setSaving(false);
    });
  };

  const handleSaveCours = (newCoursConfig) => {
    setSavingCours(true);
    fetch('http://localhost:3001/api/cours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCoursConfig)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      addToast("Cours sauvegardés !", 'success');
      setCoursConfig(newCoursConfig);
    })
    .catch(err => {
      addToast(err.message, 'error');
    })
    .finally(() => {
      setSavingCours(false);
    });
  };

  const handleFactoryReset = async () => {
    if (window.confirm("ATTENTION : Supprimer toutes les données ? Cette action est IRREVERSIBLE.")) {
      if (window.confirm("Derniere chance ! Confirmez la suppression totale ?")) {
        try {
          setSaving(true);
          const emptyConfig = { maxStudyHoursPerDay: 8, heuresSommeilMin: 8, fixedCommitments: [], pomoWork: 25, pomoBreak: 5 };
          await fetch('http://localhost:3001/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emptyConfig)
          });
          const emptyCours = { semestres: [] };
          await fetch('http://localhost:3001/api/cours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emptyCours)
          });
          addToast("Reinitialisation terminee. Rechargement...", 'info');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addToast("Erreur lors de la reinitialisation : " + err.message, 'error');
          setSaving(false);
        }
      }
    }
  };

  if (loading || loadingCours) return <div style={{textAlign:'center', marginTop:'5rem'}}>Initialisation des Cerveaux...</div>;

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
            <Dashboard 
              key="dash" 
              coursConfig={coursConfig} 
              onSaveCours={handleSaveCours}
              pomoWork={config?.pomoWork || 25}
              pomoBreak={config?.pomoBreak || 5}
            />
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
                  <button 
                    className="btn-primary"
                    onClick={handleSaveConfig}
                    disabled={saving}
                  >
                    {saving ? 'Synchronisation...' : 'Sauvegarder la Configuration'}
                  </button>
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
              <CoursPage 
                coursConfig={coursConfig} 
                onSave={handleSaveCours} 
                saving={savingCours} 
              />
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
              <EntrainementPage 
                coursConfig={coursConfig} 
                onSave={handleSaveCours} 
                saving={savingCours} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
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
