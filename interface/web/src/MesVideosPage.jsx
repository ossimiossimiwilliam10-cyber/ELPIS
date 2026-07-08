import React, { useState, useMemo } from 'react';
import useStore from './store';
import { useToast } from './ToastProvider';

export default function MesVideosPage() {
  const { config, coursConfig, setConfig } = useStore();
  const { addToast } = useToast();
  
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('');

  const videos = config.mesVideos || [];

  // Get all matieres for the select dropdown
  const matieres = useMemo(() => {
    if (!coursConfig?.licences) return [];
    const list = [];
    coursConfig.licences.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom) list.push(m.nom);
          });
        });
      });
    });
    return list;
  }, [coursConfig]);

  const handleAddVideo = (e) => {
    e.preventDefault();
    if (!url || !title || !selectedMatiere) {
      addToast("Veuillez remplir tous les champs.", 'error');
      return;
    }

    // Check duplicates
    if (videos.some(v => v.url === url)) {
      addToast("Cette vidéo existe déjà dans votre liste.", 'error');
      return;
    }

    const newVideo = {
      id: Date.now().toString(),
      url,
      title,
      matiereNom: selectedMatiere,
      addedAt: new Date().toISOString()
    };

    setConfig({ ...config, mesVideos: [...videos, newVideo] });
    addToast("Vidéo ajoutée avec succès !", 'success');
    
    setUrl('');
    setTitle('');
    setSelectedMatiere('');
  };

  const handleDelete = (id) => {
    if (window.confirm("Supprimer cette vidéo ?")) {
      setConfig({ ...config, mesVideos: videos.filter(v => v.id !== id) });
      addToast("Vidéo supprimée.", 'info');
    }
  };

  // Group videos by matiere
  const videosByMatiere = useMemo(() => {
    const grouped = {};
    videos.forEach(v => {
      if (!grouped[v.matiereNom]) grouped[v.matiereNom] = [];
      grouped[v.matiereNom].push(v);
    });
    return grouped;
  }, [videos]);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🎥 Mes Vidéos
      </h1>

      {/* Add Form */}
      <div className="card glass-panel" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>➕</span> Ajouter une nouvelle vidéo
        </h2>
        <form onSubmit={handleAddVideo} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Titre de la vidéo</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Ex: Explication Théorème..."
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'white' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Lien YouTube</label>
            <input 
              type="url" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://youtube.com/watch?v=..."
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'white' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Matière associée</label>
            <select 
              value={selectedMatiere} 
              onChange={e => setSelectedMatiere(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'white' }}
            >
              <option value="">-- Choisir une matière --</option>
              {matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.6rem', height: '40px' }}>
            Ajouter
          </button>
        </form>
      </div>

      {/* Video Grid */}
      {Object.keys(videosByMatiere).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📭</span>
          Aucune vidéo enregistrée pour le moment.
        </div>
      ) : (
        Object.entries(videosByMatiere).map(([matiere, vids]) => (
          <div key={matiere} style={{ marginBottom: '2rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>
              {matiere}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {vids.map(video => (
                <div key={video.id} className="card glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{video.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                    Ajoutée le {new Date(video.addedAt).toLocaleDateString()}
                  </span>
                  
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => window.open(video.url, '_blank')}
                      className="btn-primary" 
                      style={{ flex: 1, padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <span>▶️</span> Ouvrir
                    </button>
                    <button 
                      onClick={() => handleDelete(video.id)}
                      className="btn-secondary"
                      style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      title="Supprimer la vidéo"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
