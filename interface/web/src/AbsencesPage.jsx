import React, { useState, useMemo } from 'react';
import useStore from './store';
import { useToast } from './ToastProvider';
import { motion } from 'framer-motion';

export default function AbsencesPage() {
  const { config, setConfig } = useStore();
  const { addToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ date: '', matiere: '', type: 'TP', statut: 'Non Justifié', notes: '' });

  const absences = useMemo(() => config?.absences || [], [config]);

  const handleAddAbsence = (e) => {
    e.preventDefault();
    if (!formData.date || !formData.matiere) {
      addToast('Veuillez remplir la date et la matière', 'error');
      return;
    }
    
    const newAbsence = { ...formData, id: Date.now().toString() };
    const newAbsences = [...absences, newAbsence];
    
    setConfig({ ...config, absences: newAbsences });
    setShowModal(false);
    setFormData({ date: '', matiere: '', type: 'TP', statut: 'Non Justifié', notes: '' });
    addToast('Absence enregistrée', 'success');
  };

  const deleteAbsence = (id) => {
    if (window.confirm('Supprimer cette absence de l\'historique ?')) {
      const newAbsences = absences.filter(a => a.id !== id);
      setConfig({ ...config, absences: newAbsences });
      addToast('Absence supprimée', 'info');
    }
  };

  const updateStatus = (id, newStatus) => {
    const newAbsences = absences.map(a => a.id === id ? { ...a, statut: newStatus } : a);
    setConfig({ ...config, absences: newAbsences });
  };

  const calculateDaysLeft = (dateStr) => {
    const absenceDate = new Date(dateStr);
    const today = new Date();
    const diffTime = today - absenceDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return 7 - diffDays;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>📅</span> Gestionnaire d'Absences
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Suivi des justificatifs et règles d'assiduité.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Déclarer une absence
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {absences.length === 0 ? (
          <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p>Aucune absence déclarée pour l'instant.</p>
            <p style={{ fontSize: '0.9rem' }}>Votre assiduité est parfaite.</p>
          </div>
        ) : (
          absences.map(absence => {
            const daysLeft = calculateDaysLeft(absence.date);
            const isLate = daysLeft < 0 && absence.statut === 'Non Justifié';
            const requiresJustif = absence.type === 'TP' || absence.type === 'Langue' || absence.type === 'CM';
            
            return (
              <motion.div 
                key={absence.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card glass-panel" 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderLeft: `4px solid ${absence.statut === 'Justifié' || absence.statut === 'Dispensé' ? 'var(--success)' : (isLate ? 'var(--error)' : 'var(--warning)')}`
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.3rem' }}>
                    {absence.matiere} 
                    <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem' }}>
                      {absence.type}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Date : {new Date(absence.date).toLocaleDateString()}
                  </div>
                  
                  {absence.type === 'TP' && (
                    <div style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      ⚠️ Justificatif obligatoire pour les TPs (risque de sanction MECC).
                    </div>
                  )}
                  {absence.type === 'TD' && (
                    <div style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
                      ✅ Justificatif non requis pour la scolarité (sauf modalités spécifiques).
                    </div>
                  )}
                  {absence.type === 'Langue' && (
                    <div style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      ⚠️ La présence au CRL est stricte. Absence = note 0 si injustifiée.
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <select 
                    value={absence.statut}
                    onChange={(e) => updateStatus(absence.id, e.target.value)}
                    style={{ 
                      padding: '0.5rem', 
                      borderRadius: '6px', 
                      background: 'var(--bg-primary)', 
                      color: absence.statut === 'Justifié' ? 'var(--success)' : 'white',
                      border: '1px solid var(--border-color)',
                      fontWeight: 'bold'
                    }}
                  >
                    <option value="Non Justifié">Non Justifié</option>
                    <option value="En Attente">En Attente de validation</option>
                    <option value="Justifié">✅ Justifié</option>
                    <option value="Dispensé">🎓 Dispensé</option>
                  </select>
                  
                  {absence.statut === 'Non Justifié' && requiresJustif && (
                    <div style={{ fontSize: '0.85rem', color: isLate ? 'var(--error)' : 'var(--warning)', fontWeight: 'bold' }}>
                      {isLate ? 'Délai de 7 jours dépassé !' : `Il vous reste ${daysLeft} jour(s) pour justifier.`}
                    </div>
                  )}
                  
                  <button onClick={() => deleteAbsence(absence.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem', textDecoration: 'underline' }}>
                    Supprimer
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Déclarer une absence</h2>
            <form onSubmit={handleAddAbsence} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Date de l'absence *</label>
                <input 
                  type="date" 
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Matière concernée *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Programmation C, Mécanique..."
                  required
                  value={formData.matiere}
                  onChange={e => setFormData({...formData, matiere: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Type d'enseignement</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)' }}
                >
                  <option value="TP">Travaux Pratiques (TP)</option>
                  <option value="TD">Travaux Dirigés (TD)</option>
                  <option value="CM">Cours Magistral (CM)</option>
                  <option value="Langue">Cours de Langue (CRL)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Notes additionnelles</label>
                <textarea 
                  placeholder="Motif de l'absence (maladie, transport...)"
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'var(--bg-tertiary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
