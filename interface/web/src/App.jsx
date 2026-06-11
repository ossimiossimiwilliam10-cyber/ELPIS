import { useState, useEffect } from 'react';
import './index.css';
import CoursPage from './CoursPage';
import EntrainementPage from './EntrainementPage';
import Dashboard from './Dashboard';

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
    // Charger la Config
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

    // Charger les Cours
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

  const handleSaveConfig = () => {
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
    <div className="app-container">
      <header style={{textAlign:'center', marginBottom:'3rem'}}>
        <h1 style={{marginBottom:'0.5rem'}}>ELPIS</h1>
        <p style={{color:'var(--text-secondary)', fontSize:'1.2rem', marginTop:0}}>Compagnon d'Étude Intelligent</p>
      </header>

      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dashboard'); setSuccessMsg(''); setError(''); }}
        >
          🏠 Accueil
        </button>
        <button 
          className={`nav-tab ${activeTab === 'entrainement' ? 'active' : ''}`}
          onClick={() => { setActiveTab('entrainement'); setSuccessMsg(''); setError(''); }}
        >
          🏋️ Entraînement
        </button>
        <button 
          className={`nav-tab ${activeTab === 'cours' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cours'); setSuccessMsg(''); setError(''); }}
        >
          📚 Mes Cours
        </button>
        <button 
          className={`nav-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => { setActiveTab('config'); setSuccessMsg(''); setError(''); }}
        >
          ⚙️ Configuration
        </button>
      </nav>

      <main>
        {error && <div style={{background:'rgba(239, 68, 68, 0.1)', color:'var(--danger-color)', padding:'1rem', borderRadius:'8px', marginBottom:'1rem'}}>❌ {error}</div>}
        {successMsg && <div style={{background:'rgba(16, 185, 129, 0.1)', color:'var(--success-color)', padding:'1rem', borderRadius:'8px', marginBottom:'1rem'}}>✅ {successMsg}</div>}

        {activeTab === 'dashboard' && <Dashboard />}

        {activeTab === 'config' && (
          <div className="card glass-panel config-panel">
            <h2 style={{marginBottom:'2rem'}}>Préférences Générales</h2>
            
            <div style={{marginBottom:'1.5rem'}}>
              <label style={{display:'block', marginBottom:'0.5rem', color:'var(--text-secondary)'}}>Heures d'étude par jour :</label>
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

            <button 
              className="btn-primary"
              onClick={handleSaveConfig}
              disabled={saving}
            >
              {saving ? 'Synchronisation C++...' : 'Sauvegarder les objectifs'}
            </button>
          </div>
        )}

        {activeTab === 'cours' && (
          <CoursPage 
            coursConfig={coursConfig} 
            onSave={handleSaveCours} 
            saving={savingCours} 
          />
        )}

        {activeTab === 'entrainement' && (
          <EntrainementPage 
            coursConfig={coursConfig} 
            onSave={handleSaveCours} 
            saving={savingCours} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
