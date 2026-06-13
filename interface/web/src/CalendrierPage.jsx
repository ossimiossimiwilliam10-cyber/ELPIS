import React, { useMemo } from 'react';
import useStore from './store';

const HOURS = Array.from({length: 16}, (_, i) => i + 8); // 8h to 23h
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function CalendrierPage() {
  const { config } = useStore();
  
  const commitments = useMemo(() => {
    if (!config?.fixedCommitments) return [];
    return config.fixedCommitments;
  }, [config]);

  const timeToGrid = (timeStr) => {
    if (!timeStr) return 8;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m/60;
  };

  return (
    <div className="calendrier-page">
      <div className="cours-header" style={{marginBottom:'2rem'}}>
        <h2>Calendrier Hebdomadaire</h2>
        <p style={{color:'var(--text-secondary)'}}>Vue visuelle de vos engagements fixes.</p>
      </div>

      <div className="card glass-panel" style={{overflowX: 'auto'}}>
        <div className="calendar-grid" style={{
          display: 'grid', 
          gridTemplateColumns: '60px repeat(7, minmax(120px, 1fr))',
          gap: '1px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid var(--bg-tertiary)',
          borderRadius: '8px'
        }}>
          {/* Header row */}
          <div style={{background: 'var(--bg-secondary)', padding: '1rem'}} />
          {DAYS.map(day => (
            <div key={day} style={{background: 'var(--bg-secondary)', padding: '1rem', textAlign: 'center', fontWeight: 'bold'}}>
              {day}
            </div>
          ))}

          {/* Time slots */}
          {HOURS.map(hour => (
            <React.Fragment key={`h-${hour}`}>
              <div style={{background: 'var(--bg-secondary)', padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)'}}>
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
                  <div key={`${day}-${hour}`} style={{background: 'var(--bg-primary)', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', height: '60px'}}>
                    {acts.map((act, i) => {
                      const s = timeToGrid(act.startTime);
                      const e = timeToGrid(act.endTime);
                      const top = (s - hour) * 60;
                      const height = (e - s) * 60;
                      return (
                        <div key={i} style={{
                          position: 'absolute', top: `${top}px`, height: `${height}px`, left: '2px', right: '2px',
                          background: 'rgba(52, 211, 153, 0.2)', borderLeft: '3px solid #34D399', borderRadius: '4px',
                          padding: '0.2rem', fontSize: '0.75rem', color: '#34D399', zIndex: 10, overflow: 'hidden'
                        }}>
                          <strong>{act.title}</strong>
                          <br />{act.startTime} - {act.endTime}
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
