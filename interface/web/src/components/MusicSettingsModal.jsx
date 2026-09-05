import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useToast } from '../ToastProvider';
import { getApiUrl } from '../utils/apiConfig';
import logger from '../utils/logger';
import ConfirmModal from './ConfirmModal';

/** Au-delà, l'envoi échoue côté serveur après une longue attente sans explication. */
const TAILLE_MAX_OCTETS = 30 * 1024 * 1024;

export default function MusicSettingsModal({ onClose }) {
  const [musics, setMusics] = useState({ calm: [], motivational: [] });
  const [loading, setLoading] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const { addToast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, category: '', filename: '' });
  const monte = useRef(true);
  const titreId = useId();

  /** Lit une erreur serveur, même quand la réponse n'est pas du JSON. */
  const messageErreur = async (res, defaut) => {
    try {
      const err = await res.json();
      return err?.error || defaut;
    } catch {
      return `${defaut} (réponse ${res.status})`;
    }
  };

  const fetchMusics = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/music/list`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // La réponse pouvait arriver après la fermeture de la modale.
      if (monte.current) setMusics(data);
    } catch (err) {
      logger.error("Erreur de chargement de la liste des musiques :", err);
      if (monte.current) addToast("Impossible de charger les musiques.", "error");
    } finally {
      if (monte.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    monte.current = true;
    fetchMusics();
    return () => { monte.current = false; };
  }, [fetchMusics]);

  // La modale ne se fermait ni à l'échappement ni au clic extérieur, à rebours
  // du reste de l'application.
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onClose]);

  const handleFileUpload = async (e, category) => {
    const files = Array.from(e.target.files || []);
    e.target.value = null;
    if (files.length === 0) return;

    // Rien ne vérifiait le type ni le poids : un fichier trop lourd partait au
    // serveur pour n'échouer qu'après une longue attente.
    const acceptes = files.filter(f => {
      if (!f.type.startsWith('audio/')) {
        addToast(`« ${f.name} » n'est pas un fichier audio.`, "error");
        return false;
      }
      if (f.size > TAILLE_MAX_OCTETS) {
        addToast(`« ${f.name} » dépasse 30 Mo.`, "error");
        return false;
      }
      return true;
    });
    if (acceptes.length === 0) return;

    const formData = new FormData();
    formData.append('category', category);
    acceptes.forEach(f => formData.append('files', f));

    setEnvoiEnCours(true);
    try {
      addToast("Envoi en cours…", "info");
      const res = await fetch(`${getApiUrl()}/music/upload`, { method: 'POST', body: formData });

      if (res.ok) {
        const data = await res.json();
        addToast(
          data.message || "Musiques ajoutées.",
          data.ignored?.length > 0 ? "info" : "success"
        );
        await fetchMusics();
      } else {
        addToast(await messageErreur(res, "Envoi refusé"), "error");
      }
    } catch (error) {
      logger.error("Erreur lors de l'envoi de musiques :", error);
      addToast("Serveur injoignable pendant l'envoi.", "error");
    } finally {
      if (monte.current) setEnvoiEnCours(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const { category, filename } = deleteConfirm;
    setDeleteConfirm({ open: false, category: '', filename: '' });

    try {
      const res = await fetch(`${getApiUrl()}/music/${category}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("Musique supprimée", "success");
        await fetchMusics();
      } else {
        addToast(await messageErreur(res, "Suppression refusée"), "error");
      }
    } catch (error) {
      logger.error("Erreur lors de la suppression d'une musique :", error);
      addToast("Serveur injoignable pendant la suppression.", "error");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titreId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
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
          <h2 id={titreId} style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true">🎵</span> Bibliothèque Musicale
          </h2>
          <button onClick={onClose} aria-label="Fermer la bibliothèque musicale" style={{
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
                        background: 'var(--accent-fort)', color: 'white',
                        padding: '0.3rem 0.6rem', borderRadius: '8px',
                        cursor: envoiEnCours ? 'wait' : 'pointer',
                        opacity: envoiEnCours ? 0.6 : 1,
                        fontSize: '0.8rem', fontWeight: 'bold'
                      }}>
                        {envoiEnCours ? 'Envoi…' : '+ Ajouter'}
                        <input
                          type="file"
                          multiple
                          accept="audio/*"
                          // Un second envoi lancé pendant le premier brouillait
                          // l'ordre des rafraîchissements de la liste.
                          disabled={envoiEnCours}
                          aria-label={`Ajouter des musiques ${cat === 'calm' ? 'calmes' : 'motivantes'}`}
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
                              onClick={() => setDeleteConfirm({ open: true, category: cat, filename })}
                              style={{
                                background: 'none', border: 'none', color: '#ff4444',
                                cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem'
                              }}
                              title="Supprimer"
                              // Sans libellé, le bouton s'annonçait « 🗑️ », sans
                              // moyen de savoir quelle musique il visait.
                              aria-label={`Supprimer ${filename}`}
                            >
                              <span aria-hidden="true">🗑️</span>
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

      <ConfirmModal
        isOpen={deleteConfirm.open}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false, category: '', filename: '' })}
        title="Supprimer la musique"
        message={`Supprimer définitivement "${deleteConfirm.filename}" ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
