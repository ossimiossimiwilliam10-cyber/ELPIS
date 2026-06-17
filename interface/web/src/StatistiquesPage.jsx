import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import useStore from './store';

function StatistiquesPage() {
  const { historique } = useStore();
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
