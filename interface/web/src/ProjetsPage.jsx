import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useStore, { useChronoStore } from './store';

import { getApiUrl } from './utils/apiConfig';
import useInputModal from './hooks/useInputModal';
import InputModal from './components/InputModal';

function ProjetsPage() {
  const { projets, setProjets, pendingTasksCount, historique } = useStore();
  const { globalChrono, startGlobalChrono, toggleGlobalChrono, resetGlobalChrono } = useChronoStore();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDateFin, setNewProjectDateFin] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [activeProjectForPhase, setActiveProjectForPhase] = useState(null);

  // Verrouillage de la page
  if (pendingTasksCount > 0) {
    return (
      <div className="page-transition glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</h1>
        <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Espace Verrouillé</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Mes études avant tout ! Termine toutes tes tâches universitaires du jour ({pendingTasksCount} restante{pendingTasksCount > 1 ? 's' : ''}) pour débloquer l'accès à tes projets personnels.
        </p>
      </div>
    );
  }

  // --- Actions ---
  const handleAddProject = () => {
    if (!newProjectTitle.trim()) return;
    const newProject = {
      id: Date.now().toString(),
      titre: newProjectTitle.trim(),
      dateFin: newProjectDateFin || null,
      phases: []
    };
    setProjets([...projets, newProject]);
    setNewProjectTitle('');
    setNewProjectDateFin('');
  };

  const handleLogTime = async (projetId) => {
    let finalMinutes = 0;
    if (globalChrono.exoId === projetId && globalChrono.elapsedSeconds > 0) {
      finalMinutes = Math.max(1, Math.ceil(globalChrono.elapsedSeconds / 60));
    }

    const defaultInput = finalMinutes > 0 ? finalMinutes.toString() : "";
    const minStr = await prompt("Combien de minutes as-tu travaillé sur ce projet ?", defaultInput);
    if (!minStr) return;

    const min = parseInt(minStr, 10);
    if (isNaN(min) || min <= 0) return;

    if (globalChrono.exoId === projetId) {
      resetGlobalChrono();
    }

    const newHistoryEntry = {
      date: new Date().toISOString(),
      type: "PROJET",
      duree: min,
      projetId: projetId
    };

    const updatedHistory = [...historique, newHistoryEntry];
    try {
      await fetch(`${getApiUrl()}/historique`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedHistory)
      });
      // Mettre à jour le store
      useStore.setState({ historique: updatedHistory });
    } catch (e) {
      console.error("Failed to save history", e);
    }
  };

  const handleDeleteProject = (id) => {
    if (window.confirm("Supprimer ce projet ?")) {
      setProjets(projets.filter(p => p.id !== id));
      if (globalChrono.exoId === id) resetGlobalChrono();
    }
  };

  const handleUpdateDateFin = (id, newDate) => {
    setProjets(projets.map(p => p.id === id ? { ...p, dateFin: newDate } : p));
  };

  const handleDeletePhase = (projectId, phaseId) => {
    if (window.confirm("Supprimer cette phase ?")) {
      setProjets(projets.map(p => {
        if (p.id === projectId) {
          return { ...p, phases: p.phases.filter(ph => ph.id !== phaseId) };
        }
        return p;
      }));
    }
  };

  const handleAddPhase = (projectId) => {
    if (!newPhaseName.trim()) return;
    const updated = projets.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          phases: [...(p.phases || []), { id: Date.now().toString(), nom: newPhaseName.trim(), complete: false }]
        };
      }
      return p;
    });
    setProjets(updated);
    setNewPhaseName('');
    setActiveProjectForPhase(null);
  };

  const handleTogglePhase = (projectId, phaseId) => {
    const updated = projets.map(p => {
      if (p.id === projectId) {
        // Find if this phase can be completed (previous must be complete if sequential)
        let canToggle = true;
        const newPhases = p.phases.map((ph, idx) => {
          if (ph.id === phaseId) {
            if (!ph.complete && idx > 0 && !p.phases[idx-1].complete) {
              canToggle = false;
            }
            if (canToggle) {
              return { ...ph, complete: !ph.complete };
            }
          }
          return ph;
        });
        if (!canToggle) {
          alert("Vous devez d'abord terminer la phase précédente.");
          return p;
        }
        return { ...p, phases: newPhases };
      }
      return p;
    });
    setProjets(updated);
  };

  // --- Stats des projets ---
  const projectTimeTotal = useMemo(() => {
    return historique
      .filter(h => h.type === 'PROJET')
      .reduce((sum, h) => sum + (h.duree || 0), 0);
  }, [historique]);

  return (
    <motion.div
      className="page-transition"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">💡 Projets Personnels</h1>
          <p className="page-subtitle">Développe tes propres idées maintenant que les cours sont gérés.</p>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1.2rem', minWidth: '150px', background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{Math.round(projectTimeTotal)} min</div>
          <div className="stat-label">Temps Total Investi</div>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Nouveau Projet</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Nom du projet..."
            value={newProjectTitle}
            onChange={e => setNewProjectTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProject()}
            style={{ flex: 2 }}
          />
          <input
            type="date"
            className="search-input"
            value={newProjectDateFin}
            onChange={e => setNewProjectDateFin(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary-button" onClick={handleAddProject}>+ Créer</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {projets && projets.map(projet => {
          const phases = projet.phases || [];
          const completedCount = phases.filter(p => p.complete).length;
          const progress = phases.length > 0 ? Math.round((completedCount / phases.length) * 100) : 0;

          return (
            <motion.div key={projet.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }} layout>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', maxWidth: '75%', wordBreak: 'break-word', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {projet.titre}
                  <input
                    type="date"
                    value={projet.dateFin || ''}
                    onChange={(e) => handleUpdateDateFin(projet.id, e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--warning-color)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
                    title="Date de fin"
                  />
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      if (globalChrono.exoId === projet.id) {
                        toggleGlobalChrono();
                      } else {
                        startGlobalChrono({ id: projet.id, titre: projet.titre, matiereNom: "Projet" });
                      }
                    }}
                    style={{
                      background: (globalChrono.exoId === projet.id && globalChrono.isRunning) ? '#ef4444' : '#10B981',
                      color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      transition: 'background 0.2s', fontSize: '0.9rem'
                    }}
                    title={(globalChrono.exoId === projet.id && globalChrono.isRunning) ? "Mettre en pause" : "Démarrer chrono"}
                  >
                    {(globalChrono.exoId === projet.id && globalChrono.isRunning) ? '⏸' : '▶'}
                  </button>
                  <button
                    className="primary-button"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={() => handleLogTime(projet.id)}
                    title="Ajouter du temps de travail"
                  >
                    + Temps
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--success-color)' : 'var(--accent-primary)', transition: 'width 0.3s' }}></div>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{progress}%</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {phases.map((phase, idx) => (
                  <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.5rem', background: phase.complete ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', opacity: (idx > 0 && !phases[idx-1].complete && !phase.complete) ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={phase.complete}
                      onChange={() => handleTogglePhase(projet.id, phase.id)}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                    <span style={{ textDecoration: phase.complete ? 'line-through' : 'none', color: phase.complete ? 'var(--text-secondary)' : 'var(--text-primary)', flex: 1 }}>
                      {idx + 1}. {phase.nom}
                    </span>
                    <button
                      onClick={() => handleDeletePhase(projet.id, phase.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '0 0.5rem', opacity: 0.6 }}
                      title="Supprimer la phase"
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {activeProjectForPhase === projet.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Nom de la phase..."
                    value={newPhaseName}
                    onChange={e => setNewPhaseName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPhase(projet.id)}
                    autoFocus
                  />
                  <button className="primary-button" onClick={() => handleAddPhase(projet.id)}>✓</button>
                  <button className="secondary-button" onClick={() => setActiveProjectForPhase(null)}>✕</button>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  style={{ width: '100%', marginBottom: '1rem', borderStyle: 'dashed' }}
                  onClick={() => {
                    setActiveProjectForPhase(projet.id);
                    setNewPhaseName('');
                  }}
                >
                  + Ajouter une phase
                </button>
              )}

              <button
                className="secondary-button"
                style={{ width: '100%', color: 'var(--danger-color)', borderColor: 'var(--danger-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
                onClick={() => handleDeleteProject(projet.id)}
                title="Supprimer ce projet"
              >
                🗑️ Supprimer le projet
              </button>
            </motion.div>
          );
        })}
      </div>
      {(!projets || projets.length === 0) && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '3rem' }}>
          Aucun projet pour le moment. C'est le moment d'être créatif !
        </div>
      )}
      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </motion.div>
  );
}

export default ProjetsPage;
