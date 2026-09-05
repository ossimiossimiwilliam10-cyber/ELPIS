import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { parseTimeInput } from '../utils/timeParser';
import { RETENTION, DIFFICULTY_LEVELS } from '../constants';


/**
 * Modale affichée lors de la complétion d'une tâche depuis le Dashboard.
 * Demande le temps réel passé, et des informations spécifiques selon le type de tâche.
 */
export default function TaskCompletionModal({ isOpen, onClose, onSubmit, taskTitle, defaultMinutes, taskType }) {
  const [minutes, setMinutes] = useState(defaultMinutes || 30);
  const [score, setScore] = useState(null); // Used for CM (FSRS score 1-4)
  const [difficulte, setDifficulte] = useState(null); // Used for TD/TP/ANNALE
  const [note, setNote] = useState(''); // Used for ANNALE (note /20)
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMinutes(defaultMinutes || 30);
      setScore(null);
      setDifficulte(null);
      setNote('');
    }
  }, [isOpen, defaultMinutes]);

  const handleSubmit = useCallback(() => {
    if (taskType === 'CM' && score === null) return; // Validation require for CM

    const noteParsee = note === '' ? undefined : parseFloat(note);

    onSubmit({
      minutes: parseTimeInput(minutes) || 1,
      sm2Score: score, // Only for CM
      difficulte: difficulte,
      note: Number.isFinite(noteParsee) ? noteParsee : undefined, // Only for ANNALE
    });
    onClose();
  }, [taskType, score, minutes, difficulte, note, onSubmit, onClose]);

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
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }} role="group" aria-label="Niveau de rétention">
                  {RETENTION.map(({ note: valeur, libelle, couleur, aide }) => (
                    <button
                      key={valeur}
                      onClick={() => setScore(valeur)}
                      title={aide}
                      aria-pressed={score === valeur}
                      style={{
                        flex: 1,
                        padding: '0.7rem 0.3rem',
                        background: score === valeur ? 'var(--surface-2)' : 'var(--bg-tertiary)',
                        border: score === valeur ? `2px solid ${couleur}` : '2px solid transparent',
                        borderRadius: '10px',
                        color: score === valeur ? couleur : 'var(--text-secondary)',
                        fontWeight: score === valeur ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{valeur}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>{libelle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note obtenue (Annales) — alimente la règle d'urgence de l'orchestrateur */}
            {taskType === 'ANNALE' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="note-annale" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  📊 Note obtenue (optionnel)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="note-annale"
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={note}
                    placeholder="ex: 14"
                    onChange={(e) => setNote(e.target.value)}
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
                  <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>/20</span>
                </div>
              </div>
            )}

            {/* Difficulté (Optionnelle, pour TD, TP, ANNALES) */}
            {isPractice && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.7rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  📈 Difficulté ressentie (Optionnel)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }} role="group" aria-label="Difficulté ressentie">
                  {DIFFICULTY_LEVELS.map(({ key, label, title }) => (
                    <button
                      key={key}
                      onClick={() => setDifficulte(key === difficulte ? null : key)}
                      title={title}
                      aria-label={title}
                      aria-pressed={difficulte === key}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.2rem',
                        background: difficulte === key ? 'var(--surface-2)' : 'var(--bg-tertiary)',
                        border: difficulte === key ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: '10px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.15rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: '1rem' }}>{label}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>{title}</span>
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
                  // Le blanc sur --accent ne donnait que 3,68 de contraste ;
                  // --accent-fort le porte à 5,17, comme .el-bouton--primaire.
                  background: isSubmitDisabled ? 'var(--bg-tertiary)' : 'var(--accent-fort)',
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
