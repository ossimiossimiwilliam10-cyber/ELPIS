import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * @param {object} [action] bouton facultatif : `{ libelle, onAction }`.
   *   C'est par lui que passe « Annuler » : proposer la réparation à l'endroit
   *   et au moment où l'on constate l'erreur vaut mieux que de laisser
   *   chercher, dans un menu, une commande dont on ignore l'existence.
   */
  const addToast = useCallback((message, type = 'info', duration = 4000, action = null) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, action }]);
    // Une notification porteuse d'une action reste plus longtemps : il faut le
    // temps de lire, de comprendre qu'on s'est trompé, puis de viser.
    const delai = duration > 0 && action ? Math.max(duration, 8000) : duration;
    if (delai > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, delai);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur, action) => addToast(msg, 'success', dur, action),
    error: (msg, dur, action) => addToast(msg, 'error', dur || 6000, action),
    info: (msg, dur, action) => addToast(msg, 'info', dur, action),
    warning: (msg, dur, action) => addToast(msg, 'warning', dur, action),
  };

  // Fix: useCallback can't wrap an object directly. Provide via value.
  const value = { addToast, removeToast, toast };

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.type}`}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => removeToast(t.id)}
            >
              <span className="toast-icon" aria-hidden="true">{icons[t.type]}</span>
              <span className="toast-message">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={(e) => {
                    // Le corps de la notification la referme : sans cela, le
                    // clic sur l'action la déclencherait et la fermerait dans
                    // le même geste, sans que le résultat soit annonçable.
                    e.stopPropagation();
                    t.action.onAction?.();
                    removeToast(t.id);
                  }}
                >
                  {t.action.libelle}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
