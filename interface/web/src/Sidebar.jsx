import React, { useState, useEffect } from 'react';

function Sidebar({ activeTab, setActiveTab, theme, setTheme, streak, pendingTasksCount, isMobileMenuOpen }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(localStorage.getItem('elpis_offline_pending_sync') === 'true');

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
  const navGroups = [
    {
      title: "Quotidien",
      tabs: [
        { id: 'dashboard', label: 'Accueil', icon: '🏠', badge: pendingTasksCount },
        { id: 'entrainement', label: 'Session du Jour', icon: '🎯' },
        { id: 'revisions_avancees', label: 'Avance & Bonus', icon: pendingTasksCount > 0 ? '🔒' : '🚀' },
      ]
    },
    {
      title: "Scolarité",
      tabs: [
        { id: 'cours', label: 'Bibliothèque', icon: '📚' },
        { id: 'prep_hebdo', label: 'Préparation Hebdo', icon: '📅' },
        { id: 'bulletin', label: 'Bulletin & Notes', icon: '📝' },
        { id: 'projets', label: 'Projets Personnels', icon: '💡' }
      ]
    },
    {
      title: "Système",
      tabs: [
        { id: 'statistiques', label: 'Statistiques', icon: '📈' },
        { id: 'config', label: 'Configuration', icon: '⚙️' },
        { id: 'musique', label: 'Musique', icon: '🎵' },
      ]
    }
  ];

  return (
    <div className={`sidebar glass-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <h1>ELPIS</h1>
        <p className="subtitle">Compagnon Intelligent</p>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group, gIndex) => (
          <div key={gIndex} style={{marginBottom: '1rem'}}>
            <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.5rem'}}>
              {group.title}
            </div>
            {group.tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sidebar-icon">{tab.icon}</span>
                {tab.label}
                {tab.badge > 0 && (
                  <span className="sidebar-badge">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}}>
          <div style={{background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            🔥 Streak : {streak} {streak > 1 ? 'Jours' : 'Jour'}
          </div>
        </div>
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem'}} className="theme-toggle">
          <button
            className="btn-secondary"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            style={{padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            className="btn-secondary"
            onClick={async () => {
              if (window.confirm("Voulez-vous vraiment éteindre ELPIS ?")) {
                // Tenter la requête shutdown (best effort)
                try { await fetch('/api/shutdown', { method: 'POST' }); } catch {
                  // Ignorer l'erreur si Chrome n'est pas trouvé
                }
                // Tenter window.close() (ne fonctionne que si la page a été ouverte par script)
                window.close();
                // Si après 500ms la page est toujours ouverte, afficher un message propre
                setTimeout(() => {
                  if (!document.hidden && document.body) {
                    document.body.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;font-family:sans-serif'><h1>ELPIS est éteint. Vous pouvez fermer cet onglet.</h1></div>";
                  }
                }, 500);
              }
            }}
            title="Éteindre l'application"
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
