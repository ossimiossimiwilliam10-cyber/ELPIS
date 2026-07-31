import React, { useState, useEffect } from 'react';
import useStore from './store';

export default function PlanningPage() {
  const [weeks, setWeeks] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSimulation();
  }, []);

  const fetchSimulation = async () => {
    try {
      setLoading(true);
      const url = `http://localhost:3001/api/orchestrateur/simulation`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erreur lors du chargement de la simulation');
      const data = await res.json();
      setWeeks(data.weeks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Génération du calendrier...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'var(--accent-red)' }}>Erreur: {error}</div>;
  if (!weeks || weeks.length === 0) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Aucune donnée de simulation.</div>;

  const currentWeek = weeks[currentWeekIndex];

  // Plage horaire affichée: 07h à 23h (16 heures)
  const START_HOUR = 7;
  const END_HOUR = 23;
  const HOUR_HEIGHT = 60; // px par heure (1px par minute)

  const formatMinToTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getTaskColor = (type) => {
    switch (type) {
      case 'CM': return 'var(--accent-blue)';
      case 'TD': return 'var(--accent-orange)';
      case 'TP': return 'var(--accent-teal)';
      case 'ANNALE': return 'var(--accent-red)';
      case 'REVISION': return 'var(--accent-yellow)';
      default: return 'var(--bg-secondary)';
    }
  };

  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      {/* Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Calendrier (ADE) 🗓️</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Emploi du temps déterministe (Forward-Scheduling)</p>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <button 
            className="btn-secondary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
            onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
            disabled={currentWeekIndex === 0}
          >
            ◀ Préc
          </button>
          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', width: '100px', textAlign: 'center' }}>
            Semaine {currentWeek.weekIndex + 1}
          </div>
          <button 
            className="btn-secondary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
            onClick={() => setCurrentWeekIndex(Math.min(weeks.length - 1, currentWeekIndex + 1))}
            disabled={currentWeekIndex === weeks.length - 1}
          >
            Suiv ▶
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px' }}>
        
        {/* Header des Jours */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid var(--border-color)' }}></div>
          {currentWeek.days.map((day, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0.75rem 0', borderRight: i < 6 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{jours[i]}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(day.date).toLocaleDateString('fr-FR')}</div>
            </div>
          ))}
        </div>

        {/* Body du Calendrier avec défilement vertical */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', position: 'relative', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`, position: 'relative' }}>
            
            {/* Colonne des heures (Axe Y) */}
            <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)', position: 'relative' }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', width: '100%', textAlign: 'right', paddingRight: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', top: `${i * HOUR_HEIGHT - 8}px` }}>
                  {START_HOUR + i}:00
                </div>
              ))}
            </div>

            {/* Grille des Jours (Axe X) */}
            {currentWeek.days.map((day, dIndex) => (
              <div key={dIndex} style={{ flex: 1, borderRight: dIndex < 6 ? '1px solid var(--border-color)' : 'none', position: 'relative' }}>
                {/* Lignes horizontales de la grille */}
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', width: '100%', borderBottom: '1px solid var(--border-color)', opacity: 0.2, top: `${(i + 1) * HOUR_HEIGHT}px` }}></div>
                ))}

                {/* Tâches (Créneaux) */}
                {day.slots.map((slot, sIndex) => {
                  const top = (slot.startMin - (START_HOUR * 60)) * (HOUR_HEIGHT / 60);
                  const height = slot.duree * (HOUR_HEIGHT / 60);
                  const color = getTaskColor(slot.type);

                  if (top < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null;

                  return (
                    <div 
                      key={sIndex} 
                      className="calendar-slot"
                      style={{
                        position: 'absolute',
                        left: '4px',
                        right: '4px',
                        borderRadius: '4px',
                        padding: '4px',
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        top: `${top}px`,
                        height: `${Math.max(20, height)}px`,
                        backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                        borderLeft: `3px solid ${color}`,
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRight: '1px solid rgba(255,255,255,0.1)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out'
                      }}
                      title={`${formatMinToTime(slot.startMin)} - ${formatMinToTime(slot.startMin + slot.duree)} | ${slot.titre}`}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.zIndex = 10; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ fontWeight: 'bold', color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.matiere}</div>
                      <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.type} - {slot.titre}</div>
                      {height > 35 && (
                        <div style={{ marginTop: '2px', opacity: 0.7, fontSize: '0.7rem' }}>{formatMinToTime(slot.startMin)} - {formatMinToTime(slot.startMin + slot.duree)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
