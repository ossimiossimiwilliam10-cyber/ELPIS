import { useState, useEffect, lazy, Suspense } from 'react';
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
const MesVideosPage = lazy(() => import('./MesVideosPage'));
const ClassementPage = lazy(() => import('./ClassementPage'));
const GraphPage = lazy(() => import('./GraphPage'));
const AbsencesPage = lazy(() => import('./AbsencesPage'));
const StagesPage = lazy(() => import('./StagesPage'));
const ConfigPage = lazy(() => import('./ConfigPage'));
import useStore from './store';

// Mini-fallback pour le chargement paresseux des pages
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
    <div className="loading-spinner" style={{ marginRight: '0.75rem' }}></div>
    Chargement...
  </div>
);

function AppInner() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(!sessionStorage.getItem('elpisDisclaimerShown'));
  const { addToast } = useToast();

  const { config, loading, error, initData, activeTab, setActiveTab, pendingTasksCount } = useStore();

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
      root.classList.remove('theme-morning', 'theme-afternoon', 'theme-evening', 'theme-night');
      root.classList.add(themeClass);
    };

    updateDynamicTheme();
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
    if (pendingTasksCount > 0 && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const today = new Date().toISOString().split('T')[0];
      const lastNotified = localStorage.getItem('elpisLastNotified');

      if (lastNotified !== today) {
        try {
          new Notification("ELPIS - Objectif 10/10", {
            body: `Vous avez ${pendingTasksCount} tâche(s) en attente aujourd'hui. C'est le moment de garder votre Streak ! 🔥`,
            icon: '/vite.svg'
          });
        } catch (e) {
          // Ignorer les erreurs de notification
        }
        localStorage.setItem('elpisLastNotified', today);
      }
    }
  }, [pendingTasksCount]);

  if (loading) return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      {/* Sidebar skeleton */}
      <div style={{width:'260px', height:'100vh', position:'fixed', top:0, left:0, padding:'2rem 1.5rem', borderRight:'1px solid rgba(255,255,255,0.05)', background:'var(--bg-primary)', zIndex:100}}>
        <div className="skeleton skeleton-text" style={{height:'32px', width:'75%', marginBottom:'1.5rem'}}></div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton skeleton-text" style={{marginBottom:'1.2rem'}}></div>
        ))}
        <div style={{marginTop:'auto', paddingTop:'2rem', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
          <div className="skeleton skeleton-text" style={{width:'80%', marginBottom:'0.5rem'}}></div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div style={{flex:1, marginLeft:'260px', padding:'2rem 3rem'}}>
        {/* Title */}
        <div className="skeleton skeleton-text" style={{height:'28px', width:'45%', marginBottom:'2rem'}}></div>

        {/* KPIs row */}
        <div style={{display:'flex', gap:'2rem', marginBottom:'2.5rem', flexWrap:'wrap'}}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem'}}>
              <div className="skeleton skeleton-circle"></div>
              <div className="skeleton skeleton-text" style={{width:'56px'}}></div>
            </div>
          ))}
        </div>

        {/* Large card */}
        <div className="skeleton skeleton-card" style={{height:'180px'}}></div>

        {/* Smaller card */}
        <div className="skeleton skeleton-card" style={{height:'120px', width:'60%'}}></div>
      </div>
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
          aria-label="Menu"
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
          setIsMobileMenuOpen(false);
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

          {activeTab === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <ConfigPage />
              </Suspense>
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
              <Suspense fallback={<LoadingFallback />}>
                <StatistiquesPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'classement' && (
            <motion.div
              key="classement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <ClassementPage />
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

          {activeTab === 'absences' && (
            <motion.div
              key="absences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <AbsencesPage />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'stages' && (
            <motion.div
              key="stages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <StagesPage />
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

          {activeTab === 'mes_videos' && (
            <motion.div
              key="mes_videos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <MesVideosPage />
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

          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%' }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <GraphPage />
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
