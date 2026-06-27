import React, { useState, useEffect } from 'react';
import { useToast } from '../ToastProvider';

export default function MusicSettingsModal({ onClose }) {
  const [musics, setMusics] = useState({ calm: [], motivational: [] });
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchMusics = async () => {
    try {
      const res = await fetch('/api/music/list');
      if (res.ok) {
        const data = await res.json();
        setMusics(data);
      }
    } catch (err) {
      console.error("Erreur fetch liste musiques:", err);
      addToast("Erreur lors du chargement des musiques", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusics();
  }, []);

  const handleFileUpload = async (e, category) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('category', category);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      addToast("Upload en cours...", "info");
      const res = await fetch('/api/music/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ignored && data.ignored.length > 0) {
          addToast(data.message, "info");
        } else {
          addToast(data.message || "Musiques ajoutées avec succès !", "success");
        }
        fetchMusics();
      } else {
        const err = await res.json();
        addToast("Erreur: " + err.error, "error");
      }
    } catch (error) {
      console.error("Upload error:", error);
      addToast("Erreur lors de l'upload", "error");
    }
    
    // Reset l'input
    e.target.value = null;
  };

  const handleDelete = async (category, filename) => {
    if (!window.confirm(`Supprimer définitivement "${filename}" ?`)) return;

    try {
      const res = await fetch(`/api/music/${category}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("Musique supprimée", "success");
        fetchMusics();
      } else {
        const err = await res.json();
        addToast("Erreur: " + err.error, "error");
      }
    } catch (error) {
      console.error("Delete error:", error);
      addToast("Erreur lors de la suppression", "error");
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(5px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 2000
    }}>
      <div className="glass-panel" style={{
        width: '90%', maxWidth: '800px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          padding: '1.5rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎵</span> Bibliothèque Musicale
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: '1.5rem', cursor: 'pointer'
          }}>✖</button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              {['calm', 'motivational'].map(cat => (
                <div key={cat} style={{
                  backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', padding: '1rem',
                  display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', textTransform: 'capitalize' }}>
                      {cat === 'calm' ? '🧘 Calm' : '🔥 Motivational'}
                    </h3>
                    <div style={{ position: 'relative' }}>
                      <label style={{
                        background: 'var(--accent-primary)', color: 'white',
                        padding: '0.3rem 0.6rem', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 'bold'
                      }}>
                        + Ajouter
                        <input 
                          type="file" 
                          multiple 
                          accept="audio/*" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleFileUpload(e, cat)}
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                    {musics[cat] && musics[cat].length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {musics[cat].map(filename => (
                          <li key={filename} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}>
                            <span style={{ 
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' 
                            }} title={filename}>
                              {filename}
                            </span>
                            <button 
                              onClick={() => handleDelete(cat, filename)}
                              style={{
                                background: 'none', border: 'none', color: '#ff4444', 
                                cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem'
                              }}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                        Aucune musique dans ce dossier
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
