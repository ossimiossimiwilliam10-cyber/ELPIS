import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import useStore from './store';

const HOURS = Array.from({length: 16}, (_, i) => i + 8); // 8h to 23h
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function getFrenchDayOfWeek() {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const frenchIndex = jsDay === 0 ? 6 : jsDay - 1; // Mon=0, ..., Sun=6
  return DAYS[frenchIndex];
}

function CalendrierPage() {
  const { config } = useStore();
  const [orchestrateurData, setOrchestrateurData] = useState(null);
  
  useEffect(() => {
    fetch('/api/orchestrateur')
      .then(res => res.json())
      .then(d => setOrchestrateurData(d))
      .catch(() => setOrchestrateurData(null));
  }, [config]);

  const commitments = useMemo(() => {
    if (!config?.fixedCommitments) return [];
    return config.fixedCommitments;
  }, [config]);

  const today = getFrenchDayOfWeek();
  const tachesDuJour = orchestrateurData?.tachesDuJour || [];
  const tempsRequis = orchestrateurData?.tempsRequisMin || 0;
  const tempsDispo = orchestrateurData?.tempsDispoMin || 0;
  const surcharge = orchestrateurData?.statut === 'SURCHARGE';

  const timeToGrid = (timeStr) => {
    if (!timeStr) return 8;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m/60;
  };

  return (
    <div className="calendrier-page">
      <div className="cours-header" style={{marginBottom:'2rem'}}>
        <h2>Calendrier Hebdomadaire</h2>
        <p style={{color:'var(--text-secondary)'}}>Vos engagements fixes et les tâches du jour.</p>
      </div>

      {/* === TODAY SUMMARY === */}
      <motion.div 
        className="card glass-panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{marginBottom:'2rem'}}
      >
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'1rem'}}>
          <h3 style={{margin:0}}>📋 Aujourd'hui ({today})</h3>
          <div style={{display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap'}}>
            <span style={{color:'var(--text-secondary)'}}>
              ⏱ {Math.round(tempsRequis/60 * 10)/10}h requis / {Math.round(tempsDispo/60 * 10)/10}h libre
            </span>
            <span className={`status-badge ${surcharge ? 'status-surcharge' : 'status-ok'}`}>
              {surcharge ? 'SURCHARGE' : 'OK'}
            </span>
          </div>
        </div>
        
        {tachesDuJour.length === 0 ? (
          <p style={{color:'var(--text-secondary)', textAlign:'center', padding:'1.5rem'}}>
            {commitments.length === 0 
              ? "Aucune tâche prévue. Ajoutez des cours dans « Mes Cours » et des engagements fixes dans « Configuration » pour voir votre planning."
              : "Aucune tâche de révision prévue aujourd'hui. Profitez de votre temps libre !"}
          </p>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'0.8rem'}}>
            {tachesDuJour.map((t, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '0.8rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--bg-tertiary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{minWidth: 0, flex: 1}}>
                  <div style={{fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={t.titre}>
                    {t.titre}
                  </div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                    {t.matiere} • {t.type}
                  </div>
                </div>
                <span style={{
                  background: t.type === 'CM' ? 'rgba(59, 130, 246, 0.15)' : t.type === 'TD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: t.type === 'CM' ? 'var(--accent-primary)' : t.type === 'TD' ? 'var(--success-color)' : 'var(--warning-color)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  ~{t.dureeMinutes} min
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* === WEEKLY GRID === */}
      <div className="card glass-panel" style={{overflowX: 'auto'}}>
        <h3 style={{marginBottom:'1rem'}}>📅 Engagements de la semaine</h3>
        {commitments.length === 0 && (
          <p style={{color:'var(--text-secondary)', marginBottom:'1rem', fontStyle:'italic'}}>
            Aucun engagement fixe configuré. Allez dans « Configuration » pour ajouter vos horaires de cours.
          </p>
        )}
        <div className="calendar-grid" style={{
          display: 'grid', 
          gridTemplateColumns: '60px repeat(7, minmax(100px, 1fr))',
          gap: '1px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid var(--bg-tertiary)',
          borderRadius: '8px'
        }}>
          {/* Header row */}
          <div style={{background: 'var(--bg-secondary)', padding: '0.8rem'}} />
          {DAYS.map(day => (
            <div key={day} style={{
              background: day === today ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
              padding: '0.8rem',
              textAlign: 'center',
              fontWeight: day === today ? 'bold' : 'normal',
              color: day === today ? 'var(--accent-primary)' : 'var(--text-primary)'
            }}>
              {day}
            </div>
          ))}

          {/* Time slots */}
          {HOURS.map(hour => (
            <React.Fragment key={`h-${hour}`}>
              <div style={{background: 'var(--bg-secondary)', padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                {hour}:00
              </div>
              {DAYS.map(day => {
                const acts = commitments.filter(c => {
                  const dayMatch = c.dayOfWeek === day || c.dayOfWeek === 'Tous les jours';
                  if (!dayMatch) return false;
                  const s = timeToGrid(c.startTime);
                  return Math.floor(s) === hour;
                });
                
                return (
                  <div key={`${day}-${hour}`} style={{
                    background: day === today ? 'rgba(59, 130, 246, 0.03)' : 'var(--bg-primary)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    position: 'relative',
                    height: '50px'
                  }}>
                    {acts.map((act, i) => {
                      const s = timeToGrid(act.startTime);
                      const e = timeToGrid(act.endTime);
                      const top = (s - hour) * 50;
                      const height = (e - s) * 50;
                      return (
                        <div key={i} style={{
                          position: 'absolute', top: `${top}px`, height: `${height}px`, left: '1px', right: '1px',
                          background: 'rgba(52, 211, 153, 0.2)', borderLeft: '2px solid #34D399', borderRadius: '3px',
                          padding: '0.1rem 0.3rem', fontSize: '0.65rem', color: '#34D399', zIndex: 10,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                        }}>
                          <strong>{act.title}</strong>
                        </div>
                      )
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalendrierPage;
