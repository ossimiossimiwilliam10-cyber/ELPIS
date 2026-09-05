import { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Modal de confirmation — remplace window.confirm() dans toute l'application.
 * @param {boolean} isOpen
 * @param {function} onConfirm appelé sans argument quand l'utilisateur confirme
 * @param {function} onCancel  appelé sans argument quand l'utilisateur annule
 * @param {string}  title     titre de la modale
 * @param {string}  message   texte principal
 * @param {string}  confirmLabel texte du bouton de confirmation (défaut: "Confirmer")
 * @param {string}  cancelLabel  texte du bouton d'annulation (défaut: "Annuler")
 * @param {boolean} danger    passe le bouton de confirmation en rouge
 */
export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirmer',
  message = 'Confirmer cette action ?',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();
  const messageId = useId();

  // Keyboard shortcuts + piège de focus : au clavier, la tabulation doit rester dans
  // la modale tant qu'une décision n'est pas prise.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Rendre le focus à l'élément qui a ouvert la modale.
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [isOpen, onConfirm, onCancel]);

  // Focus initial sur l'action d'annulation : la sortie sans risque.
  useEffect(() => {
    if (!isOpen) return;
    const firstButton = dialogRef.current?.querySelector('button');
    firstButton?.focus();
  }, [isOpen]);

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
            zIndex: 20000
          }}
        >
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={messageId}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center'
            }}
          >
            {title && (
              <h3 id={titleId} style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                {title}
              </h3>
            )}

            <p id={messageId} style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {message}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.65rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--bg-tertiary)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  fontFamily: 'inherit'
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '0.65rem 1.5rem',
                  // Le blanc sur --accent ne donne que 3,68 de contraste ;
                  // --accent-fort le porte à 5,17, comme .el-bouton--primaire.
                  background: danger ? 'var(--danger-color)' : 'var(--accent-fort)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  boxShadow: danger
                    ? '0 4px 14px var(--danger-glow)'
                    : '0 4px 16px var(--accent-glow)'
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
