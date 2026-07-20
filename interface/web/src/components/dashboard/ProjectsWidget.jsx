import { motion } from 'framer-motion';

/**
 * Widget Projets Personnels — aperçu depuis le Dashboard.
 */
export default function ProjectsWidget({ projets, pendingTasksCount }) {
  return (
    <motion.div
      className="card glass-panel"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      style={{ marginTop: '2rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>💡 Projets Personnels</h2>
      </div>

      {pendingTasksCount > 0 ? (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed var(--bg-tertiary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
          <p style={{ color: 'var(--text-secondary)' }}>Termine d'abord tes {pendingTasksCount} tâches du jour pour débloquer tes projets.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {projets && projets.length > 0 ? projets.map(p => (
            <div key={p.id} style={{ minWidth: '200px', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--bg-tertiary)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{p.titre}</h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {p.phases?.filter(ph => ph.complete).length || 0} / {p.phases?.length || 0} phases complétées
              </div>
            </div>
          )) : (
            <p style={{ color: 'var(--text-secondary)' }}>Aucun projet en cours. Rendez-vous dans l'onglet Projets pour en créer un !</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
