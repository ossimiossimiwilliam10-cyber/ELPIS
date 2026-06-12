import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

function EntrainementPage({ coursConfig, onSave, saving }) {
  const [configLocal, setConfigLocal] = useState(coursConfig || { semestres: [] });

  // Resynchroniser le state local quand le parent change (ex: import backup)
  useEffect(() => {
    if (coursConfig) {
      setConfigLocal(JSON.parse(JSON.stringify(coursConfig)));
    }
  }, [coursConfig]);

  // Récupération des exercices du jour
  const exercicesDuJour = useMemo(() => {
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
              // Exclure ceux déjà faits aujourd'hui
              .filter(ex => ex.dernierePratique !== todayStr)
              // Trier par nombre de pratiques (les moins pratiqués en premier)
              // puis par date de dernière pratique
              .sort((a, b) => {
                if (a.nombrePratiques !== b.nombrePratiques) return (a.nombrePratiques || 0) - (b.nombrePratiques || 0);
                return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
              });
          };

          const tds = extractExos(m.listeTD, 'TD');
          const tps = extractExos(m.listeTP, 'TP');

          // Prendre max 2 TD et 1 TP par matière par jour
          exosToReview.push(...tds.slice(0, 2));
          exosToReview.push(...tps.slice(0, 1));
        });
      });
    });

    return exosToReview;
  }, [configLocal]);

  const markAsDone = (exo) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newConf = { ...configLocal };
    
    const targetList = exo.type === 'TD' 
        ? newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD 
        : newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;

    targetList[exo.exIndex].dernierePratique = todayStr;
    targetList[exo.exIndex].nombrePratiques = (targetList[exo.exIndex].nombrePratiques || 0) + 1;
    
    // Confetti !
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : ['#FBBF24', '#ffffff']
    });

    setConfigLocal(newConf);
    onSave(newConf);
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  return (
    <div className="entrainement-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <h2>🏋️ Entraînement Quotidien</h2>
        <span style={{color:'var(--text-secondary)'}}>{exercicesDuJour.length} exercices prévus aujourd'hui.</span>
      </div>

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
            <h3>🎉 Tout est à jour !</h3>
            <p style={{color:'var(--text-secondary)'}}>Tu as complété tous tes exercices du jour ou aucun PDF n'a été scanné.</p>
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
                  
                  <h3 style={{margin:'0 0 1rem 0'}}>{exo.titre}</h3>
                  
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
                      ✓ Fait
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
