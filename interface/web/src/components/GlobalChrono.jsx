import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import useStore from '../store';

export default function GlobalChrono() {
  const { globalChrono, toggleGlobalChrono, resetGlobalChrono, tickGlobalChrono } = useStore();
  const { isRunning, elapsedSeconds, titre, matiereNom, exoId } = globalChrono;
  
  const [isVisible, setIsVisible] = useState(true);
  const [pipWindow, setPipWindow] = useState(null);
  
  // Timer effect
  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        tickGlobalChrono();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, tickGlobalChrono]);

  // Handle PiP Window closing natively
  useEffect(() => {
    if (pipWindow) {
      const handleUnload = () => {
        setPipWindow(null);
      };
      pipWindow.addEventListener('unload', handleUnload);
      return () => pipWindow.removeEventListener('unload', handleUnload);
    }
  }, [pipWindow]);

  const openPip = async () => {
    if (!('documentPictureInPicture' in window)) {
      alert("Votre navigateur ne supporte pas le mode Picture-in-Picture pour les documents (Essayez Google Chrome).");
      return;
    }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 120,
      });

      // Copy styles
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pip.document.createElement('style');
          style.textContent = cssRules;
          pip.document.head.appendChild(style);
        } catch {
          const link = pip.document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media;
          link.href = styleSheet.href;
          pip.document.head.appendChild(link);
        }
      });
      
      // Set background color of the body to match our theme
      pip.document.body.style.background = 'var(--bg-primary, #0f172a)';
      pip.document.body.style.display = 'flex';
      pip.document.body.style.alignItems = 'center';
      pip.document.body.style.justifyContent = 'center';
      pip.document.body.style.margin = '0';
      pip.document.body.style.height = '100vh';
      pip.document.body.style.color = 'white';

      setPipWindow(pip);
    } catch (err) {
      console.error(err);
      alert("Impossible d'ouvrir la fenêtre détachable.");
    }
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // The actual UI content of the chrono
  const chronoContent = (
    <div 
      className={!isRunning && elapsedSeconds > 0 ? "chrono-paused-blink" : ""}
      style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
      background: 'var(--bg-secondary, #1e293b)',
      padding: '0.75rem 1rem',
      borderRadius: '16px',
      boxShadow: pipWindow ? 'none' : '0 8px 24px rgba(0,0,0,0.4)',
      border: pipWindow ? 'none' : '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      width: '100%',
      maxWidth: '300px',
      boxSizing: 'border-box'
    }}>
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
            transition: 'background 0.2s',
            fontSize: '1rem'
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
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '80px' }}>
        {exoId && (
          <div style={{
            fontSize: '0.7rem', 
            color: 'var(--text-secondary)',
            maxWidth: '120px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '-2px'
          }} title={`${matiereNom} - ${titre}`}>
            {titre}
          </div>
        )}
        <div style={{
          fontFamily: 'monospace', 
          fontSize: '1.4rem', 
          fontWeight: 'bold', 
          color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
          userSelect: 'none',
          letterSpacing: '1px'
        }}>
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      {!pipWindow ? (
        <button
          onClick={openPip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '4px',
            opacity: 0.8,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
          title="Détacher en mini-fenêtre flottante (système)"
        >
          ⏏️
        </button>
      ) : null}

      {!pipWindow && (
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '4px',
            opacity: 0.6
          }}
          title="Masquer"
        >
          ✖
        </button>
      )}
    </div>
  );

  // If in PiP mode, render through Portal
  if (pipWindow) {
    return createPortal(chronoContent, pipWindow.document.body);
  }

  // Hidden state (icon only)
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

  // Normal draggable floating state
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
        cursor: 'grab'
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
    >
      {chronoContent}
    </motion.div>
  );
}
