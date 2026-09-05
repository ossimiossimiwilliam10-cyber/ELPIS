import { useState, useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Modal de saisie légère — remplace window.prompt() dans toute l'application.
 * @param {boolean} isOpen
 * @param {function} onConfirm appelé avec la valeur saisie (trimée)
 * @param {function} onCancel  appelé sans argument
 * @param {string}  title     texte affiché au-dessus du champ
 * @param {string}  defaultValue valeur pré-remplie
 * @param {string}  placeholder
 */
export default function InputModal({ isOpen, onConfirm, onCancel, title, defaultValue = '', placeholder }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  const titreId = useId();

  // Reset value when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus l'input après l'animation d'ouverture
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen, defaultValue]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(value.trim());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel, value]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={handleOverlayClick}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titreId : undefined}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {title && (
              <h3 id={titreId} style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                {title}
              </h3>
            )}

            <input
              ref={inputRef}
              type="text"
              value={value}
              aria-label={title || placeholder || 'Saisie'}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirm(value.trim());
                }
              }}
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--bg-tertiary)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'transparent',
                  border: '1px solid var(--bg-tertiary)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => onConfirm(value.trim())}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: 'var(--accent-fort)', // blanc sur --accent : 3,68 de contraste seulement
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                  // Pas d'opacité conditionnelle : une valeur vide est parfois
                  // légitime (« laisser vide pour utiliser le temps moyen »), et
                  // le bouton grisé laissait croire qu'il était désactivé.
                }}
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
