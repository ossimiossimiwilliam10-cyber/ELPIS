import React, { useState } from 'react';
import useStore from './store';
import { useToast } from './ToastProvider';
import { motion } from 'framer-motion';

export default function StagesPage() {
  const { config, setConfig } = useStore();
  const { addToast } = useToast();
  
  const stages = config.stages || [];

  const [newStage, setNewStage] = useState({
    titre: '',
    entreprise: '',
    type: 'Apprentissage',
    objectifHeures: 616
  });

  const addStage = (e) => {
    e.preventDefault();
    if (!newStage.titre || !newStage.entreprise) {
      addToast('Veuillez remplir tous les champs', 'warning');
      return;
    }
    
    const stage = {
      id: Date.now().toString(),
      ...newStage,
      heuresRealisees: 0,
      interrompu: false,
      memoireRendu: false,
      dateCreation: new Date().toISOString()
    };
    
    setConfig({ ...config, stages: [...stages, stage] });
    setNewStage({ titre: '', entreprise: '', type: 'Apprentissage', objectifHeures: 616 });
    addToast('Contrat ajouté avec succès', 'success');
  };

  const deleteStage = (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce contrat ?')) {
      setConfig({ ...config, stages: stages.filter(s => s.id !== id) });
    }
  };

  const addHours = (id, hours) => {
    setConfig({
      ...config,
      stages: stages.map(s => {
        if (s.id === id) {
          return { ...s, heuresRealisees: s.heuresRealisees + hours };
        }
        return s;
      })
    });
    addToast(`+${hours}h ajoutées !`, 'success');
  };

  const toggleInterruption = (id) => {
    if (window.confirm('Déclarer une interruption va générer une tâche obligatoire de Mémoire de Substitution dans le planning du jour. Continuer ?')) {
      setConfig({
        ...config,
        stages: stages.map(s => {
          if (s.id === id) {
            return { ...s, interrompu: !s.interrompu };
          }
          return s;
        })
      });
      addToast('Interruption déclarée ! Regarde ton Dashboard.', 'info');
    }
  };

  const toggleMemoire = (id) => {
    setConfig({
      ...config,
      stages: stages.map(s => {
        if (s.id === id) {
          return { ...s, memoireRendu: !s.memoireRendu };
        }
        return s;
      })
    });
    addToast('Statut du mémoire mis à jour !', 'success');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <div style={{ fontSize: '2.5rem', background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '16px' }}>💼</div>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem' }}>Mise en situation professionnelle</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>
            Suivi des stages et contrats d'apprentissage (616 à 924h).
          </p>
        </div>
      </div>

      <div className="card glass-panel" style={{ marginBottom: '2rem', borderTop: '4px solid #f59e0b' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, color: 'var(--text-primary)' }}>
          <span>➕</span> Nouveau Contrat
        </h2>
        <form onSubmit={addStage} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Titre du poste / stage</label>
            <input 
              type="text" 
              value={newStage.titre}
              onChange={e => setNewStage({...newStage, titre: e.target.value})}
              placeholder="Ex: Ingénieur Logiciel"
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Entreprise</label>
            <input 
              type="text" 
              value={newStage.entreprise}
              onChange={e => setNewStage({...newStage, entreprise: e.target.value})}
              placeholder="Ex: Google"
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Type</label>
            <select
              value={newStage.type}
              onChange={e => setNewStage({...newStage, type: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="Apprentissage">Apprentissage</option>
              <option value="Stage">Stage</option>
            </select>
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Obj. Heures</label>
            <input 
              type="number" 
              value={newStage.objectifHeures}
              onChange={e => setNewStage({...newStage, objectifHeures: parseInt(e.target.value) || 616})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <button 
            type="submit"
            style={{ padding: '0.8rem 1.5rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Ajouter
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {stages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            Aucun stage ou contrat d'apprentissage déclaré.
          </div>
        ) : stages.map(stage => (
          <motion.div 
            key={stage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card glass-panel"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Delete Button */}
            <button 
              onClick={() => deleteStage(stage.id)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--danger-color, #ef4444)', cursor: 'pointer', fontSize: '1.2rem' }}
              title="Supprimer"
            >
              ×
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>
                  {stage.titre}
                </h3>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span>🏢 {stage.entreprise}</span>
                  <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderRadius: '20px', fontSize: '0.8rem' }}>
                    {stage.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Progression</span>
                <strong style={{ color: 'var(--text-primary)' }}>{stage.heuresRealisees}h / {stage.objectifHeures}h</strong>
              </div>
              <div style={{ height: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #f59e0b, #d97706)', 
                  width: `${Math.min(100, (stage.heuresRealisees / stage.objectifHeures) * 100)}%`,
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => addHours(stage.id, 1)}
                  style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  +1h
                </button>
                <button 
                  onClick={() => addHours(stage.id, 7)}
                  style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  +7h (Journée)
                </button>
              </div>

              <div style={{ flex: 1 }}></div>

              {stage.interrompu ? (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ Interrompu</span>
                  <button 
                    onClick={() => toggleMemoire(stage.id)}
                    style={{ background: stage.memoireRendu ? 'var(--success-color)' : 'transparent', color: stage.memoireRendu ? '#fff' : '#ef4444', border: stage.memoireRendu ? 'none' : '1px solid #ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    {stage.memoireRendu ? '✅ Mémoire Rendu' : 'Rendre Mémoire (Substitution)'}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => toggleInterruption(stage.id)}
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ⚠️ Déclarer une interruption
                </button>
              )}
            </div>

          </motion.div>
        ))}
      </div>
    </div>
  );
}
