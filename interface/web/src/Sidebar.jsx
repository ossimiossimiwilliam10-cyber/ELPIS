import { useState, useEffect } from 'react';
import { NAV_GROUPS } from './navigation';

/**
 * Barre latérale de navigation.
 *
 * Les entrées de menu viennent de `navigation.js`, partagé avec la table de routage :
 * une page ne peut plus exister dans le menu sans être rendue, ni l'inverse.
 */
function Sidebar({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  streak,
  pendingTasksCount,
  isMobileMenuOpen,
  onCloseMobileMenu,
  onRequestShutdown,
}) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(localStorage.getItem('elpis_offline_pending_sync') === 'true');
  const [notifPermission, setNotifPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOffline(!navigator.onLine);
      setPendingSync(localStorage.getItem('elpis_offline_pending_sync') === 'true');
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    window.addEventListener('elpis_offline_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      window.removeEventListener('elpis_offline_status_changed', handleStatusChange);
    };
  }, []);

  // Fermeture du menu mobile au clavier.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseMobileMenu?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen, onCloseMobileMenu]);

  /**
   * La permission de notification n'est demandée que sur geste explicite : la demander
   * au chargement fait fuir l'utilisateur et les navigateurs pénalisent le domaine.
   */
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {
      // Permission refusée ou API indisponible : l'app fonctionne sans.
    }
  };

  const navContext = { pendingTasksCount };
  const resolve = (value) => (typeof value === 'function' ? value(navContext) : value);

  return (
    <div className={`sidebar glass-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <h1>ELPIS</h1>
        <p className="subtitle">Compagnon Intelligent</p>
      </div>

      <nav className="sidebar-nav" aria-label="Navigation principale">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            <div className="sidebar-nav-group-title">
              {group.title}
            </div>
            {group.tabs.map(tab => {
              const isActive = activeTab === tab.id;
              const badge = resolve(tab.badge);
              return (
                <button
                  key={tab.id}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar-icon" aria-hidden="true">{resolve(tab.icon)}</span>
                  {tab.label}
                  {badge > 0 && (
                    <span className="sidebar-badge" aria-label={`${badge} tâche(s) en attente`}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}}>
          <div className="streak-badge" aria-label={`Série en cours : ${streak} jour${streak > 1 ? 's' : ''}`}>
            🔥 {streak} {streak > 1 ? 'jours' : 'jour'}
          </div>
        </div>
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem'}} className="theme-toggle">
          <button
            className="btn-secondary"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            aria-label={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            style={{padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {notifPermission === 'default' && (
            <button
              className="btn-secondary"
              onClick={handleEnableNotifications}
              title="Activer les rappels de tâches"
              aria-label="Activer les rappels de tâches"
              style={{padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}
            >
              🔔
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={onRequestShutdown}
            title="Éteindre l'application"
            aria-label="Éteindre l'application"
            style={{padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444'}}
          >
            🛑
          </button>
        </div>
        <div className="system-status">
          <div className={`status-dot ${isOffline ? (pendingSync ? 'orange' : 'red') : 'green'}`}></div>
          <span>{isOffline ? (pendingSync ? 'Hors-Ligne (Sync en attente)' : 'Hors-Ligne') : 'Système en ligne'}</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
