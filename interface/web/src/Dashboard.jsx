import { useState, useEffect } from 'react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/orchestrateur')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{textAlign:'center', marginTop:'5rem'}}>Analyse cérébrale en cours...</div>;
  }

  if (!data || data.error) {
    return (
      <div className="card glass-panel" style={{textAlign:'center', marginTop:'3rem'}}>
        <h2>Bienvenue sur ELPIS</h2>
        <p style={{color:'var(--text-secondary)'}}>Configure tes objectifs et tes cours pour activer l'Orchestrateur.</p>
      </div>
    );
  }

  const { statut, tempsDispoMin, tempsRequisMin, tachesDuJour } = data;
  const surcharge = statut === "SURCHARGE";
  
  // Calcul pour la jauge
  const pourcentageCharge = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  return (
    <div className="dashboard">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <div>
          <h1>Tableau de Bord</h1>
          <p style={{color:'var(--text-secondary)', marginTop:'-1.5rem', fontSize:'1.1rem'}}>Vue d'ensemble de ton énergie et de tes objectifs.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Panneau Énergie */}
        <div className="card glass-panel">
          <h2 style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
            ⚡ Charge du Jour
            <span className={`status-badge ${surcharge ? 'status-surcharge' : 'status-ok'}`}>
              {surcharge ? 'SURCHARGE' : 'OK'}
            </span>
          </h2>
          
          <div style={{marginTop:'2rem', marginBottom:'1rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
              <span style={{color:'var(--text-secondary)'}}>Temps Requis : <strong>{Math.round(tempsRequisMin/60 * 10)/10}h</strong></span>
              <span style={{color:'var(--text-secondary)'}}>Temps Libre : <strong>{Math.round(tempsDispoMin/60 * 10)/10}h</strong></span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{
                  width: `${pourcentageCharge}%`, 
                  backgroundColor: surcharge ? 'var(--danger-color)' : 'var(--success-color)'
                }}
              ></div>
            </div>
          </div>
          
          {surcharge ? (
            <div style={{background:'rgba(239, 68, 68, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--danger-color)'}}>
              <strong>⚠️ Alerte Burnout :</strong> Tu as prévu trop de choses aujourd'hui par rapport à tes objectifs de sommeil et de travail. Pense à reporter certaines tâches !
            </div>
          ) : (
            <div style={{background:'rgba(16, 185, 129, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--success-color)'}}>
              <strong>✅ Équilibre parfait :</strong> Ta charge de travail est totalement compatible avec tes objectifs de santé.
            </div>
          )}
        </div>

        {/* Panneau To-Do List du Cerveau */}
        <div className="card glass-panel">
          <h2>🎯 Objectifs Générés</h2>
          
          {tachesDuJour.length === 0 ? (
            <p style={{color:'var(--text-secondary)', fontStyle:'italic'}}>Rien de prévu aujourd'hui. Profite !</p>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'0.8rem', marginTop:'1.5rem'}}>
              {tachesDuJour.map((t, i) => (
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  background:'rgba(255,255,255,0.03)', padding:'0.8rem 1rem', borderRadius:'8px',
                  borderLeft: t.type === 'CM' ? '3px solid #818CF8' : t.type === 'TD' ? '3px solid #34D399' : '3px solid #FBBF24'
                }}>
                  <div>
                    <div style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>{t.matiere}</div>
                    <div style={{fontWeight:'bold'}}>{t.type} : {t.titre}</div>
                  </div>
                  <div style={{background:'var(--bg-tertiary)', padding:'0.3rem 0.6rem', borderRadius:'6px', fontSize:'0.85rem'}}>
                    ~{t.dureeMinutes} min
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
