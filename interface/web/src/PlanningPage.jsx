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

  if (loading) return <div className="p-8 text-center text-[var(--text-secondary)]">Génération du calendrier...</div>;
  if (error) return <div className="p-8 text-[var(--accent-red)]">Erreur: {error}</div>;
  if (!weeks || weeks.length === 0) return <div className="p-8 text-[var(--text-secondary)]">Aucune donnée de simulation.</div>;

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2rem)] animate-fade-in">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Calendrier (ADE) 🗓️</h1>
          <p className="text-[var(--text-secondary)]">Emploi du temps déterministe (Forward-Scheduling)</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)]">
          <button 
            className="btn-secondary px-3 py-1 text-sm"
            onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
            disabled={currentWeekIndex === 0}
          >
            ◀ Préc
          </button>
          <div className="font-semibold text-[var(--text-primary)] w-32 text-center">
            Semaine {currentWeek.weekIndex + 1}
          </div>
          <button 
            className="btn-secondary px-3 py-1 text-sm"
            onClick={() => setCurrentWeekIndex(Math.min(weeks.length - 1, currentWeekIndex + 1))}
            disabled={currentWeekIndex === weeks.length - 1}
          >
            Suiv ▶
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 glass-panel overflow-hidden flex flex-col">
        
        {/* Header des Jours */}
        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
          <div className="w-16 shrink-0 border-r border-[var(--border-color)]"></div>
          {currentWeek.days.map((day, i) => (
            <div key={i} className="flex-1 text-center py-3 border-r border-[var(--border-color)] last:border-r-0">
              <div className="font-bold text-[var(--text-primary)]">{jours[i]}</div>
              <div className="text-xs text-[var(--text-secondary)]">{new Date(day.date).toLocaleDateString('fr-FR')}</div>
            </div>
          ))}
        </div>

        {/* Body du Calendrier avec défilement vertical */}
        <div className="flex-1 overflow-y-auto relative bg-[var(--bg-primary)]/20 custom-scrollbar">
          <div className="flex" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
            
            {/* Colonne des heures (Axe Y) */}
            <div className="w-16 shrink-0 border-r border-[var(--border-color)] relative bg-[var(--bg-primary)]/50">
              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                <div key={i} className="absolute w-full text-right pr-2 text-xs text-[var(--text-secondary)] -translate-y-2" style={{ top: `${i * HOUR_HEIGHT}px` }}>
                  {START_HOUR + i}:00
                </div>
              ))}
            </div>

            {/* Grille des Jours (Axe X) */}
            {currentWeek.days.map((day, dIndex) => (
              <div key={dIndex} className="flex-1 border-r border-[var(--border-color)] last:border-r-0 relative">
                {/* Lignes horizontales de la grille */}
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div key={i} className="absolute w-full border-b border-[var(--border-color)] opacity-20" style={{ top: `${(i + 1) * HOUR_HEIGHT}px` }}></div>
                ))}

                {/* Tâches (Créneaux) */}
                {day.slots.map((slot, sIndex) => {
                  const top = (slot.startMin - (START_HOUR * 60)) * (HOUR_HEIGHT / 60);
                  const height = slot.duree * (HOUR_HEIGHT / 60);
                  const color = getTaskColor(slot.type);

                  // Ne pas afficher si c'est hors de la grille (ex: tâche à 6h du matin ou après 23h)
                  if (top < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null;

                  return (
                    <div 
                      key={sIndex} 
                      className="absolute left-1 right-1 rounded p-1.5 text-xs overflow-hidden transition-transform hover:scale-[1.02] hover:z-10 shadow-sm border border-white/10"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(20, height)}px`, // Minimum 20px pour visibilité
                        backgroundColor: `color-mix(in srgb, ${color} 20%, var(--bg-primary))`,
                        borderLeft: `3px solid ${color}`
                      }}
                      title={`${formatMinToTime(slot.startMin)} - ${formatMinToTime(slot.startMin + slot.duree)} | ${slot.titre}`}
                    >
                      <div className="font-bold text-[var(--text-primary)] truncate" style={{ color }}>{slot.matiere}</div>
                      <div className="truncate text-[var(--text-secondary)]">{slot.type} - {slot.titre}</div>
                      {height > 30 && (
                        <div className="mt-1 opacity-75">{formatMinToTime(slot.startMin)} - {formatMinToTime(slot.startMin + slot.duree)}</div>
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
