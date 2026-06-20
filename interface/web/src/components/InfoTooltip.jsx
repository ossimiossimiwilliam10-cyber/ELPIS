import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InfoTooltip({ content, children, width = 250 }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  // Close tooltip on scroll (to prevent floating tooltips)
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => setIsVisible(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isVisible]);

  return (
    <div 
      className="tooltip-container" 
      ref={containerRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
      style={{ display: 'inline-block', position: 'relative', cursor: 'help' }}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="tooltip-popup glass-panel"
            initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 5, x: '-50%', scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
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
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: '-6px',
              borderWidth: '6px',
              borderStyle: 'solid',
              borderColor: 'rgba(20, 20, 30, 0.9) transparent transparent transparent'
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
