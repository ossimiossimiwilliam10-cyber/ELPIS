import { useState, useCallback, useRef } from 'react';

/**
 * Hook pour remplacer window.prompt() par un modal React.
 * Retourne { prompt, InputModal, isOpen, config, handleConfirm, handleCancel }
 *
 * Usage :
 *   const { prompt, InputModal } = useInputModal();
 *   // ...
 *   const result = await prompt("Question ?", "valeur par défaut");
 *   if (result !== null) { ... }
 */
export default function useInputModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({ title: '', defaultValue: '', placeholder: '' });
  const resolveRef = useRef(null);

  const prompt = useCallback((title, defaultValue = '', placeholder = '') => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfig({ title, defaultValue, placeholder });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback((value) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(value);
      resolveRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
  }, []);

  return {
    prompt,
    isOpen,
    config,
    handleConfirm,
    handleCancel
  };
}
