import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import useStore, { useChronoStore } from '../store';
import { useToast } from '../ToastProvider';
import useInputModal from '../hooks/useInputModal';
import InputModal from '../components/InputModal';

export default function GlobalChrono() {
  const { globalChrono, toggleGlobalChrono, resetGlobalChrono, tickGlobalChrono, setGlobalChronoTime } = useChronoStore();
  const { isRunning, elapsedSeconds, titre, matiereNom, exoId, type } = globalChrono;
  const { toast } = useToast();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();

  const [isVisible, setIsVisible] = useState(true);
  // Détecté une fois : un appareil sans survol doit montrer les contrôles.
  const [estTactile] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(hover: none)').matches
  );
  const [pipWindow, setPipWindow] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const saveLockRef = useRef(false);

  const handleSave = () => {
    if (!exoId || saveLockRef.current) return;
    saveLockRef.current = true; // Lock the save function immediately
    const addHistoriqueEntry = useStore.getState().addHistoriqueEntry;

    // Convertir les secondes en minutes (minimum 1 minute)
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));

    addHistoriqueEntry({
      type: type || 'PERSO',
      titre: titre || 'Activité Libre',
      matiere: matiereNom || '',
      action: 'Terminé',
      dureeMinutes: minutes
    });

    toast.success(`Activité enregistrée (${minutes} min) !`);

    import('canvas-confetti').then((module) => {
      const confetti = module.default;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#818CF8', '#34D399', '#FBBF24']
      });
    });

    resetGlobalChrono();
  };

  // Reset lock when a new task is started
  useEffect(() => {
    if (exoId) {
      saveLockRef.current = false;
    }
  }, [exoId]);

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
      alert("Ton navigateur ne gère pas l'affichage en vignette pour les documents. Google Chrome le permet.");
      return;
    }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 280,
        height: 320,
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

      // Set background
      pip.document.body.style.background = 'var(--bg-primary, #0f172a)';
      pip.document.body.style.display = 'flex';
      pip.document.body.style.alignItems = 'center';
      pip.document.body.style.justifyContent = 'center';
      pip.document.body.style.margin = '0';
      pip.document.body.style.height = '100vh';
      pip.document.body.style.color = 'white';
      pip.document.body.style.overflow = 'hidden';

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

  const handleEditTime = async () => {
    const input = await prompt("Saisir le temps en minutes (ex: 15.5 pour 15m30s) :", (elapsedSeconds / 60).toFixed(1));
    if (input !== null) {
      const mins = parseFloat(input.replace(',', '.'));
      if (!isNaN(mins) && mins >= 0) {
        setGlobalChronoTime(Math.floor(mins * 60));
      }
    }
  };

  const typeEmoji = {
    'CM': '📖',
    'TD': '✏️',
    'TP': '🔬',
    'ANNALE': '📝',
    'Projet': '🏗️',
    'Exercice': '✏️'
  }[type] || '⏱️';

  // If the chrono has been fully reset (no active task), hide it completely
  if (!exoId && !isRunning && elapsedSeconds === 0) {
    return null;
  }

  // ========== PiP (Detached) Content ==========
  const pipContent = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.8rem',
      width: '100%',
      height: '100%',
      padding: '1rem',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Title area */}
      {exoId && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          maxWidth: '240px',
        }}>
          <div style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary, #94A3B8)',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            fontWeight: 600,
          }}>
            {typeEmoji} {matiereNom || type}
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-primary, #F8FAFC)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '220px',
            fontWeight: 500,
          }} title={titre}>
            {titre}
          </div>
        </div>
      )}

      {/* Clock ring */}
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        {/* Outer ring glow */}
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle
            cx="70" cy="70" r="62"
            fill="none"
            stroke={isRunning ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.1)'}
            strokeWidth="4"
          />
          {/* Animated progress ring (completes a full cycle every 60s) */}
          <circle
            cx="70" cy="70" r="62"
            fill="none"
            stroke={isRunning ? 'var(--accent-primary, #3B82F6)' : 'var(--text-secondary, #94A3B8)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 62}`}
            strokeDashoffset={`${2 * Math.PI * 62 * (1 - (elapsedSeconds % 60) / 60)}`}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s ease' }}
          />
        </svg>
        {/* Center time display */}
        <div
          onClick={handleEditTime}
          title="Modifier manuellement le temps"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: elapsedSeconds >= 3600 ? '1.6rem' : '2rem',
            fontWeight: 700,
            color: isRunning ? 'var(--text-primary, #F8FAFC)' : 'var(--text-secondary, #94A3B8)',
            cursor: 'pointer',
            letterSpacing: '2px',
            textShadow: isRunning ? '0 0 20px rgba(59, 130, 246, 0.4)' : 'none',
            transition: 'color 0.3s, text-shadow 0.3s',
            userSelect: 'none',
          }}
        >
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Reset */}
        <button
          onClick={resetGlobalChrono}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary, #94A3B8)',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title="Réinitialiser"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)'; }}
        >
          ↺
        </button>

        {/* Terminer & Sauvegarder */}
        <button
          onClick={handleSave}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary, #94A3B8)',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title="Terminer & Sauvegarder"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.15)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; e.currentTarget.style.color = '#34D399'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)'; }}
        >
          ✅
        </button>

        {/* Play/Pause - main action */}
        <button
          onClick={toggleGlobalChrono}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            background: isRunning
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #3B82F6, #2563EB)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isRunning
              ? '0 4px 20px rgba(239, 68, 68, 0.4)'
              : '0 4px 20px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.3s ease',
          }}
          title={isRunning ? "Mettre en pause" : "Démarrer"}
        >
          {isRunning ? '⏸' : '▶'}
        </button>

        {/* Edit time */}
        <button
          onClick={handleEditTime}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary, #94A3B8)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title="Modifier le temps manuellement"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.color = '#3B82F6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)'; }}
        >
          ✎
        </button>
      </div>
    </div>
  );

  // ========== Inline (Floating Widget) Content ==========
  const inlineContent = (
    <div
      className={!isRunning && elapsedSeconds > 0 ? "chrono-paused-blink" : ""}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        background: 'var(--bg-secondary, #1e293b)',
        padding: '0.6rem 0.8rem',
        borderRadius: '14px',
        boxShadow: isRunning
          ? '0 4px 24px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.15)'
          : '0 4px 16px rgba(0,0,0,0.3)',
        border: isRunning ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        transition: 'all 0.3s ease',
        maxWidth: '320px',
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={toggleGlobalChrono}
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: 'none',
          background: isRunning
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #3B82F6, #2563EB)',
          color: 'white',
          cursor: 'pointer',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isRunning
            ? '0 2px 10px rgba(239, 68, 68, 0.3)'
            : '0 2px 10px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.3s ease',
        }}
        title={isRunning ? "Mettre en pause" : "Démarrer"}
      >
        {isRunning ? '⏸' : '▶'}
      </button>

      {/* Info section */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        {exoId && (
          <div style={{
            fontSize: '0.65rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }} title={`${matiereNom} — ${titre}`}>
            {typeEmoji} {titre}
          </div>
        )}
        <div
          onClick={handleEditTime}
          title="Modifier manuellement le temps"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '1.15rem',
            fontWeight: 700,
            color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)',
            letterSpacing: '1.5px',
            cursor: 'pointer',
            userSelect: 'none',
            lineHeight: 1.3,
          }}
        >
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      {/* Boutons d'action : au survol, au focus clavier, et en permanence sur
          écran tactile — il n'y a pas de survol au doigt, si bien que
          « Réinitialiser » et « Terminer » étaient inatteignables sur Android. */}
      <AnimatePresence>
        {(isHovered || estTactile) && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden' }}
          >
            <button
              onClick={resetGlobalChrono}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '0.9rem', padding: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; }}
              title="Réinitialiser"
            >
              ↺
            </button>

            <button
              onClick={handleSave}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '0.9rem', padding: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#34D399'; e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; }}
              title="Terminer & Sauvegarder"
            >
              ✅
            </button>

            {typeof window !== 'undefined' && 'documentPictureInPicture' in window && (
              <button
                onClick={openPip}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: '0.9rem', padding: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; }}
                title="Détacher en mini-fenêtre"
              >
                ⏏️
              </button>
            )}

            <button
              onClick={() => setIsVisible(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '0.75rem', padding: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', transition: 'all 0.2s',
                opacity: 0.6,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
              title="Masquer"
            >
              ✖
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // If in PiP mode, render through Portal
  if (pipWindow) {
    return createPortal(pipContent, pipWindow.document.body);
  }

  // Hidden state (icon only)
  if (!isVisible) {
    return (
      <button
        className="global-timer-hidden-btn"
        onClick={() => setIsVisible(true)}
        title="Afficher le chrono"
      >
        ⏱️
      </button>
    );
  }

  // Normal draggable floating state
  return (
    <motion.div
      className="global-timer-widget"
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
    >
      {inlineContent}
      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </motion.div>
  );
}
