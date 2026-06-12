import React from 'react';

function Sidebar({ activeTab, setActiveTab, theme, setTheme, streak }) {
  const tabs = [
    { id: 'dashboard', label: 'Accueil', icon: '🏠' },
    { id: 'entrainement', label: 'Entraînement', icon: '🏋️' },
    { id: 'cours', label: 'Mes Cours', icon: '📚' },
    { id: 'config', label: 'Configuration', icon: '⚙️' },
  ];

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <h1>ELPIS</h1>
        <p className="subtitle">Compagnon Intelligent</p>
      </div>

      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sidebar-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}}>
          <div style={{background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            🔥 Streak : {streak} {streak > 1 ? 'Jours' : 'Jour'}
          </div>
        </div>
        <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}} className="theme-toggle">
          <button 
            className="btn-secondary" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            style={{padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <div className="system-status">
          <div className="status-dot green"></div>
          <span>Système en ligne</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
