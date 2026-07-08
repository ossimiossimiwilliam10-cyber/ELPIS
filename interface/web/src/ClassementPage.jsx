import React, { useMemo } from 'react';
import useStore from './store';

// Helper to compute standard normal CDF
function jStatNormalCdf(x, mean, std) {
  return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
}

function erf(x) {
  var sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  var a1 =  0.254829592;
  var a2 = -0.284496736;
  var a3 =  1.421413741;
  var a4 = -1.453152027;
  var a5 =  1.061405429;
  var p  =  0.3275911;
  var t = 1.0 / (1.0 + p * x);
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export default function ClassementPage() {
  const { coursConfig, historique, rankingBaseline } = useStore();

  const data = useMemo(() => {
    let globalSumNotes = 0;
    let globalSumECTS = 0;
    const subjectRanks = [];

    const activeLicence = coursConfig.licences?.find(l => !l.archived);
    if (activeLicence) {
      activeLicence.semestres?.filter(s => !s.archived).forEach(sem => {
        sem.ues?.forEach(ue => {
          ue.matieres?.forEach(m => {
             const evals = m.evaluations || [];
             const validEvals = evals.filter(ev => typeof ev.note === 'number');
             if (validEvals.length > 0) {
               const sum = validEvals.reduce((acc, ev) => acc + (ev.note / (ev.sur || 20)) * 20, 0);
               const avg = sum / validEvals.length;
               
               const ects = m.coefficient !== undefined ? Number(m.coefficient) : (ue.ects || 1);
               if (ects > 0) {
                 globalSumNotes += avg * ects;
                 globalSumECTS += ects;
               }

               // Subject Ranking
               const baseline = rankingBaseline?.subjects?.[m.nom];
               if (baseline) {
                 let zScore = (avg - baseline.mean) / baseline.sd;
                 // Clip Z-score to realistic bounds [-3, 3] to avoid extreme percentiles
                 zScore = Math.max(-3, Math.min(3, zScore));
                 const percentile = jStatNormalCdf(zScore, 0, 1) * 100;
                 subjectRanks.push({
                   nom: m.nom,
                   note: avg,
                   mean: baseline.mean,
                   sd: baseline.sd,
                   rank: Math.max(100 - percentile, 0.1) // Top X %
                 });
               }
             }
          });
        });
      });
    }

    const globalAcademicAvg = globalSumECTS > 0 ? (globalSumNotes / globalSumECTS) : 0;
    const academicScore = Math.min((globalAcademicAvg / 20) * 100, 100);

    const reviews = historique.filter(h => h.type === 'revision');
    const successfulReviews = reviews.filter(h => h.difficulty && h.difficulty > 1).length;
    const fsrsScore = reviews.length > 0 ? (successfulReviews / reviews.length) * 100 : 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = historique.filter(h => new Date(h.date).getTime() > thirtyDaysAgo).length;
    const workloadScore = Math.min((recentSessions / 60) * 100, 100);

    const compositeScore = (academicScore * 0.4) + (fsrsScore * 0.4) + (workloadScore * 0.2);

    let rankPercentage = 50;
    if (rankingBaseline?.globalMean && rankingBaseline?.globalSD) {
       let globalZ = (compositeScore - rankingBaseline.globalMean) / rankingBaseline.globalSD;
       globalZ = Math.max(-3, Math.min(3, globalZ));
       const percentile = jStatNormalCdf(globalZ, 0, 1) * 100;
       rankPercentage = Math.max(100 - percentile, 0.1);
    }

    // Sort subjects by rank
    subjectRanks.sort((a, b) => a.rank - b.rank);

    return {
      academicScore: academicScore.toFixed(1),
      fsrsScore: fsrsScore.toFixed(1),
      workloadScore: workloadScore.toFixed(1),
      compositeScore: compositeScore.toFixed(1),
      rankPercentage: rankPercentage.toFixed(1),
      subjectRanks
    };
  }, [coursConfig, historique, rankingBaseline]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Classement & Performances
      </h1>
      
      <div className="card glass-panel" style={{ marginBottom: '2rem', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>
          Ton Rang Virtuel Global
        </h2>
        <div style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(var(--accent-primary-rgb), 0.5)' }}>
          Top {data.rankPercentage}%
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
          Basé sur un score composite incluant ta charge de travail, tes notes, et l'algorithme de mémoire FSRS.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Score Académique (40%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{data.academicScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${data.academicScore}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
          </div>
        </div>

        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Rétention FSRS (40%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{data.fsrsScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${data.fsrsScore}%`, height: '100%', background: 'var(--accent-secondary)', borderRadius: '4px' }}></div>
          </div>
        </div>

        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Effort Constant (20%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{data.workloadScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${data.workloadScore}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
        Détail par Matière
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data.subjectRanks.length === 0 && (
           <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Aucune donnée statistique disponible pour tes matières actuelles.</div>
        )}
        {data.subjectRanks.map((sub, i) => (
          <div key={i} className="card glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{sub.nom}</h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Ta note: {sub.note.toFixed(2)}/20 | Moyenne promotion: {sub.mean.toFixed(1)} (±{sub.sd.toFixed(1)})
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: sub.rank < 50 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                Top {sub.rank.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
