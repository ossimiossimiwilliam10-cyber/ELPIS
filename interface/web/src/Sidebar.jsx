import React, { useState, useEffect } from 'react';

function Sidebar({ activeTab, setActiveTab, theme, setTheme, streak, pendingTasksCount, isMobileMenuOpen }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(localStorage.getItem('elpis_offline_pending_sync') === 'true');
  const [isShuttingDown, setIsShuttingDown] = useState(false);

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
        { id: 'mes_videos', label: 'Mes Vidéos', icon: '🎥' },
        { id: 'prep_hebdo', label: 'Préparation Hebdo', icon: '📅' },
        { id: 'bulletin', label: 'Bulletin & Notes', icon: '📝' },
        { id: 'projets', label: 'Projets Personnels', icon: '💡' },
        { id: 'stages', label: 'Stages & Pro', icon: '💼' },
        { id: 'absences', label: 'Assiduité', icon: '🚨' }
      ]
    },
    {
      title: "Système",
      tabs: [
        { id: 'statistiques', label: 'Statistiques', icon: '📈' },
        { id: 'classement', label: 'Classement', icon: '🏆' },
        { id: 'graph', label: 'Graphe de Connaissances', icon: '🌌' },
        { id: 'config', label: 'Configuration', icon: '⚙️' },
        { id: 'musique', label: 'Musique', icon: '🎵' },
      ]
    }
  ];

  if (isShuttingDown) {
    return (
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'var(--bg-primary)',color:'var(--text-primary)',fontFamily:'inherit',position:'fixed',top:0,left:0,width:'100vw',zIndex:99999}}>
        <div style={{textAlign:'center'}}>
          <h1 style={{fontSize:'2rem',marginBottom:'1rem'}}>ELPIS est éteint.</h1>
          <p style={{color:'var(--text-secondary)'}}>Vous pouvez fermer cet onglet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`sidebar glass-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <h1>ELPIS</h1>
        <p className="subtitle">Compagnon Intelligent</p>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group, gIndex) => (
          <div key={gIndex} className="sidebar-nav-group">
            <div className="sidebar-nav-group-title">
              {group.title}
            </div>
            {group.tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
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
          <div className="streak-badge">
            🔥 {streak} {streak > 1 ? 'Jours' : 'Jour'}
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

          <button
            className="btn-secondary"
            onClick={async () => {
              if (window.confirm("Voulez-vous vraiment éteindre ELPIS ?")) {
                try { await fetch('/api/shutdown', { method: 'POST' }); } catch { /* best effort */ }
                window.close();
                setTimeout(() => {
                  if (!document.hidden && document.body) {
                    setIsShuttingDown(true);
                  }
                }, 500);
              }
            }}
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