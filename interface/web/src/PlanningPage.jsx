import React, { useState, useEffect } from 'react';
import useStore from './store';

export default function PlanningPage() {
  const [weeks, setWeeks] = useState([]);
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

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 'Repos': return 'var(--accent-teal)';
      case 'Légère': return 'var(--accent-blue)';
      case 'Modérée': return 'var(--accent-yellow)';
      case 'Intense': return 'var(--accent-orange)';
      case 'Critique': return 'var(--accent-red)';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--text-secondary)]">Génération de la simulation sur 52 semaines...</div>;
  if (error) return <div className="p-8 text-[var(--accent-red)]">Erreur: {error}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="glass-panel p-6 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Planning Annuel 🔭</h1>
        <p className="text-[var(--text-secondary)]">
          Projection macroscopique sur 52 semaines de l'algorithme d'orchestration.
          Ce simulateur anticipe tes charges de travail et les matières dominantes en fonction de tes examens.
        </p>
      </div>

      <div className="space-y-4">
        {weeks.map((week, idx) => (
          <div key={idx} className="glass-panel p-5 flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-[var(--accent-blue)]">
            {/* Timeline Marker */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: getIntensityColor(week.workloadIntensity) }}></div>
            
            {/* Dates & Week Number */}
            <div className="w-48 shrink-0">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Semaine {idx + 1}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {new Date(week.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} 
                {' '} - {' '} 
                {new Date(week.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Workload Intensity */}
            <div className="w-32 shrink-0">
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
                style={{ 
                  backgroundColor: `color-mix(in srgb, ${getIntensityColor(week.workloadIntensity)} 15%, transparent)`,
                  color: getIntensityColor(week.workloadIntensity)
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getIntensityColor(week.workloadIntensity) }}></div>
                {week.workloadIntensity}
              </div>
            </div>

            {/* Dominant Subjects */}
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Matières Dominantes</h4>
              {week.dominantSubjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {week.dominantSubjects.map((sub, i) => (
                    <span key={i} className="px-2.5 py-1 bg-[var(--bg-secondary)] rounded text-sm text-[var(--text-primary)] border border-[var(--border-color)]">
                      {sub}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">Aucune pression particulière</p>
              )}
            </div>

            {/* Exams / Events */}
            <div className="w-64 shrink-0">
              <h4 className="text-xs font-semibold text-[var(--accent-red)] uppercase tracking-wider mb-2">Examens / Événements</h4>
              {week.exams.length > 0 ? (
                <div className="space-y-1.5">
                  {week.exams.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-[var(--bg-error)] text-[var(--text-primary)] p-2 rounded border border-[var(--accent-red)]/30">
                      <span className="text-[var(--accent-red)]">⚠️</span>
                      <div>
                        <span className="font-semibold block">{ex.matiere}</span>
                        <span className="text-xs opacity-80">{ex.titre} ({new Date(ex.date).toLocaleDateString('fr-FR')})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">Aucun examen cette semaine</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
