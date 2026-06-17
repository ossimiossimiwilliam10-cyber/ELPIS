import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store';

export default function GlobalChrono() {
  const { globalChrono, toggleGlobalChrono, resetGlobalChrono, tickGlobalChrono } = useStore();
  const { isRunning, elapsedSeconds, titre, matiereNom, exoId } = globalChrono;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        tickGlobalChrono();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, tickGlobalChrono]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'var(--accent-primary, #3b82f6)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem'
        }}
        title="Afficher le chrono"
      >
        ⏱️
      </button>
    );
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'var(--bg-secondary, #1e293b)',
        padding: '0.75rem 1.25rem',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        cursor: 'grab',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button 
          onClick={toggleGlobalChrono}
          style={{
            background: isRunning ? '#ef4444' : '#10B981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '50%', 
            width: '36px', 
            height: '36px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          title={isRunning ? "Mettre en pause" : "Démarrer"}
        >
          {isRunning ? '⏸' : '▶'}
        </button>
        <button
          onClick={resetGlobalChrono}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px'
          }}
          title="Réinitialiser"
        >
          🔄
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {exoId && (
          <div style={{
            fontSize: '0.7rem', 
            color: 'var(--text-secondary)',
            maxWidth: '120px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '-4px'
          }} title={`${matiereNom} - ${titre}`}>
            {titre}
          </div>
        )}
        <div style={{
          fontFamily: 'monospace', 
          fontSize: '1.4rem', 
          fontWeight: 'bold', 
          color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)',
          minWidth: '70px',
          textAlign: 'center',
          userSelect: 'none',
          letterSpacing: '1px'
        }}>
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      <button
        onClick={() => setIsVisible(false)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '4px',
          marginLeft: '0.5rem',
          opacity: 0.6
        }}
        title="Masquer"
      >
        ✖
      </button>
    </motion.div>
  );
}
