import { useState } from 'react';
import { motion } from 'framer-motion';
import useStore from './store';
import { useToast } from './ToastProvider';
import { getApiUrl } from './utils/apiConfig';

export default function RevisionsAvanceesPage() {
  const { coursConfig, pendingTasksCount, setForcedTask, setActiveTab } = useStore();
  const { toast } = useToast();

  const [customMatiere, setCustomMatiere] = useState('all');
  const [customType, setCustomType] = useState('all');
  const [customDuration, setCustomDuration] = useState(30);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  // Extraire les matières depuis coursConfig pour les afficher dans le dropdown
  const allMatieres = [];
  if (coursConfig?.licences) {
    coursConfig.licences.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom) allMatieres.push(m.nom);
          });
        });
      });
    });
  }

  const handleCustomTargetRequest = async () => {
    setIsGeneratingCustom(true);
    try {
      const res = await fetch(`${getApiUrl()}/orchestrateur/force-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matiere: customMatiere === 'ANKI' ? 'Routine' : customMatiere,
          type: customMatiere === 'ANKI' ? 'ANKI' : customType,
          dureeMin: customDuration
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur de génération");
      } else if (data.task) {
        setForcedTask(data.task);
        setActiveTab('entrainement');
        toast.success("Cible acquise ! L'entraînement est configuré.");
      }
    } catch (err) {
      toast.error("Impossible de joindre l'orchestrateur.");
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  if (pendingTasksCount > 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem', paddingTop: '4rem', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card glass-panel"
          style={{ padding: '3rem', border: '1px solid var(--accent-primary)' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Section Verrouillée</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Tu as encore <strong>{pendingTasksCount} tâche{pendingTasksCount > 1 ? 's' : ''}</strong> à terminer dans ta Session du Jour.
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            L'algorithme requiert que tu atteignes ta cible quotidienne avant de pouvoir t'avancer sur d'autres matières.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>🚀 Avance & Bonus</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card glass-panel"
        style={{ marginBottom: '2rem', padding: '2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}
      >
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>🎯 Ciblage manuel</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Sélectionne la matière, le type et la durée. L'IA ciblera l'exercice le plus pertinent et t'emmènera dans l'arène d'entraînement !
        </p>

        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>Matière</label>
          <select
            value={customMatiere}
            onChange={e => setCustomMatiere(e.target.value)}
            style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', fontSize: '1rem', cursor: 'pointer' }}
          >
            <option value="all">Toutes les matières</option>
            <option value="ANKI">Routine Anki (Flashcards)</option>
            {allMatieres.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>Type d'exercice</label>
          <select
            value={customType}
            onChange={e => setCustomType(e.target.value)}
            style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', fontSize: '1rem', cursor: 'pointer' }}
          >
            <option value="all">Peu importe</option>
            <option value="ANKI">Anki (Flashcards)</option>
            <option value="CM">Cours (CM)</option>
            <option value="TD">Exercices (TD)</option>
            <option value="TP">Projet (TP)</option>
            <option value="ANNALE">Annales</option>
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>Durée souhaitée (minutes)</label>
          <input
            type="number"
            min="5"
            step="5"
            value={customDuration}
            onChange={e => setCustomDuration(parseInt(e.target.value) || 30)}
            style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', fontSize: '1rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <motion.button
            whileHover={!isGeneratingCustom ? { scale: 1.02 } : {}}
            whileTap={!isGeneratingCustom ? { scale: 0.98 } : {}}
            onClick={handleCustomTargetRequest}
            disabled={isGeneratingCustom}
            className="btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', cursor: isGeneratingCustom ? 'wait' : 'pointer' }}
          >
            {isGeneratingCustom ? 'Recherche en cours...' : 'Rechercher ma cible et commencer'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
