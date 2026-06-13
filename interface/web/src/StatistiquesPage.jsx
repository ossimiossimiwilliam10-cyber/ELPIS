import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

  return (
    <div className="statistiques-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <h2>Statistiques & Historique</h2>
        <span style={{color:'var(--text-secondary)'}}>{historique.length} tâches terminées au total</span>
      </div>

      <div className="card glass-panel" style={{height: '400px', marginBottom: '2rem'}}>
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
