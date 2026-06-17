import { useState, useMemo } from 'react';
// motion is not used
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import useStore from './store';

function StatistiquesPage() {
  const { historique, coursConfig } = useStore();
  const [period, setPeriod] = useState(30); // 7, 30, 365 (pour tout voir)

  const filteredHist = useMemo(() => {
    if (period === 365) return historique;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return historique.filter(h => new Date(h.timestamp) >= cutoff);
  }, [historique, period]);

  const data = useMemo(() => {
    const res = [];
    const today = new Date();
    const daysToGenerate = period === 365 ? 90 : period; // Limiter le BarChart à 90j max
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayHist = historique.filter(h => h.timestamp && h.timestamp.startsWith(dateStr));
      
      let cmTime = 0;
      let tdTime = 0;
      let tpTime = 0;
      let annaleTime = 0;

      dayHist.forEach(h => {
        const t = h.dureeMinutes || 30; // 30 min fallback pour l'ancien historique
        if (h.type === 'CM') cmTime += t;
        else if (h.type === 'TD') tdTime += t;
        else if (h.type === 'TP') tpTime += t;
        else if (h.type === 'ANNALE') annaleTime += t;
      });

      res.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        CM: Math.round(cmTime),
        TD: Math.round(tdTime),
        TP: Math.round(tpTime),
        ANNALE: Math.round(annaleTime),
      });
    }
    return res;
  }, [historique, period]);

  const pieData = useMemo(() => {
    const times = {};
    filteredHist.forEach(h => {
      if (h.matiere) {
        times[h.matiere] = (times[h.matiere] || 0) + (h.dureeMinutes || 30);
      }
    });
    return Object.entries(times)
      .map(([name, value]) => ({ name, value: Math.round(value / 60) })) // en heures
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Garder le top 5
  }, [filteredHist]);

  const predictiveModel = useMemo(() => {
    if (!coursConfig || !historique) return null;
    
    const matieresStats = {};

    // 1. Calcul de B (Rétention Théorique via CM)
    historique.forEach(h => {
      if (!matieresStats[h.matiere]) {
        matieresStats[h.matiere] = { cmCount: 0, cmEaseTotal: 0, pratiques: [] };
      }
      if (h.type === 'CM' && h.easeFactor) {
        matieresStats[h.matiere].cmCount++;
        matieresStats[h.matiere].cmEaseTotal += h.easeFactor;
      }
    });

    // 2. Calcul de A (Difficulté Pratique) via coursConfig
    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (!matieresStats[m.nom]) matieresStats[m.nom] = { cmCount: 0, cmEaseTotal: 0, pratiques: [] };
            
            const addPratiques = (liste, defaultDiff) => {
              if (!liste) return;
              liste.forEach(ex => {
                if (ex.nombrePratiques > 0) {
                  matieresStats[m.nom].pratiques.push(ex.difficulteInitiale || defaultDiff);
                }
              });
            };
            addPratiques(m.listeTD, 1);
            addPratiques(m.listeTP, 1);
            addPratiques(m.listeAnnales, 3);
          });
        });
      });
    });

    // 3. Calcul de la note estimée G(A,B) par matière
    const estimations = [];
    Object.entries(matieresStats).forEach(([nom, stats]) => {

      let B = 0.5;
      if (stats.cmCount > 0) {
        const avgEF = stats.cmEaseTotal / stats.cmCount;
        B = Math.max(0, Math.min(1, (avgEF - 1.3) / (2.5 - 1.3))); 
      }

      let A = 1.5;
      if (stats.pratiques.length > 0) {
         A = stats.pratiques.reduce((sum, val) => sum + val, 0) / stats.pratiques.length;
      }

      const B_m = Math.max(0.3, B); // Plancher pour éviter 0
      let G = 20 * Math.pow(A / 5, 0.85) * Math.pow(B_m, 1.2);
      G = Math.min(20, Math.max(0, G)); 

      let P;
      if (G >= 10) {
        P = 0.70 / (1 + Math.pow((G - 10) / 1.7816, 2.3914));
      } else {
        P = 1.0 - (0.03 * G);
      }
      P = Math.max(0.01, P * 100); 

      estimations.push({ matiere: nom, note: G, percentile: P });
    });

    if (estimations.length === 0) return null;

    const avgNote = estimations.reduce((s, e) => s + e.note, 0) / estimations.length;
    // La moyenne des percentiles n'est pas parfaite mathématiquement mais indicative
    let avgPercentile;
    if (avgNote >= 10) {
      avgPercentile = (0.70 / (1 + Math.pow((avgNote - 10) / 1.7816, 2.3914))) * 100;
    } else {
      avgPercentile = (1.0 - (0.03 * avgNote)) * 100;
    }

    return {
      global: { note: avgNote, percentile: avgPercentile },
      matieres: estimations.sort((a,b) => b.note - a.note)
    };
  }, [historique, coursConfig]);

  const COLORS_PIE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#ec4899'];

  const kpis = useMemo(() => {
    let totalMinutes = 0;
    let totalEase = 0;
    let countCM = 0;

    filteredHist.forEach(h => {
      totalMinutes += (h.dureeMinutes || 30);
      if (h.type === 'CM' && h.easeFactor) {
        totalEase += h.easeFactor;
        countCM++;
      }
    });

    const totalHours = (totalMinutes / 60).toFixed(1);
    
    const avgPerDayMins = totalMinutes / (period === 365 ? (historique.length > 0 ? 90 : 1) : period);
    const avgPerDayHours = Math.floor(avgPerDayMins / 60);
    const avgPerDayRemMins = Math.round(avgPerDayMins % 60);
    const avgPerDayStr = `${avgPerDayHours}h${avgPerDayRemMins.toString().padStart(2, '0')}`;

    const avgEase = countCM > 0 ? (totalEase / countCM).toFixed(2) : 'N/A';
    const topMatiere = pieData.length > 0 ? pieData[0].name : 'N/A';

    return { totalHours, avgPerDayStr, topMatiere, avgEase };
  }, [filteredHist, pieData, period, historique.length]);

  const formatTooltip = (value) => {
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
    return `${m} min`;
  };

  return (
    <div className="statistiques-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem'}}>
        <h2>Statistiques & Performances</h2>
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          <select 
            value={period} 
            onChange={e => setPeriod(Number(e.target.value))}
            style={{padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--bg-tertiary)'}}
          >
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={365}>Tout l'historique</option>
          </select>

          <button 
            className="btn-secondary" 
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," 
                + "Date,Matiere,Titre,Type,Duree_Minutes,Ease_Factor\n" 
                + historique.map(h => `${h.timestamp},"${h.matiere || ''}","${h.titre || ''}","${h.type || ''}",${h.dureeMinutes || 30},${h.easeFactor || ''}`).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "elpis_historique.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            title="Exporter l'historique au format CSV"
            style={{padding: '0.4rem 0.8rem', fontSize: '0.85rem'}}
          >
            Exporter CSV
          </button>
        </div>
      </div>

      {/* NEW: Diagnostic Académique L2 SPI */}
      {predictiveModel && (
        <div className="card glass-panel" style={{marginBottom: '2rem', borderLeft: '4px solid var(--accent-primary)', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(59, 130, 246, 0.05))'}}>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap'}}>
            <div style={{flex: '1 1 250px'}}>
              <h3 style={{marginBottom: '1rem', color: 'var(--accent-primary)'}}>🎓 Diagnostic Académique (Estimation)</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem'}}>
                Modèle prédictif croisant votre rétention (SM-2) et la difficulté des exercices accomplis, calibré sur les données de réussite en L2 SPI.
              </p>
              
              <div style={{display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap'}}>
                <div style={{background: 'rgba(0,0,0,0.3)', padding: '1rem 1.5rem', borderRadius: '12px', textAlign: 'center'}}>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Moyenne Générale Estimée</div>
                  <div style={{fontSize: '2.5rem', fontWeight: 'bold', color: predictiveModel.global.note >= 16 ? '#a78bfa' : predictiveModel.global.note >= 14 ? 'var(--success-color)' : predictiveModel.global.note >= 10 ? 'var(--warning-color)' : 'var(--danger-color)'}}>
                    {predictiveModel.global.note.toFixed(1)} <span style={{fontSize: '1.2rem', color: 'var(--text-secondary)'}}>/20</span>
                  </div>
                  <div style={{fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.2rem', color: 'var(--text-primary)'}}>
                    {predictiveModel.global.note >= 16 ? 'Mention Très Bien' : predictiveModel.global.note >= 14 ? 'Mention Bien' : predictiveModel.global.note >= 12 ? 'Mention Assez Bien' : predictiveModel.global.note >= 10 ? 'Passable' : 'Échec / À travailler'}
                  </div>
                </div>

                <div style={{background: 'rgba(0,0,0,0.3)', padding: '1rem 1.5rem', borderRadius: '12px', textAlign: 'center'}}>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Classement National Estimé</div>
                  <div style={{fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b'}}>
                    Top {predictiveModel.global.percentile < 1 ? predictiveModel.global.percentile.toFixed(2) : predictiveModel.global.percentile.toFixed(1)}%
                  </div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem'}}>
                    {predictiveModel.global.percentile <= 5 ? "Excellence académique" : predictiveModel.global.percentile <= 20 ? "Dossier très solide" : predictiveModel.global.percentile <= 50 ? "Dans la moyenne post-écrémage" : "Moitié inférieure"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px'}}>
              <h4 style={{marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Détail par Matière</h4>
              <div className="custom-scrollbar-y" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.5rem'}}>
                {predictiveModel.matieres.map((m, i) => (
                  <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px'}}>
                    <span style={{fontSize: '0.9rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{m.matiere}</span>
                    <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                      <span style={{fontWeight: 'bold', color: m.note >= 14 ? 'var(--success-color)' : m.note >= 10 ? 'var(--text-primary)' : 'var(--danger-color)'}}>{m.note.toFixed(1)}/20</span>
                      <span style={{fontSize: '0.8rem', color: '#f59e0b', width: '60px', textAlign: 'right'}}>Top {m.percentile.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}}>
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Temps Étudié (Période)</h4>
          <span style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)'}}>{kpis.totalHours}h</span>
        </div>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}}>
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Moyenne Quotidienne</h4>
          <span style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)'}}>{kpis.avgPerDayStr}</span>
        </div>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}}>
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Matière Phare (Temps)</h4>
          <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--warning-color)', display: 'block', marginTop: '0.5rem'}}>{kpis.topMatiere}</span>
        </div>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}} title="Facteur de facilité moyen des CM (plus il est proche de 2.5+, meilleure est la rétention).">
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Ease Factor (SM-2)</h4>
          <span style={{fontSize: '2rem', fontWeight: 'bold', color: '#a78bfa'}}>{kpis.avgEase}</span>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem'}}>
        {/* Activity Stacked Bar Chart */}
        <div className="card glass-panel" style={{height: '350px'}}>
        <h3 style={{marginBottom: '1rem'}}>Temps de travail par exercice</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatTooltip} />
            <Tooltip 
              contentStyle={{backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '8px', color: 'var(--text-primary)'}}
              formatter={formatTooltip}
            />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="CM" stackId="a" fill="#3b82f6" name="CM" />
            <Bar dataKey="TD" stackId="a" fill="#34d399" name="TD" />
            <Bar dataKey="TP" stackId="a" fill="#fbbf24" name="TP" />
            <Bar dataKey="ANNALE" stackId="a" fill="#ef4444" name="Annales" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>

        {/* Subjects Pie Chart */}
        <div className="card glass-panel" style={{height: '350px'}}>
          <h3 style={{marginBottom: '1rem'}}>Répartition par Matière (Heures)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '8px', color: 'var(--text-primary)'}}
                formatter={(value) => `${value}h`}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="card glass-panel">
        <h3 style={{marginBottom: '1rem'}}>Dernières actions</h3>
        {filteredHist.length === 0 ? (
          <p style={{color:'var(--text-secondary)'}}>Aucun historique sur cette période.</p>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
            {[...filteredHist].reverse().slice(0, 15).map((h, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'0.8rem', background:'rgba(255,255,255,0.02)', borderRadius:'8px', flexWrap:'wrap', gap:'1rem', borderLeft: `4px solid ${h.type==='CM'?'#3b82f6':h.type==='TD'?'#34d399':h.type==='TP'?'#fbbf24':'#ef4444'}`}}>
                <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                  <span style={{color:'var(--text-secondary)', width:'40px', fontSize:'0.9rem'}}>{h.dureeMinutes || 30} min</span>
                  <span>{h.titre}</span>
                  <span style={{color:'var(--text-secondary)', fontSize:'0.9rem'}}>({h.matiere})</span>
                </div>
                <div style={{color:'var(--text-secondary)', fontSize:'0.9rem'}}>
                  {h.timestamp ? new Date(h.timestamp).toLocaleString('fr-FR', {day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'}) : 'Date inconnue'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatistiquesPage;
