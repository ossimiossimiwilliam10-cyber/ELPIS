import { motion } from 'framer-motion';

/**
 * Panneau Insights IA — burnout, velocity, charge cognitive, matières sans notes.
 */
export default function InsightsPanel({ intelligence }) {
  if (!intelligence) return null;

  return (
    <motion.div
      className="card glass-panel"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--bg-tertiary)', borderLeft: '4px solid #a78bfa', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(167, 139, 250, 0.05))' }}
    >
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa', marginBottom: '1.5rem' }}>
        🧠 Insights IA
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Burnout Risk */}
        {intelligence?.burnoutRisk && intelligence.burnoutRisk.riskLevel !== 'none' && (
          <div style={{
            background: intelligence.burnoutRisk.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.15)' : intelligence.burnoutRisk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            border: `1px solid ${intelligence.burnoutRisk.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.3)' : intelligence.burnoutRisk.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
            padding: '1rem', borderRadius: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: intelligence.burnoutRisk.riskLevel === 'high' ? 'var(--danger-color)' : '#f59e0b' }}>
              {intelligence.burnoutRisk.riskLevel === 'high' ? '🚨 Risque de Burnout Élevé' : intelligence.burnoutRisk.riskLevel === 'medium' ? '⚠️ Fatigue Détectée' : '💤 Sommeil Perturbé'}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{intelligence.burnoutRisk.reason}</div>
          </div>
        )}

        {/* Velocity Insights */}
        {intelligence?.velocityMap && (() => {
          const slowSubjects = Object.entries(intelligence.velocityMap).filter(([, v]) => v.isSlowLearner);
          if (slowSubjects.length === 0) return null;
          return (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#f59e0b' }}>🐢 Matières à Apprentissage Lent</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {slowSubjects.map(([name, v]) => (
                  <div key={name} style={{ marginBottom: '0.3rem' }}>
                    <strong>{name}</strong> — {v.avgSessionsToMaster?.toFixed(1)} sessions/CM en moyenne
                    ({v.masteredCMs}/{v.totalCMs} CM maîtrisés, ~{Math.round(v.estimatedRemainingMinutes/60)}h restantes estimées)
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Cognitive Load */}
        {intelligence?.cognitiveLoadMap && (() => {
          const heavy = Object.entries(intelligence.cognitiveLoadMap).filter(([, v]) => v.cognitiveLoad === 'heavy').map(([n]) => n);
          const light = Object.entries(intelligence.cognitiveLoadMap).filter(([, v]) => v.cognitiveLoad === 'light').map(([n]) => n);
          if (heavy.length === 0 && light.length === 0) return null;
          
          const renderList = (list) => {
            const limit = 5;
            const visible = list.slice(0, limit);
            const remaining = list.length - limit;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                {visible.map(n => <span key={n} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>{n}</span>)}
                {remaining > 0 && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontStyle: 'italic' }}>+{remaining} autres</span>}
              </div>
            );
          };

          return (
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#818cf8' }}>🧬 Chronobiologie Activée</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {heavy.length > 0 && <div style={{ marginBottom: '0.5rem' }}>🌅 <strong>Matin</strong> (charge cognitive élevée) : {renderList(heavy)}</div>}
                {light.length > 0 && <div>🌙 <strong>Soir</strong> (charge cognitive légère) : {renderList(light)}</div>}
              </div>
            </div>
          );
        })()}

        {/* All clear */}
        {intelligence?.burnoutRisk?.riskLevel === 'none' && (
          <div style={{ background: 'rgba(52, 211, 153, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✅ Burnout : Aucun risque détecté</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              ({intelligence.burnoutRisk.daysWithoutRest}j sans repos, {Math.round(intelligence.burnoutRisk.avgDailyMinutes/60 * 10)/10}h/jour moy.)
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
