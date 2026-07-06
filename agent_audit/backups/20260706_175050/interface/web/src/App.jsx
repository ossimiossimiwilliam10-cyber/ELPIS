import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import Dashboard from './Dashboard';
import Sidebar from './Sidebar';
import GlobalSearchModal from './GlobalSearchModal';
import GlobalChrono from './components/GlobalChrono';
import DisclaimerModal from './components/DisclaimerModal';
import AICoachSidebar from './components/AICoachSidebar';
import BackgroundMusicPlayer from './components/BackgroundMusicPlayer';
import { ToastProvider, useToast } from './ToastProvider';

// Code splitting : pages lourdes chargées à la demande
const CoursPage = lazy(() => import('./CoursPage'));
const EntrainementPage = lazy(() => import('./EntrainementPage'));
import MusicSettingsModal from './components/MusicSettingsModal';
const StatistiquesPage = lazy(() => import('./StatistiquesPage'));
const BulletinPage = lazy(() => import('./BulletinPage'));
const PreparationHebdoPage = lazy(() => import('./PreparationHebdoPage'));
const RevisionsAvanceesPage = lazy(() => import('./RevisionsAvanceesPage'));
const ProjetsPage = lazy(() => import('./ProjetsPage'));
import useStore from './store';

// Mini-fallback pour le chargement paresseux des pages
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
    <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid var(--bg-tertiary)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.75rem' }}></div>
    Chargement...
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

