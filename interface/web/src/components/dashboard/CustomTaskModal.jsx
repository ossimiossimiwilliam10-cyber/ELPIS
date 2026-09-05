import { motion } from 'framer-motion';

export default function CustomTaskModal({ isOpen, onClose, params, setParams, onSubmit, allMatieres }) {
  if (!isOpen) return null;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-content glass-panel" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ maxWidth: '400px', width: '90%' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--success-color)' }}>✨ Nouvelle Activité Libre</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Titre de l'activité</label>
          <input type="text" value={params.titre} onChange={(e) => setParams({...params, titre: e.target.value})} placeholder="Lecture, projet personnel, révision libre…" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }} autoFocus />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Catégorie</label>
          <select value={params.type} onChange={(e) => setParams({...params, type: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <option value="PERSO">Perso / Projet</option><option value="LECTURE">Lecture / Veille</option><option value="ANKI">Anki (Flashcards)</option><option value="CM">CM (Cours)</option><option value="TD">TD (Exercices)</option><option value="TP">TP (Pratique)</option><option value="ANNALE">Annale (Examen)</option>
          </select>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Matière rattachée</label>
          <select value={params.matiere} onChange={(e) => setParams({...params, matiere: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <option value="">Aucune (Général)</option>
            {allMatieres.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.6rem 1.2rem' }}>Annuler</button>
          <button className="btn-primary" onClick={onSubmit} disabled={!params.titre.trim()} style={{ padding: '0.6rem 1.2rem' }}>Démarrer</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
