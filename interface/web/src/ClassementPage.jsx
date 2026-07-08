import React, { useMemo } from 'react';
import useStore from './store';

// Helper to compute standard normal CDF
function jStatNormalCdf(x, mean, std) {
  return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
}

function erf(x) {
  // Save the sign of x
  var sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  
  // Constants
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

  const compositeData = useMemo(() => {
    // 1. Academic Average
    let globalSumNotes = 0;
    let globalSumECTS = 0;
    const activeLicence = coursConfig.licences?.find(l => !l.archived);
    if (activeLicence) {
      activeLicence.semestres?.filter(s => !s.archived).forEach(sem => {
        sem.ues?.forEach(ue => {
          let ueSumWeight = 0;
          let ueSumNotes = 0;
          let ueBonus = 0;
          ue.matieres?.forEach(m => {
             const evals = m.evaluations || [];
             if (evals.length > 0) {
               const sum = evals.reduce((acc, ev) => acc + (ev.note / ev.sur)*20, 0);
               const avg = sum / evals.length;
               const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
               if (coef === 0) ueBonus += avg;
               else {
                 ueSumWeight += coef;
                 ueSumNotes += avg * coef;
               }
             }
          });
          const ueAvg = ueSumWeight > 0 ? (ueSumNotes / ueSumWeight) + ueBonus : null;
          if (ueAvg !== null) {
            const ects = ue.ects || 0;
            globalSumNotes += ueAvg * ects;
            globalSumECTS += ects;
          }
        });
      });
    }
    const globalAcademicAvg = globalSumECTS > 0 ? (globalSumNotes / globalSumECTS) : 0;
    const academicScore = Math.min((globalAcademicAvg / 20) * 100, 100);

    // 2. FSRS Retention (Simulated from history)
    // Simply percentage of successful reviews in history
    const reviews = historique.filter(h => h.type === 'revision');
    const successfulReviews = reviews.filter(h => h.difficulty && h.difficulty > 1).length;
    const fsrsScore = reviews.length > 0 ? (successfulReviews / reviews.length) * 100 : 0;

    // 3. Workload Effort
    // Let's count recent sessions (last 30 days) vs expected (2 per day = 60)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = historique.filter(h => new Date(h.date).getTime() > thirtyDaysAgo).length;
    const workloadScore = Math.min((recentSessions / 60) * 100, 100);

    // Composite Score
    const compositeScore = (academicScore * 0.4) + (fsrsScore * 0.4) + (workloadScore * 0.2);

    // Percentile Calculation based on baseline
    const percentile = jStatNormalCdf(compositeScore, rankingBaseline.globalMean, rankingBaseline.globalSD) * 100;
    const rankPercentage = Math.max(100 - percentile, 0.1); // Top X %

    return {
      academicScore: academicScore.toFixed(1),
      fsrsScore: fsrsScore.toFixed(1),
      workloadScore: workloadScore.toFixed(1),
      compositeScore: compositeScore.toFixed(1),
      rankPercentage: rankPercentage.toFixed(1)
    };
  }, [coursConfig, historique, rankingBaseline]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Classement Global
      </h1>
      
      <div className="card glass-panel" style={{ marginBottom: '2rem', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>
          Ton Rang Virtuel
        </h2>
        <div style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(var(--accent-primary-rgb), 0.5)' }}>
          Top {compositeData.rankPercentage}%
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
          Ce classement utilise un <strong>Score Composite</strong> exclusif (Notes + Rétention Mémoire + Effort) comparé à une distribution de référence d'étudiants simulés. 
          *En attente des données statiques finales de l'IA.*
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Moyenne Académique (40%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{compositeData.academicScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${compositeData.academicScore}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
          </div>
        </div>

        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Rétention FSRS (40%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{compositeData.fsrsScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${compositeData.fsrsScore}%`, height: '100%', background: 'var(--accent-secondary)', borderRadius: '4px' }}></div>
          </div>
        </div>

        <div className="card glass-panel">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Effort / Workload (20%)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{compositeData.workloadScore}/100</div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${compositeData.workloadScore}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
