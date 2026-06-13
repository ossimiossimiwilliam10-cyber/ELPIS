import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';

function EntrainementPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry } = useStore();
  const [configLocal, setConfigLocal] = useState(coursConfig || { semestres: [] });
  const [filterMatiere, setFilterMatiere] = useState('all');
  const [completedToday, setCompletedToday] = useState(0);

  // Resynchroniser le state local quand le parent change
  useEffect(() => {
    if (coursConfig) {
      setConfigLocal(JSON.parse(JSON.stringify(coursConfig)));
    }
  }, [coursConfig]);

  // Tous les exercices du jour (avant filtre)
  const allExercicesDuJour = useMemo(() => {
    let exosToReview = [];
    const todayStr = new Date().toISOString().split('T')[0];

    configLocal.semestres.forEach((s, sIndex) => {
      s.ues.forEach((u, uIndex) => {
        u.matieres.forEach((m, mIndex) => {
          
          const extractExos = (listeExos, type) => {
            if (!listeExos) return [];
            return listeExos
              .map((ex, exIndex) => ({
                ...ex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom
              }))
              .filter(ex => ex.dernierePratique !== todayStr)
              .sort((a, b) => {
                if (a.nombrePratiques !== b.nombrePratiques) return (a.nombrePratiques || 0) - (b.nombrePratiques || 0);
                return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
              });
          };

          const tds = extractExos(m.listeTD, 'TD');
          const tps = extractExos(m.listeTP, 'TP');

          exosToReview.push(...tds.slice(0, 2));
          exosToReview.push(...tps.slice(0, 1));
        });
      });
    });

    return exosToReview;
  }, [configLocal]);

  // Get unique matiere names for filter pills
  const matiereNames = useMemo(() => {
    const names = new Set();
    allExercicesDuJour.forEach(ex => names.add(ex.matiereNom));
    return Array.from(names);
  }, [allExercicesDuJour]);

  // Filtered exercises
  const exercicesDuJour = useMemo(() => {
    if (filterMatiere === 'all') return allExercicesDuJour;
    return allExercicesDuJour.filter(ex => ex.matiereNom === filterMatiere);
  }, [allExercicesDuJour, filterMatiere]);

  // Count total (including already completed today)
  const totalExercisesToday = useMemo(() => {
    let total = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    configLocal.semestres.forEach(s => {
      s.ues.forEach(u => {
        u.matieres.forEach(m => {
          if (m.listeTD) total += Math.min(2, m.listeTD.length);
          if (m.listeTP) total += Math.min(1, m.listeTP.length);
        });
      });
    });
    return total;
  }, [configLocal]);

  const markAsDone = (exo) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newConf = JSON.parse(JSON.stringify(configLocal));
    
    const targetList = exo.type === 'TD' 
        ? newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD 
        : newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;

    targetList[exo.exIndex].dernierePratique = todayStr;
    targetList[exo.exIndex].nombrePratiques = (targetList[exo.exIndex].nombrePratiques || 0) + 1;
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : ['#FBBF24', '#ffffff']
    });

    setCompletedToday(prev => prev + 1);
    setConfigLocal(newConf);
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: exo.type,
      titre: targetList[exo.exIndex].titre,
      matiere: exo.matiereNom,
      action: 'Terminé'
    });
  };

  const doneCount = totalExercisesToday - allExercicesDuJour.length + completedToday;
  const progressPercent = totalExercisesToday > 0 ? Math.round(((doneCount) / totalExercisesToday) * 100) : 0;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  return (
    <div className="entrainement-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
        <h2>Entraînement Quotidien</h2>
        <span style={{color:'var(--text-secondary)'}}>{exercicesDuJour.length} exercice{exercicesDuJour.length > 1 ? 's' : ''} restant{exercicesDuJour.length > 1 ? 's' : ''}</span>
      </div>

      {/* === PROGRESS BAR === */}
      <div className="progress-header">
        <span className="progress-header-text" style={{color: progressPercent === 100 ? 'var(--success-color)' : 'var(--text-primary)'}}>
          {progressPercent === 100 ? 'Bravo !' : `${allExercicesDuJour.length} restant${allExercicesDuJour.length > 1 ? 's' : ''}`}
        </span>
        <div className="progress-header-bar">
          <div className="progress-bar-container" style={{height: '8px', margin: 0}}>
            <motion.div 
              className="progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: progressPercent === 100 ? 'var(--success-color)' : 'var(--accent-primary)' }}
            />
          </div>
        </div>
        <span className="progress-header-text" style={{color: 'var(--accent-primary)'}}>
          {progressPercent}%
        </span>
      </div>

      {/* === FILTER PILLS === */}
      {matiereNames.length > 1 && (
        <div className="filter-pills">
          <button 
            className={`filter-pill ${filterMatiere === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMatiere('all')}
          >
            Tout ({allExercicesDuJour.length})
          </button>
          {matiereNames.map(name => {
            const count = allExercicesDuJour.filter(e => e.matiereNom === name).length;
            return (
              <button 
                key={name}
                className={`filter-pill ${filterMatiere === name ? 'active' : ''}`}
                onClick={() => setFilterMatiere(name)}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {exercicesDuJour.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card glass-panel" 
            style={{textAlign:'center', padding:'3rem'}}
          >
            {allExercicesDuJour.length === 0 ? (
              <>
                <div style={{fontSize: '4rem', marginBottom: '1rem'}}>🎉</div>
                <h3 style={{color: 'var(--success-color)'}}>Tout est fait pour aujourd'hui !</h3>
                <p style={{color:'var(--text-secondary)', maxWidth: '400px', margin: '0.5rem auto 0'}}>
                  Tu as complété tous tes exercices du jour. Profite de ton temps libre, ou avance sur tes CM dans l'onglet "Mes Cours".
                </p>
              </>
            ) : (
              <>
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔍</div>
                <h3>Aucun exercice pour "{filterMatiere}"</h3>
                <p style={{color:'var(--text-secondary)'}}>
                  Essaie un autre filtre ou clique sur "Tout" pour voir tous les exercices.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="grid"
            style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1.5rem'}}
          >
            <AnimatePresence>
              {exercicesDuJour.map((exo) => (
                <motion.div 
                  key={exo.matiereNom + exo.titre + exo.type} 
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  layout
                  className="card glass-panel" 
                  style={{borderTop:`4px solid ${exo.type==='TD' ? '#34D399' : '#FBBF24'}`}}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                    <span style={{background:'var(--bg-tertiary)', padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.8rem'}}>
                      {exo.matiereNom} ({exo.type})
                    </span>
                    <span style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                      Pratiqué {exo.nombrePratiques || 0} fois
                    </span>
                  </div>
                  
                  <h3 style={{margin:'0 0 1rem 0', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical'}} title={exo.titre}>{exo.titre}</h3>
                  
                  <div style={{display:'flex', gap:'1rem'}}>
                    <a 
                      href={`http://localhost:3001${exo.pdfSource}#page=${exo.page}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn-primary"
                      style={{flex:1, textAlign:'center', textDecoration:'none', padding:'0.6rem'}}
                    >
                      Ouvrir Page {exo.page}
                    </a>
                    
                    <button 
                      onClick={() => markAsDone(exo)}
                      className="btn-secondary"
                      disabled={saving}
                      style={{background:'#10B981', color:'white', border:'none'}}
                    >
                      Fait
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EntrainementPage;
