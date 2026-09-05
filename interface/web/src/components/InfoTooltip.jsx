import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Bulle d'aide contextuelle.
 *
 * Atteignable au clavier autant qu'à la souris : l'explication n'était visible
 * qu'au survol, donc inaccessible à qui navigue au clavier ou à l'oreille.
 */
export default function InfoTooltip({ content, children, width = 250 }) {
  const [isVisible, setIsVisible] = useState(false);
  const bulleId = useId();

  // Refermer au défilement, sinon la bulle flotte à côté de sa cible.
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => setIsVisible(false);
    const handleKey = (e) => { if (e.key === 'Escape') setIsVisible(false); };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isVisible]);

  return (
    <span
      className="tooltip-container"
      role="button"
      tabIndex={0}
      aria-expanded={isVisible}
      aria-describedby={isVisible ? bulleId : undefined}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onClick={() => setIsVisible(v => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsVisible(v => !v);
        }
      }}
      style={{ display: 'inline-block', position: 'relative', cursor: 'help' }}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.span
            id={bulleId}
            role="tooltip"
            className="tooltip-popup glass-panel"
            initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 5, x: '-50%', scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'block',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              marginBottom: '8px',
              width: width,
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              lineHeight: '1.4',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(20, 20, 30, 0.9)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {content}
            {/* Petit triangle (flèche) vers le bas */}
            <span style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: '-6px',
              borderWidth: '6px',
              borderStyle: 'solid',
              borderColor: 'rgba(20, 20, 30, 0.9) transparent transparent transparent'
            }} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
