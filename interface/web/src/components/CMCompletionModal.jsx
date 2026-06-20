import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

  useEffect(() => {
    if (isOpen) {
      setMinutes(defaultMinutes || 30);
      setScore(null);
    }
  }, [isOpen, defaultMinutes]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (score === null) return;
    // Map score 1-4 directement pour FSRS
    onSubmit({ minutes: Math.max(1, Math.round(minutes)), sm2Score: score });
    onClose();
  };

  // Échap pour fermer
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <motion.div
            className="modal-content glass-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.3rem' }}>
              ✅ CM terminé
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--accent-primary)' }}>{taskTitle}</strong> — pour que l'algorithme SM-2 reste précis, indique ton temps réel et ton niveau de rétention.
            </p>

            {/* Temps passé */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                ⏱️ Temps réel passé (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 1)}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
