import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSave = () => {
    setSaving(true);
    fetch('http://localhost:3001/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
            alert("Erreur de sauvegarde: " + data.error + "\n" + (data.details || ""));
        } else {
            alert("Sauvegarde réussie ! Le Cerveau C++ a validé les données.");
        }
      })
      .catch(err => alert("Erreur réseau: " + err.message))
      .finally(() => setSaving(false));
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div style={{color:'white'}}>Chargement du Cerveau...</div>;
  if (error) return <div style={{color:'red'}}>Erreur: {error}</div>;

  return (
    <div>
      <h1>Paramètres du Cerveau</h1>
      
      <div className="panel">
        <h2>Horaires de travail</h2>
        <div className="input-group">
          <label>Heure de lever</label>
          <input 
            type="time" 
            value={config.wakeUpTime || ''} 
            onChange={(e) => handleChange('wakeUpTime', e.target.value)} 
          />
        </div>
        <div className="input-group">
          <label>Heure de coucher</label>
          <input 
            type="time" 
            value={config.bedtime || ''} 
            onChange={(e) => handleChange('bedtime', e.target.value)} 
          />
        </div>
        <div className="input-group">
          <label>Heures d'étude max par jour (limité à 24h en C++)</label>
          <input 
            type="number" 
            value={config.maxStudyHoursPerDay || 0} 
            onChange={(e) => handleChange('maxStudyHoursPerDay', parseInt(e.target.value) || 0)} 
          />
        </div>
      </div>

      <div className="panel">
        <h2>Objectifs & Moteur</h2>
        <div className="input-group">
          <label>Moyenne visée (sur 20)</label>
          <input 
            type="number" 
            step="0.5"
            value={config.targetGrade || 0} 
            onChange={(e) => handleChange('targetGrade', parseFloat(e.target.value) || 0)} 
          />
        </div>
      </div>

      <div className="panel">
        <h2>Matières ({config.subjects?.length || 0})</h2>
        {config.subjects && config.subjects.map((sub, index) => (
          <div key={index} className="subject-item">
            <div style={{display:'flex', alignItems:'center'}}>
                <span className="color-dot" style={{backgroundColor: sub.color}}></span>
                <strong>{sub.name}</strong>
            </div>
            <span style={{color: 'var(--text-secondary)'}}>{sub.examDates?.length || 0} examen(s)</span>
          </div>
        ))}
        {(!config.subjects || config.subjects.length === 0) && <p>Aucune matière configurée.</p>}
      </div>

      <button className="primary" onClick={handleSave} disabled={saving}>
        {saving ? "Sauvegarde en cours..." : "Sauvegarder et Valider"}
      </button>
    </div>
  );
}

export default App;
