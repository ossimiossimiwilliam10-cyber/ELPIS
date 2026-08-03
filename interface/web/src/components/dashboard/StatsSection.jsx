import { motion } from 'framer-motion';
import CircularProgress from '../CircularProgress';

/**
 * Section Statistiques de Progression du Dashboard.
 */
export default function StatsSection({ stats, globalPercent }) {
  return (
    <motion.div
      className="card glass-panel"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--bg-tertiary)' }}
    >
      <h2>Statistiques de Progression</h2>
      <div style={{display:'flex', gap:'2rem', alignItems:'center', marginBottom:'1.5rem', flexWrap: 'wrap'}}>
        <CircularProgress percent={globalPercent} size={100} strokeWidth={8} />
        <div>
          <h3 style={{marginTop:0}}>Progression Globale</h3>
          <p style={{color:'var(--text-secondary)'}}>{stats.done} objectifs (CM/TD/TP) réalisés sur {stats.total} programmés au total.</p>
        </div>
      </div>

      {stats.perMatiere?.length > 0 ? (
        <div style={{ position: 'relative', width: '100%', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)' }}>
          <div className="stats-carousel" style={{display:'flex', gap:'1rem', overflowX:'auto', paddingBottom:'1rem', paddingLeft: '5%', paddingRight: '5%'}}>
            {stats.perMatiere?.map(m => (
              <div key={m.nom} style={{minWidth:'250px', flexShrink:0, background:'rgba(255,255,255,0.02)', padding:'1rem', borderRadius:'8px', border:'1px solid var(--bg-tertiary)'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', gap: '0.5rem'}}>
                  <strong style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex: '1 1 0', minWidth: 0}} title={m.nom}>{m.nom}</strong>
                  <span style={{color:'var(--success-color)', fontWeight:'bold', flexShrink: 0}}>{m.percent}%</span>
                </div>
                <div className="progress-bar-container" style={{height:'6px', marginTop:0}}>
                  <div className="progress-bar-fill" style={{width:`${m.percent}%`, background:'var(--success-color)'}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{color:'var(--text-secondary)'}}>Aucune donnée disponible. Ajoute des cours pour voir tes statistiques.</p>
      )}
    </motion.div>
  );
}
