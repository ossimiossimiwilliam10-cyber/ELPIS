import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store';
import MusicSettingsModal from './MusicSettingsModal';

function BackgroundMusicPlayer() {
  const [musicData, setMusicData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2); // Volume par défaut bas pour ne pas agresser
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef(null);
  const { pendingTasksCount } = useStore(); // On peut écouter la charge de travail si on veut re-fetch à chaque changement majeur

  const fetchNextTrack = async () => {
    try {
      const res = await fetch('/api/music/recommendation');
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setMusicData(data);
          setError(null);
          // Si on était déjà en train de jouer, on relance automatiquement
          if (isPlaying && audioRef.current) {
            setTimeout(() => {
              audioRef.current.play().catch(e => console.log("Autoplay bloqué :", e));
            }, 100);
          }
        } else {
          // Aucun fichier dans la catégorie
          setMusicData(null);
          setIsPlaying(false);
        }
      }
    } catch (err) {
      console.error("Erreur fetch musique:", err);
      setError("Erreur chargement");
    }
  };

  useEffect(() => {
    fetchNextTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Gérer la fin de la piste pour passer à la suivante automatiquement
  const handleEnded = () => {
    fetchNextTrack();
  };

  // Gérer l'Autoplay "FIFA style" à la première interaction globale
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (audioRef.current && !isPlaying && musicData && musicData.url) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => console.log("Autoplay interactif bloqué:", e));
      }
      // On retire l'écouteur après la première interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isPlaying, musicData]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error("Play error:", e));
    }
  };

  if (!musicData || !musicData.url) {
    return (
      <>
        <button 
          onClick={() => setShowSettings(true)}
          style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-color)', borderRadius: '50px',
            padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            cursor: 'pointer', zIndex: 1000, boxShadow: '0 8px 32px var(--shadow-color)',
            backdropFilter: 'blur(10px)', transition: 'all 0.3s ease'
          }}
          title="Gérer la bibliothèque musicale"
        >
          <span>🎵</span> Ajouter de la musique
        </button>
        {showSettings && <MusicSettingsModal onClose={() => { setShowSettings(false); fetchNextTrack(); }} />}
      </>
    );
  }

  const categoryEmoji = {
    'calm': '🧘',
    'motivational': '🔥'
  }[musicData.category] || '🎵';

  return (
    <div 
      className="glass-panel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '0.8rem 1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 1000,
        boxShadow: '0 8px 32px var(--shadow-color)',
        borderRadius: '50px',
        transition: 'all 0.3s ease',
        opacity: isHovered || !isPlaying ? 1 : 0.6,
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-color)',
        minWidth: isHovered ? '300px' : 'auto'
      }}
    >
      <audio 
        ref={audioRef} 
        src={musicData.url} 
        onEnded={handleEnded} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <button 
        onClick={togglePlay}
        style={{
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.2rem',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>{categoryEmoji}</span> {musicData.category}
        </div>
        <div style={{ 
          fontSize: '1rem', 
          fontWeight: 'bold', 
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '180px'
        }}>
          {musicData.title}
        </div>
      </div>

      {isHovered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <span style={{ fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setVolume(Math.max(0, volume - 0.1))}>🔉</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: '60px', accentColor: 'var(--accent-primary)' }}
          />
          <button 
            onClick={fetchNextTrack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '0.5rem', color: 'var(--text-primary)' }}
            title="Piste suivante"
          >
            ⏭
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '0.5rem', color: 'var(--text-secondary)' }}
            title="Gérer les musiques"
          >
            ⚙️
          </button>
        </div>
      )}

      {showSettings && <MusicSettingsModal onClose={() => { setShowSettings(false); fetchNextTrack(); }} />}
    </div>
  );
}

export default BackgroundMusicPlayer;
