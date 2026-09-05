import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import Sidebar from './Sidebar';
import GlobalSearchModal from './GlobalSearchModal';
import GlobalChrono from './components/GlobalChrono';
import DisclaimerModal from './components/DisclaimerModal';
import Repetiteur from './components/Repetiteur';
import BackgroundMusicPlayer from './components/BackgroundMusicPlayer';
import { ToastProvider, useToast } from './ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmModal from './components/ConfirmModal';
import ShutdownScreen from './components/ShutdownScreen';
import { ROUTES } from './routes';
import { DEFAULT_TAB } from './navigation';
import { useHashRoute } from './hooks/useHashRoute';
import { getApiUrl } from './utils/apiConfig';
import useStore from './store';

// Mini-fallback pour le chargement paresseux des pages
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
    <div className="loading-spinner" style={{ marginRight: '0.75rem' }}></div>
    Chargement...
  </div>
);

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

/** Rend la page correspondant à l'onglet actif via la table de routage. */
function PageOutlet({ activeTab, setActiveTab }) {
  const route = ROUTES[activeTab] || ROUTES[DEFAULT_TAB];
  const Page = route.component;
  const pageProps = route.props ? route.props({ setActiveTab }) : {};

  const content = route.lazy === false
    ? <Page {...pageProps} />
    : <Suspense fallback={<LoadingFallback />}><Page {...pageProps} /></Suspense>;

  return (
    <motion.div
      key={activeTab}
      {...pageTransition}
      style={route.fullHeight ? { height: '100%' } : undefined}
    >
      {content}
    </motion.div>
  );
}

function AppInner() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(!sessionStorage.getItem('elpisDisclaimerShown'));
  // 'idle' → 'confirm' → 'done' : l'extinction est un état de l'application entière.
  const [shutdownState, setShutdownState] = useState('idle');
  const { addToast } = useToast();

  const { config, loading, error, initData, activeTab, setActiveTab, pendingTasksCount } = useStore();

  // Onglet actif ↔ fragment d'URL : liens profonds et bouton Retour fonctionnels.
  useHashRoute(activeTab, setActiveTab);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
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

  /*
   * Annuler / rétablir au clavier.
   *
   * Le geste est universel, et c'est celui qu'on tente d'instinct après une
   * fausse manœuvre. Les champs de saisie sont exclus : Ctrl+Z y appartient au
   * navigateur, qui défait la frappe — le détourner ferait perdre le texte en
   * cours au lieu de réparer quoi que ce soit.
   */
  useEffect(() => {
    const surTouche = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;

      const cible = e.target;
      const dansUnChamp = cible?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible?.tagName);
      if (dansUnChamp) return;

      e.preventDefault();
      const { annulerDernierGeste, retablirDernierGeste } = useStore.getState();
      const libelle = e.shiftKey ? retablirDernierGeste() : annulerDernierGeste();

      if (libelle) addToast(e.shiftKey ? `Rétabli : ${libelle}` : `Annulé : ${libelle}`, 'info');
      else addToast(e.shiftKey ? "Rien à rétablir." : "Rien à annuler.", 'info', 2500);
    };

    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [addToast]);

  // Rappel des tâches en attente, une fois par jour, uniquement si l'utilisateur a
  // lui-même accordé la permission (bouton dédié dans la barre latérale).
  useEffect(() => {
    if (pendingTasksCount > 0 && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const today = new Date().toISOString().split('T')[0];
      const lastNotified = localStorage.getItem('elpisLastNotified');

      if (lastNotified !== today) {
        try {
          new Notification("ELPIS — ta session du jour", {
            body: `Il te reste ${pendingTasksCount} tâche${pendingTasksCount > 1 ? 's' : ''} aujourd'hui. Ta série s'arrête si la journée se termine sans rien.`,
            icon: '/vite.svg'
          });
        } catch {
          // Notification indisponible : rien à faire, ce n'est qu'un rappel.
        }
        localStorage.setItem('elpisLastNotified', today);
      }
    }
  }, [pendingTasksCount]);

  const handleCloseDisclaimer = () => {
    sessionStorage.setItem('elpisDisclaimerShown', 'true');
    setShowDisclaimer(false);
  };

  const handleShutdown = async () => {
    setShutdownState('done');
    try {
      await fetch(`${getApiUrl()}/shutdown`, { method: 'POST' });
    } catch {
      // Le serveur se coupe avant de répondre : c'est le cas nominal.
    }
    window.close(); // Sans effet hors fenêtre ouverte par script : l'écran prend le relais.
  };

  if (shutdownState === 'done') return <ShutdownScreen />;

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
          aria-label="Ouvrir le menu"
          aria-expanded={isMobileMenuOpen}
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
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onRequestShutdown={() => setShutdownState('confirm')}
      />

      <main className="main-content">
        <AnimatePresence mode="wait">
          <PageOutlet key={activeTab} activeTab={activeTab} setActiveTab={setActiveTab} />
        </AnimatePresence>
      </main>

      <GlobalSearchModal />
      <GlobalChrono />
      <Repetiteur />

      <ConfirmModal
        isOpen={shutdownState === 'confirm'}
        onConfirm={handleShutdown}
        onCancel={() => setShutdownState('idle')}
        title="Éteindre ELPIS"
        message="Ton travail est déjà enregistré. Tu reprendras où tu en étais."
        confirmLabel="Éteindre"
        danger
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
