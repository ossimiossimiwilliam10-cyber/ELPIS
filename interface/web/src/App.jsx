import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import CoursPage from './CoursPage';
import EntrainementPage from './EntrainementPage';
import Dashboard from './Dashboard';
import Sidebar from './Sidebar';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // States pour la Config
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // States pour les Cours
  const [coursConfig, setCoursConfig] = useState(null);
  const [loadingCours, setLoadingCours] = useState(true);
  const [savingCours, setSavingCours] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        setError("Impossible de contacter le Pont Node.js (Config)");
        setLoading(false);
      });

    fetch('http://localhost:3001/api/cours')
      .then(res => res.json())
      .then(data => {
        setCoursConfig(data);
        setLoadingCours(false);
      })
      .catch(err => {
        console.error("Impossible de contacter le Pont Node.js (Cours)");
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
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet engagement ?")) {
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
  };

  const updateFixedCommitment = (index, field, value) => {
    const newConf = { ...config };
    newConf.fixedCommitments[index][field] = value;
    setConfig(newConf);
  };

  const handleSaveConfig = () => {
    // Validations
    let isValid = true;
    if (config.fixedCommitments) {
      for (const fc of config.fixedCommitments) {
        if (!fc.title || fc.title.trim() === '') isValid = false;
        if (!fc.startTime || !fc.endTime) isValid = false;
        if (fc.startTime && fc.endTime && fc.startTime >= fc.endTime) {
          setError(`Erreur: L'heure de fin doit être après l'heure de début pour "${fc.title}".`);
          return;
        }
      }
    }
    if (!isValid) {
      setError("Erreur: Veuillez remplir tous les champs des engagements fixes correctement.");
      return;
    }

    setSaving(true);
    setSuccessMsg("");
    setError(null);
    fetch('http://localhost:3001/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      setSuccessMsg(data.message);
    })
    .catch(err => {
      setError(err.message);
    })
    .finally(() => {
      setSaving(false);
    });
  };

  const handleSaveCours = (newCoursConfig) => {
    setSavingCours(true);
    setError(null);
    setSuccessMsg("");
    fetch('http://localhost:3001/api/cours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCoursConfig)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      setSuccessMsg(data.message);
      setCoursConfig(newCoursConfig);
    })
    .catch(err => {
      setError(err.message);
    })
    .finally(() => {
      setSavingCours(false);
    });
  };

  if (loading || loadingCours) return <div style={{textAlign:'center', marginTop:'5rem'}}>Initialisation des Cerveaux...</div>;

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSuccessMsg(''); setError(''); }} />

      <main className="main-content">
        {error && <div style={{background:'rgba(239, 68, 68, 0.1)', color:'var(--danger-color)', border:'1px solid var(--danger-color)', padding:'1rem', borderRadius:'8px', marginBottom:'1rem'}}>❌ {error}</div>}
        {successMsg && <div style={{background:'rgba(16, 185, 129, 0.1)', color:'var(--success-color)', border:'1px solid var(--success-color)', padding:'1rem', borderRadius:'8px', marginBottom:'1rem'}}>✅ {successMsg}</div>}

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard key="dash" coursConfig={coursConfig} onSaveCours={handleSaveCours} />
          )}

          {activeTab === 'config' && (
            <motion.div 
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="card glass-panel config-panel"
            >
              <h2 style={{marginBottom:'2rem'}}>Préférences Générales</h2>
              
              <div style={{marginBottom:'1.5rem'}}>
                <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Heures d'étude maximum par jour :</label>
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
              
              <div style={{marginBottom:'3rem'}}>
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

              {/* Section Engagements Fixes */}
              <h2 style={{marginBottom:'1rem', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem'}}>⏰ Engagements Fixes (Emploi du temps)</h2>
              <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem'}}>
                Ajoute tes horaires de cours, de travail ou d'activités régulières. Le système déduira automatiquement ce temps de ta disponibilité pour générer ton planning d'étude.
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
                      <button onClick={() => removeFixedCommitment(index)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--danger-color)', padding:0}} title="Supprimer">🗑️</button>
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
                        <span style={{color:'var(--text-secondary)'}}>à</span>
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

              <div style={{borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <button 
                  className="btn-secondary"
                  onClick={downloadBackup}
                  title="Télécharger une sauvegarde locale de vos cours et exercices"
                >
                  💾 Exporter Backup (JSON)
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleSaveConfig}
                  disabled={saving}
                >
                  {saving ? 'Synchronisation C++...' : 'Sauvegarder la Configuration'}
                </button>
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

export default App;
