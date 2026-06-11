import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

function Dashboard({ coursConfig, onSaveCours }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = () => {
    fetch('http://localhost:3001/api/orchestrateur')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, [coursConfig]); // Se rafraîchit si le config change !

  const handleTaskComplete = (tache) => {
    if (!coursConfig) return;
    const newConfig = JSON.parse(JSON.stringify(coursConfig)); // Deep copy
    const today = new Date().toISOString().split('T')[0];

    let taskFound = false;
    newConfig.semestres.forEach(semestre => {
      semestre.ues.forEach(ue => {
        ue.matieres.forEach(matiere => {
          if (matiere.nom === tache.matiere) {
            if (tache.type === 'CM') {
              matiere.listeCM.forEach(cm => {
                if (cm.titre === tache.titre) {
                  cm.derniereRevision = today;
                  cm.jActuel = (cm.jActuel || 0) + 1;
                  taskFound = true;
                }
              });
            } else if (tache.type === 'TD') {
              matiere.listeTD.forEach(td => {
                if (td.titre === tache.titre) {
                  td.dernierePratique = today;
                  td.nombrePratiques = (td.nombrePratiques || 0) + 1;
                  taskFound = true;
                }
              });
            } else if (tache.type === 'TP') {
              matiere.listeTP.forEach(tp => {
                if (tp.titre === tache.titre) {
                  tp.dernierePratique = today;
                  tp.nombrePratiques = (tp.nombrePratiques || 0) + 1;
                  taskFound = true;
                }
              });
            }
          }
        });
      });
    });

    if (taskFound) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#818CF8', '#34D399', '#FBBF24']
      });
      onSaveCours(newConfig);
    }
  };

  if (loading) {
    return (
      <div style={{textAlign:'center', marginTop:'5rem'}}>
        Analyse cérébrale en cours...
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card glass-panel" 
        style={{textAlign:'center', marginTop:'3rem'}}
      >
        <h2>Bienvenue sur ELPIS</h2>
        <p style={{color:'var(--text-secondary)'}}>Configure tes objectifs et tes cours pour activer l'Orchestrateur.</p>
      </motion.div>
    );
  }

  const { statut, tempsDispoMin, tempsRequisMin, tachesDuJour } = data;
  const surcharge = statut === "SURCHARGE";
  
  const pourcentageCharge = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <motion.div 
      className="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <div>
          <h1>Tableau de Bord</h1>
          <p style={{color:'var(--text-secondary)', marginTop:'-1.5rem', fontSize:'1.1rem'}}>Vue d'ensemble de ton énergie et de tes objectifs.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Panneau Énergie */}
        <motion.div 
          className="card glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h2 style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
            ⚡ Charge du Jour
            <span className={`status-badge ${surcharge ? 'status-surcharge' : 'status-ok'}`}>
              {surcharge ? 'SURCHARGE' : 'OK'}
            </span>
          </h2>
          
          <div style={{marginTop:'2rem', marginBottom:'1rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
              <span style={{color:'var(--text-secondary)'}}>Temps Requis : <strong>{Math.round(tempsRequisMin/60 * 10)/10}h</strong></span>
              <span style={{color:'var(--text-secondary)'}}>Temps Libre : <strong>{Math.round(tempsDispoMin/60 * 10)/10}h</strong></span>
            </div>
            <div className="progress-bar-container">
              <motion.div 
                className="progress-bar-fill" 
                initial={{ width: 0 }}
                animate={{ width: `${pourcentageCharge}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  backgroundColor: surcharge ? 'var(--danger-color)' : 'var(--success-color)'
                }}
              />
            </div>
          </div>
          
          {surcharge ? (
            <div style={{background:'rgba(239, 68, 68, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--danger-color)'}}>
              <strong>⚠️ Alerte Burnout :</strong> Tu as prévu trop de choses aujourd'hui par rapport à tes objectifs de sommeil et de travail. Pense à reporter certaines tâches !
            </div>
          ) : (
            <div style={{background:'rgba(16, 185, 129, 0.1)', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid var(--success-color)'}}>
              <strong>✅ Équilibre parfait :</strong> Ta charge de travail est totalement compatible avec tes objectifs de santé.
            </div>
          )}
        </motion.div>

        {/* Panneau To-Do List du Cerveau */}
        <motion.div 
          className="card glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2>🎯 Objectifs Générés</h2>
          
          {tachesDuJour.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', marginTop: '2rem', padding: '2rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}
            >
              <h3 style={{color:'var(--success-color)', marginBottom: '0.5rem'}}>🎉 Tout est terminé !</h3>
              <p style={{color:'var(--text-secondary)'}}>Tu as accompli toutes tes tâches pour aujourd'hui. Repose-toi bien !</p>
            </motion.div>
          ) : (
            <motion.div 
              className="todo-list"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              style={{display:'flex', flexDirection:'column', gap:'0.8rem', marginTop:'1.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem'}}
            >
              <AnimatePresence>
                {tachesDuJour.map((t, i) => (
                  <motion.div 
                    key={t.matiere + t.titre + i}
                    variants={itemVariants}
                    exit={{ opacity: 0, x: 50, scale: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'rgba(255,255,255,0.03)', padding:'0.8rem 1rem', borderRadius:'8px',
                      borderLeft: t.type === 'CM' ? '3px solid #818CF8' : t.type === 'TD' ? '3px solid #34D399' : '3px solid #FBBF24',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div>
                      <div style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>{t.matiere}</div>
                      <div style={{fontWeight:'bold'}}>{t.type} : {t.titre}</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                      <div style={{background:'var(--bg-tertiary)', padding:'0.3rem 0.6rem', borderRadius:'6px', fontSize:'0.85rem'}}>
                        ~{t.dureeMinutes || t.dureeMin} min
                      </div>
                      <button 
                        onClick={() => handleTaskComplete(t)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: 'var(--success-color)',
                          border: 'none',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.4)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                      >
                        Fait ✅
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Dashboard;
