import { useCallback, useRef } from 'react';

/**
 * useSoundEffects - Hook générant des micro-interactions audio synthétisées
 * pour la gamification, sans dépendances lourdes (MP3).
 */
export function useSoundEffects() {
  const audioCtxRef = useRef(null);

  // Initialisation paresseuse de l'AudioContext pour respecter les règles des navigateurs (interaction requise)
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback((frequency, type, duration, vol) => {
    const ctx = initAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Enveloppe ADSR simple pour un son "percussif"
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, [initAudio]);

  // Son de validation d'une tâche (Accord joyeux, ex: Do-Mi-Sol)
  const playTaskComplete = useCallback(() => {
    const vol = 0.15;
    playTone(523.25, 'sine', 0.15, vol); // Do
    setTimeout(() => playTone(659.25, 'sine', 0.15, vol), 100); // Mi
    setTimeout(() => playTone(783.99, 'sine', 0.4, vol), 200); // Sol
  }, [playTone]);

  // Son d'augmentation de streak (Goutte d'eau ascendante)
  const playStreakUp = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    // Sweep de fréquence
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }, [initAudio]);

  // Son de clic générique ("Pop" léger)
  const playClick = useCallback(() => {
    playTone(300, 'sine', 0.1, 0.05);
  }, [playTone]);

  return {
    playTaskComplete,
    playStreakUp,
    playClick
  };
}
