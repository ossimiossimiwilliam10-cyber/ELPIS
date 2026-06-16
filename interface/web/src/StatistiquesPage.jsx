import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import useStore from './store';

function StatistiquesPage() {
  const { historique } = useStore();

  const data = useMemo(() => {
    // Generate last 30 days data
    const res = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const count = historique.filter(h => h.timestamp && h.timestamp.startsWith(dateStr)).length;
      res.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        taches: count
      });
    }
    return res;
  }, [historique]);

  const pieData = useMemo(() => {
    const counts = {};
    historique.forEach(h => {
      if (h.matiere) {
        counts[h.matiere] = (counts[h.matiere] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Garder le top 5 pour la lisibilité
  }, [historique]);

  const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f43f5e'];

  const kpis = useMemo(() => {
    const total = historique.length;
    const avgPerDay = data.length > 0 ? (total / 30).toFixed(1) : 0;
    const topMatiere = pieData.length > 0 ? pieData[0].name : 'N/A';
    return { total, avgPerDay, topMatiere };
  }, [historique, data, pieData]);

  return (
    <div className="statistiques-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <h2>Statistiques & Historique</h2>
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          <span style={{color:'var(--text-secondary)'}}>{historique.length} tâches terminées au total</span>
          <button 
            className="btn-secondary" 
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," 
                + "Date,Matiere,Titre,Type\n" 
                + historique.map(h => `${h.timestamp},"${h.matiere || ''}","${h.titre || ''}","${h.type || ''}"`).join("\n");
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
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Total Tâches</h4>
          <span style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)'}}>{kpis.total}</span>
        </div>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}}>
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Moyenne / Jour (30j)</h4>
          <span style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)'}}>{kpis.avgPerDay}</span>
        </div>
        <div className="card glass-panel" style={{textAlign: 'center', padding: '1.5rem'}}>
          <h4 style={{color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem'}}>Matière la plus étudiée</h4>
          <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--warning-color)', display: 'block', marginTop: '0.5rem'}}>{kpis.topMatiere}</span>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem'}}>
        {/* Activity Bar Chart */}
        <div className="card glass-panel" style={{height: '350px'}}>
        <h3 style={{marginBottom: '1rem'}}>Activité des 30 derniers jours</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip 
              contentStyle={{backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '8px'}}
              itemStyle={{color: 'var(--accent-primary)'}}
            />
            <Bar dataKey="taches" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>

        {/* Subjects Pie Chart */}
        <div className="card glass-panel" style={{height: '350px'}}>
          <h3 style={{marginBottom: '1rem'}}>Répartition (Top 5 Matières)</h3>
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '8px'}}
                itemStyle={{color: 'white'}}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="card glass-panel">
        <h3 style={{marginBottom: '1rem'}}>Dernières actions</h3>
        {historique.length === 0 ? (
          <p style={{color:'var(--text-secondary)'}}>Aucun historique disponible.</p>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
            {[...historique].reverse().slice(0, 10).map((h, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'0.8rem', background:'rgba(255,255,255,0.02)', borderRadius:'8px', flexWrap:'wrap', gap:'1rem'}}>
                <div>
                  <span style={{color:'var(--accent-primary)', fontWeight:'bold', marginRight:'0.5rem'}}>[{h.type}]</span>
                  <span>{h.titre}</span>
                  <span style={{color:'var(--text-secondary)', fontSize:'0.9rem', marginLeft:'0.5rem'}}>({h.matiere})</span>
                </div>
                <div style={{color:'var(--text-secondary)', fontSize:'0.9rem'}}>
                  {h.timestamp ? new Date(h.timestamp).toLocaleString('fr-FR') : 'Date inconnue'}
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
