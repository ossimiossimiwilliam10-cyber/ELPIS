import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { parseTimeInput } from '../utils/timeParser';

const CM_SCORE_LABELS = [
  { value: 1, label: 'Échec', short: '1', color: '#ef4444', desc: 'Oubli total (Again)' },
  { value: 2, label: 'Difficile', short: '2', color: '#f59e0b', desc: 'Avec effort (Hard)' },
  { value: 3, label: 'Bon', short: '3', color: '#3b82f6', desc: 'Correct (Good)' },
  { value: 4, label: 'Facile', short: '4', color: '#10b981', desc: 'Sans effort (Easy)' },
];

const DIFFICULTY_LABELS = [
  { value: 'Difficile', label: 'Difficile', color: '#ef4444' },
  { value: 'Moyen', label: 'Moyen', color: '#f59e0b' },
  { value: 'Facile', label: 'Facile', color: '#10b981' },
];

/**
 * Modale affichée lors de la complétion d'une tâche depuis le Dashboard.
 * Demande le temps réel passé, et des informations spécifiques selon le type de tâche.
 */
export default function TaskCompletionModal({ isOpen, onClose, onSubmit, taskTitle, defaultMinutes, taskType }) {
  const [minutes, setMinutes] = useState(defaultMinutes || 30);
  const [score, setScore] = useState(null); // Used for CM (FSRS score 1-4)
  const [difficulte, setDifficulte] = useState(null); // Used for TD/TP/ANNALE
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMinutes(defaultMinutes || 30);
      setScore(null);
      setDifficulte(null);
    }
  }, [isOpen, defaultMinutes]);

  const handleSubmit = useCallback(() => {
    if (taskType === 'CM' && score === null) return; // Validation require for CM
    
    onSubmit({
      minutes: parseTimeInput(minutes) || 1,
      sm2Score: score, // Only for CM
      difficulte: difficulte,
    });
    onClose();
  }, [taskType, score, minutes, difficulte, onSubmit, onClose]);

  // Handle Enter to submit, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      // Only submit on Enter if requirements are met
      if (e.key === 'Enter') {
        if (taskType === 'CM' && score === null) return;
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, taskType, score, handleSubmit]);

  const isCM = taskType === 'CM';
  const isPractice = taskType === 'TD' || taskType === 'TP' || taskType === 'ANNALE';
  
  const isSubmitDisabled = isCM && score === null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            ref={overlayRef}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '450px',
              position: 'relative',
              zIndex: 1001,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              Valider l'activité
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {taskTitle}
            </p>

            {/* Temps passé */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                ⏱️ Temps réel passé (minutes)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={minutes}
                  placeholder="ex: 45"
                  onChange={(e) => {
                    const val = e.target.value;
                    setMinutes(val);
                  }}
                  onBlur={(e) => {
                    const parsed = parseTimeInput(e.target.value);
                    if (parsed !== null && parsed > 0) {
                      setMinutes(parsed);
                    } else {
                      setMinutes(1);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.7rem',
                    paddingRight: '3rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--bg-tertiary)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '1.1rem',
                    textAlign: 'center',
                  }}
                />
                <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>min</span>
              </div>
            </div>

            {/* Score de rétention (Uniquement pour CM) */}
            {isCM && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.7rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  🧠 Niveau de rétention
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                  {CM_SCORE_LABELS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setScore(s.value)}
                      title={s.desc}
                      style={{
                        flex: 1,
                        padding: '0.7rem 0.3rem',
                        background: score === s.value ? `${s.color}33` : 'var(--bg-tertiary)',
                        border: score === s.value ? `2px solid ${s.color}` : '2px solid transparent',
                        borderRadius: '10px',
                        color: score === s.value ? s.color : 'var(--text-secondary)',
                        fontWeight: score === s.value ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{s.short}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulté (Optionnelle, pour TD, TP, ANNALES) */}
            {isPractice && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.7rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  📈 Difficulté ressentie (Optionnel)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                  {DIFFICULTY_LABELS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setDifficulte(s.value === difficulte ? null : s.value)} // Toggle
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.3rem',
                        background: difficulte === s.value ? `${s.color}33` : 'var(--bg-tertiary)',
                        border: difficulte === s.value ? `2px solid ${s.color}` : '2px solid transparent',
                        borderRadius: '10px',
                        color: difficulte === s.value ? s.color : 'var(--text-secondary)',
                        fontWeight: difficulte === s.value ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem' }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'transparent',
                  border: '1px solid var(--bg-tertiary)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: isSubmitDisabled ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  color: isSubmitDisabled ? 'var(--text-tertiary)' : '#fff',
                  cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.15s',
                }}
              >
                Valider
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