function AppInner() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(!sessionStorage.getItem('elpisDisclaimerShown'));
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

  // === Dynamic Time-based Theme ===
  useEffect(() => {
    const updateDynamicTheme = () => {
      // Si on est en mode clair, on ne met pas de thème dynamique sombre
      if (theme === 'light') return;

      const hour = new Date().getHours();
      let themeClass = '';

      if (hour >= 6 && hour < 12) {
        themeClass = 'theme-morning';
      } else if (hour >= 12 && hour < 18) {
        themeClass = 'theme-afternoon';
      } else if (hour >= 18 && hour < 22) {
        themeClass = 'theme-evening';
      } else {
        themeClass = 'theme-night';
      }

      const root = document.documentElement;
      // Remove existing dynamic theme classes
      root.classList.remove('theme-morning', 'theme-afternoon', 'theme-evening', 'theme-night');
      // Add current dynamic theme class
      root.classList.add(themeClass);
    };

    updateDynamicTheme();
    // Check every minute if the theme needs to change
    const intervalId = setInterval(updateDynamicTheme, 60000);
    return () => clearInterval(intervalId);
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
        try {
          new Notification("ELPIS - Objectif 10/10", {
            body: `Vous avez ${pendingTasksCount} tâche(s) en attente aujourd'hui. C'est le moment de garder votre Streak ! 🔥`,
            icon: '/vite.svg'
          });
        } catch (e) {
        }
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
      } catch {
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
          const emptyConfig = { studyStartDate: "07-09-2026", bedtime: "23:00", wakeUpTime: "07:00", targetGrade: 14, targetRank: 10, summerStudyHoursCompleted: 0, maxSubjectsPerDay: 3, studyBlockDurationMinutes: 50, activeRecallMinutesPerDay: 30, subjects: [], fixedCommitments: [], theme: "dark", pomoWork: 25, pomoBreak: 5, lastActiveDate: "", currentStreak: 0, bestStreak: 0 };
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
      <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>Initialisation d'ELPIS...</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const handleCloseDisclaimer = () => {
    sessionStorage.setItem('elpisDisclaimerShown', 'true');
    setShowDisclaimer(false);
  };

  return (
    <div className="app-layout">
      {showDisclaimer && <DisclaimerModal onClose={handleCloseDisclaimer} />}
      <BackgroundMusicPlayer />

      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-header-title">ELPIS</div>
        <button
          className="hamburger-btn"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          ☰
        </button>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(t) => {
          setActiveTab(t);
          setIsMobileMenuOpen(false); // Fermer le menu sur mobile après un clic
        }}
        theme={theme}
        setTheme={setTheme}
        streak={config?.currentStreak || 0}
        pendingTasksCount={pendingTasksCount}
        isMobileMenuOpen={isMobileMenuOpen}
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
              <Suspense fallback={<LoadingFallback />}>
                <StatistiquesPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'bulletin' && (
            <motion.div
              key="bulletin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <BulletinPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'projets' && (
            <motion.div
              key="projets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <ProjetsPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'prep_hebdo' && (
            <motion.div
              key="prep_hebdo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <PreparationHebdoPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'revisions_avancees' && (
            <motion.div
              key="revisions_avancees"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <RevisionsAvanceesPage />
              </Suspense>
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
              {/* En-tête Configuration */}
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem'}}>
                <h1 style={{margin: 0, fontSize: '2rem'}}>⚙️ Configuration</h1>
              </div>

              {/* Profile Summary - Sleek KPIs */}
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '2.5rem'}}>
                {[
                  { label: "Semestres", val: profileSummary.semestres, color: "#a78bfa", icon: "📅" },
                  { label: "UEs", val: profileSummary.ues, color: "#60a5fa", icon: "📚" },
                  { label: "Matières", val: profileSummary.matieres, color: "#f59e0b", icon: "📘" },
                  { label: "CM", val: profileSummary.cm, color: "#3b82f6", icon: "🏛️" },
                  { label: "TD", val: profileSummary.td, color: "#34d399", icon: "📝" },
                  { label: "TP", val: profileSummary.tp, color: "#fbbf24", icon: "🔬" }
                ].map((stat, i) => (
                  <div key={i} className="card glass-panel" style={{textAlign: 'center', padding: '1rem', borderTop: `3px solid ${stat.color}`}}>
                    <div style={{fontSize: '1.5rem', marginBottom: '0.2rem'}}>{stat.icon}</div>
                    <div style={{fontSize: '2rem', fontWeight: 'bold', color: stat.color}}>{stat.val}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px'}}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2.5rem'}}>
                {/* Préférences Générales (Nouveau système IA) */}
                <div className="card glass-panel" style={{display: 'flex', flexDirection: 'column'}}>
                  <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)'}}>
                    <span>🎯</span> Objectifs de Réussite
                  </h2>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem'}}>
                    Renseigne tes objectifs, l'IA s'occupe de calculer ton temps d'étude optimal chaque jour.
                  </p>

                  <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem'}}>
                    <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 'bold'}}>
                      Note Cible Estimée
                      <span style={{fontSize: '1.2rem', color: 'var(--success-color)'}}>{config.targetGrade || 14}/20</span>
                    </label>
                    <input
                      type="range"
                      value={config.targetGrade || 14}
                      onChange={e => setConfig({...config, targetGrade: parseFloat(e.target.value) || 10})}
                      min="10" max="20" step="0.5"
                      style={{width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)'}}
                    />
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px'}}>
                      <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Rang Visé
                      </label>
                      <select
                        value={config.targetRank || 50}
                        onChange={e => setConfig({...config, targetRank: parseInt(e.target.value) || 50})}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--bg-tertiary)'}}
                      >
                        <option value={50}>Moyen (Top 50%)</option>
                        <option value={20}>Bon (Top 20%)</option>
                        <option value={10}>Très Bon (Top 10%)</option>
                        <option value={5}>Excellent (Top 5%)</option>
                        <option value={1}>Major (Top 1%)</option>
                      </select>
                    </div>

                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px'}}>
                      <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Heure de Coucher (24h)
                        <span style={{display:'block', fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'0.2rem', fontWeight:'normal'}}>L'affichage AM/PM dépend du navigateur (ex: 11:00 PM = 23:00).</span>
                      </label>
                      <input
                        type="time"
                        value={config?.bedtime || "23:00"}
                        onChange={e => setConfig({...config, bedtime: e.target.value})}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--bg-tertiary)'}}
                      />
                    </div>
                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px'}}>
                      <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Heure de Réveil (24h)
                      </label>
                      <input
                        type="time"
                        value={config?.wakeUpTime || "07:00"}
                        onChange={e => setConfig({...config, wakeUpTime: e.target.value})}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--bg-tertiary)'}}
                      />
                    </div>
                  </div>
                </div>

                {/* Paramètres de l'Orchestrateur */}
                <div className="card glass-panel" style={{display: 'flex', flexDirection: 'column'}}>
                  <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7'}}>
                    <span>🧠</span> Paramètres de l'Orchestrateur
                  </h2>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem'}}>
                    Contrôle la façon dont l'IA génère les nouvelles tâches pour éviter la surcharge.
                  </p>

                  <div style={{display: 'grid', gap: '1rem', marginBottom: '1rem'}}>
                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #a855f7'}}>
                      <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Agressivité Anti-Ennui (Fast-Track)
                        <span style={{fontSize: '1rem', color: '#a855f7'}}>x{config.antiEnnuiMultiplier || 2.0}</span>
                      </label>
                      <input
                        type="range"
                        min="1.0" max="4.0" step="0.1"
                        value={config.antiEnnuiMultiplier || 2.0}
                        onChange={e => setConfig({...config, antiEnnuiMultiplier: parseFloat(e.target.value) || 2.0})}
                        style={{width: '100%', cursor: 'pointer', accentColor: '#a855f7'}}
                      />
                      <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0}}>
                        Multiplicateur d'intervalle quand un exercice est jugé "Très Facile". Plus c'est haut, plus le planning se purge vite.
                      </p>
                    </div>

                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #ef4444'}}>
                      <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Max Nouveaux CM / Matière / Jour
                      </label>
                      <input
                        type="number"
                        min="1" max="10"
                        value={config.maxNewCMPerSubjectPerDay || 1}
                        onChange={e => setConfig({...config, maxNewCMPerSubjectPerDay: parseInt(e.target.value) || 1})}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--bg-tertiary)'}}
                      />
                    </div>

                    <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #f59e0b'}}>
                      <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        Max Nouveaux CM / Semestre / Jour
                      </label>
                      <input
                        type="number"
                        min="1" max="20"
                        value={config.maxNewCMPerSemesterPerDay || 3}
                        onChange={e => setConfig({...config, maxNewCMPerSemesterPerDay: parseInt(e.target.value) || 3})}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--bg-tertiary)'}}
                      />
                    </div>
                  </div>

                  <div style={{background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
                    <strong style={{color: '#ef4444'}}>⚠️ Fortement conseillé :</strong> Garde ces limites basses pour ne pas t'épuiser. Augmente-les uniquement en dernier recours si tu as beaucoup de retard.
                  </div>
                </div>

                {/* Estimation des Durées */}
                <div className="card glass-panel" style={{display: 'flex', flexDirection: 'column'}}>
                  <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399'}}>
                    <span>⏱️</span> Calibrage de l'Algorithme
                  </h2>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem'}}>
                    Durées par défaut allouées aux exercices sans moyenne personnalisée.
                  </p>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    {[
                      { key: 'defaultDurationNewCM', label: 'Nouveau CM', color: '#3b82f6', defaultVal: 120 },
                      { key: 'defaultDurationRevCM', label: 'Révision CM', color: '#60a5fa', defaultVal: 30 },
                      { key: 'defaultDurationTD', label: 'Durée TD', color: '#34d399', defaultVal: 20 },
                      { key: 'defaultDurationAnki', label: 'Flashcards (Anki)', color: '#8b5cf6', defaultVal: 30 },
                      { key: 'defaultDurationTP_Etape1', label: 'TP (Étape 1)', color: '#fbbf24', defaultVal: 45 },
                      { key: 'defaultDurationTP_Etape2', label: 'TP (Étape 2)', color: '#fbbf24', defaultVal: 180 },
                      { key: 'defaultDurationTP_Etape3', label: 'TP (Étape 3)', color: '#fbbf24', defaultVal: 90 },
                      { key: 'defaultDurationTP_Etape4', label: 'TP (Étape 4)', color: '#fbbf24', defaultVal: 30 },
                      { key: 'defaultDurationAnnales', label: 'Annales', color: '#ef4444', defaultVal: 60 }
                    ].map(item => (
                      <div key={item.key} style={{background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', borderLeft: `3px solid ${item.color}`}}>
                        <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{item.label}</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <input
                            type="number"
                            min="5"
                            value={config[item.key] || item.defaultVal}
                            onChange={e => setConfig({...config, [item.key]: parseInt(e.target.value) || item.defaultVal})}
                            style={{width: '60px', padding: '0.3rem', background: 'var(--bg-primary)', border: 'none', color: 'white', borderRadius: '4px'}}
                          />
                          <span style={{fontSize: '0.8rem', color: 'var(--text-tertiary)'}}>min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>



              {/* Danger Zone & Actions */}
              <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
                {/* Sauvegarde */}
                <div className="card glass-panel" style={{flex: '1 1 300px', borderTop: '3px solid #10b981', display: 'flex', flexDirection: 'column'}}>
                  <h3 style={{color: '#10b981', marginBottom: '1rem'}}>💾 Sauvegarde Locale</h3>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1}}>
                    L'application sauvegarde tout automatiquement dans ton navigateur. Tu peux exporter un backup manuel de sécurité (Format JSON).
                  </p>
                  <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                    <button
                      onClick={downloadBackup}
                      style={{flex: 1, padding: '0.6rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}
                    >Export JSON</button>
                    <div style={{flex: 1}}>
                      <input
                        type="file"
                        accept=".json"
                        id="import-backup"
                        style={{display: 'none'}}
                        onChange={handleImportBackup}
                      />
                      <label
                        htmlFor="import-backup"
                        style={{display: 'block', textAlign: 'center', padding: '0.6rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}
                      >Importer</label>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="card glass-panel" style={{flex: '1 1 300px', borderTop: '3px solid #ef4444', display: 'flex', flexDirection: 'column'}}>
                  <h3 style={{color: '#ef4444', marginBottom: '1rem'}}>⚠️ Zone de Danger</h3>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1}}>
                    Attention, ces actions sont irréversibles. Une remise à zéro supprime ton historique, tes cours, et tes statistiques.
                  </p>
                  <div style={{marginTop: '1.5rem'}}>
                    <button
                      onClick={handleFactoryReset}
                      style={{width: '100%', padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'}}
                      onMouseOver={e => {e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'}}
                      onMouseOut={e => {e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'}}
                    >
                      Remise à Zéro Totale
                    </button>
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
              <Suspense fallback={<LoadingFallback />}>
                <CoursPage />
              </Suspense>
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
              <Suspense fallback={<LoadingFallback />}>
                <EntrainementPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'musique' && (
            <motion.div
              key="musique"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MusicSettingsModal onClose={() => setActiveTab('dashboard')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <GlobalSearchModal />
      <GlobalChrono />
      <AICoachSidebar />
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
