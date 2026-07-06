import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { parseTimeInput } from '../utils/timeParser';

const SCORE_LABELS = [
  { value: 1, label: 'Échec', short: '1', color: '#ef4444', desc: 'Oubli total (Again)' },
  { value: 2, label: 'Difficile', short: '2', color: '#f59e0b', desc: 'Avec effort (Hard)' },
  { value: 3, label: 'Bon', short: '3', color: '#3b82f6', desc: 'Correct (Good)' },
  { value: 4, label: 'Facile', short: '4', color: '#10b981', desc: 'Sans effort (Easy)' },
];

/**
 * Mini-modale affichée lors de la complétion d'un CM depuis le Dashboard.
 * Demande le temps réel passé et le score FSRS (1-4 : Again, Hard, Good, Easy).
 */
export default function CMCompletionModal({ isOpen, onClose, onSubmit, taskTitle, defaultMinutes }) {
  const [minutes, setMinutes] = useState(defaultMinutes || 30);
  const [score, setScore] = useState(null);
  const overlayRef = useRef(null);

  const [prevIsOpen, setPrevIsOpen] = useState(false);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMinutes(defaultMinutes || 30);
      setScore(null);
    }
  }

  // Handle Enter to submit, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      // If pressing Enter and a score is selected, submit
      if (e.key === 'Enter' && score !== null) {
        onSubmit({ minutes: parseTimeInput(minutes) || 1, sm2Score: score });
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSubmit, minutes, score]);

  const handleSubmit = () => {
    if (score !== null) {
      onSubmit({ minutes: parseTimeInput(minutes) || 1, sm2Score: score });
      onClose();
    }
  };

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
              Valider le CM
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {taskTitle}
            </p>

            {/* Temps passé */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                ⏱️ Temps réel passé (minutes)
              </label>
              <input
                type="text"
                value={minutes}
                onChange={(e) => {
                  const val = e.target.value;
                  setMinutes(val); // Keep string in state while typing
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
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--bg-tertiary)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                }}
              />
            </div>

            {/* Score de rétention */}
            <div style={{ marginBottom: '1.8rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.7rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                🧠 Niveau de rétention
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                {SCORE_LABELS.map((s) => (
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
                disabled={score === null}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: score === null ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  color: score === null ? 'var(--text-tertiary)' : '#fff',
                  cursor: score === null ? 'not-allowed' : 'pointer',
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
