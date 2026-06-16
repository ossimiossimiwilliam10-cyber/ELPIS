import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { useToast } from './ToastProvider';
import { calculateSM2 } from './sm2';



function EntrainementPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry, config } = useStore();
  const { toast } = useToast();
  const [configLocal, setConfigLocal] = useState(() => {
    if (coursConfig && coursConfig.licences) return JSON.parse(JSON.stringify(coursConfig));
    return { licences: [] };
  });
  const [filterMatiere, setFilterMatiere] = useState('all');

  const DIFFICULTY_LEVELS = [
    { key: 'difficile', label: '🔴', title: 'Difficile' },
    { key: 'assez_difficile', label: '🟠', title: 'Assez difficile' },
    { key: 'moyen', label: '🟡', title: 'Moyen' },
    { key: 'facile', label: '🟢', title: 'Facile' },
    { key: 'tres_facile', label: '🔵', title: 'Très facile' },
  ];

  // Helper : calcul du jour de parité basé sur studyStartDate
  const getParityJour = () => {
    const now = new Date();
    const studyStartRaw = config?.studyStartDate ? config.studyStartDate.split('-').reverse().join('-') : null;
    const studyStart = studyStartRaw ? new Date(studyStartRaw + 'T00:00:00') : new Date(now.getFullYear(), 0, 1);
    const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
    return Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;
  };

  // Resynchroniser le state local quand le parent change
  useEffect(() => {
    if (coursConfig && coursConfig.licences) {
      setConfigLocal(JSON.parse(JSON.stringify(coursConfig)));
    }
  }, [coursConfig]);

  // Tous les exercices du jour (avant filtre)
  const allExercicesDuJour = useMemo(() => {
    let exosToReview = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const parityJour = getParityJour();

    configLocal.licences?.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        let matiereIndexDansSemestre = 0;
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            const activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);
            matiereIndexDansSemestre++;

            
            const extractExos = (listeExos, type) => {
              if (!listeExos) return [];
              return listeExos
                .map((ex, exIndex) => ({
                  ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom, notebookLMLink: m.notebookLMLink
                }))
                .filter(ex => ex.dernierePratique !== todayStr)
                .sort((a, b) => {
                  if (a.nombrePratiques !== b.nombrePratiques) return (a.nombrePratiques || 0) - (b.nombrePratiques || 0);
                  return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
                });
            };

            const tds = extractExos(m.listeTD, 'TD');
            const tps = extractExos(m.listeTP, 'TP');

            const extractCMs = (listeExos) => {
              if (!listeExos) return [];
              return listeExos
                .map((ex, exIndex) => ({
                  ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type: 'CM', matiereNom: m.nom, notebookLMLink: m.notebookLMLink
                }))
              .filter(cm => {
                 if (!cm.derniereRevision) return true;
                 if (cm.jActuel === 0) return cm.derniereRevision !== todayStr;
                 const nextDate = new Date(cm.derniereRevision);
                 nextDate.setDate(nextDate.getDate() + cm.jActuel);
                 return nextDate.toISOString().split('T')[0] <= todayStr;
              });
          };
          const cms = extractCMs(m.listeCM);
          exosToReview.push(...cms);

          if (activePourExercices) {
            // Compter combien ont déjà été faits aujourd'hui (pour respecter le quota de 2 TD / 1 TP par matière)
            const doneTDToday = (m.listeTD || []).filter(ex => ex.dernierePratique === todayStr).length;
            const doneTPToday = (m.listeTP || []).filter(ex => ex.dernierePratique === todayStr).length;

            exosToReview.push(...tds.slice(0, Math.max(0, 2 - doneTDToday)));
            exosToReview.push(...tps.slice(0, Math.max(0, 1 - doneTPToday)));
          }
        });
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
    const parityJour = getParityJour();

    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        let matiereIndexDansSemestre = 0;
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            const activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);
            matiereIndexDansSemestre++;

            if (activePourExercices) {
              if (m.listeTD) total += Math.min(2, m.listeTD.length);
              if (m.listeTP) total += Math.min(1, m.listeTP.length);
            }
          if (m.listeCM) {
             m.listeCM.forEach(cm => {
                if (cm.derniereRevision === todayStr) total++;
                else {
                  if (!cm.derniereRevision) total++;
                  else if (cm.jActuel === 0) {
                     if (cm.derniereRevision !== todayStr) total++;
                  } else {
                     const nextDate = new Date(cm.derniereRevision);
                     nextDate.setDate(nextDate.getDate() + cm.jActuel);
                     if (nextDate.toISOString().split('T')[0] <= todayStr) total++;
                  }
                }
              });
          }
        });
      });
    });
  });
    return total;
  }, [configLocal]);

  const evaluateCM = (exo, score) => {
    const newConf = JSON.parse(JSON.stringify(configLocal));
    const cm = newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];
    
    const { interval, easeFactor, repetitions } = calculateSM2(
      score,
      cm.jActuel || 0,
      cm.easeFactor || 2.5,
      cm.repetitions || 0,
      newConf
    );

    cm.jActuel = interval;
    cm.easeFactor = easeFactor;
    cm.repetitions = repetitions;
    
    const today = new Date().toISOString().split('T')[0];
    cm.derniereRevision = today;
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#ffffff']
    });

    setConfigLocal(newConf);
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: 'CM',
      titre: cm.titre,
      matiere: exo.matiereNom,
      action: `Révisé (J${cm.jActuel})`
    });
  };

  const markAsDone = (exo, difficulte = "") => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newConf = JSON.parse(JSON.stringify(configLocal));
    
    const targetList = exo.type === 'TD' 
        ? newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD 
        : newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;

    targetList[exo.exIndex].dernierePratique = todayStr;
    targetList[exo.exIndex].nombrePratiques = (targetList[exo.exIndex].nombrePratiques || 0) + 1;
    if (difficulte) targetList[exo.exIndex].difficulte = difficulte;
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : ['#FBBF24', '#ffffff']
    });

    setConfigLocal(newConf);
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: exo.type,
      titre: targetList[exo.exIndex].titre,
      matiere: exo.matiereNom,
      action: 'Terminé'
    });
  };

  // Progression : cible du jour - restants = déjà faits
  const progressPercent = totalExercisesToday > 0
    ? Math.round(((totalExercisesToday - allExercicesDuJour.length) / totalExercisesToday) * 100)
    : 0;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  return (
    <div className="entrainement-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem'}}>
        <div style={{display:'flex', alignItems:'center', gap:'1.5rem'}}>
          <h2 style={{margin:0}}>Session du Jour</h2>
          <button 
            className="btn-secondary" 
            style={{padding:'0.4rem 0.8rem', fontSize:'0.85rem', background:'rgba(2, 132, 199, 0.2)', color:'#38bdf8', borderColor:'#0ea5e9'}}
            onClick={async () => {
              try {
                const res = await fetch('/api/open/anki', { method: 'POST' });
                const data = await res.json();
                if (!res.ok || !data.success) {
                  toast.error(data.error || "Échec du lancement d'Anki.");
                } else {
                  toast.success("Anki lancé avec succès !");
                }
              } catch(e) {
                toast.error("Impossible de contacter le serveur.");
              }
            }}
          >
            🗂️ Lancer Anki
          </button>
        </div>
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
                  style={{borderTop:`4px solid ${exo.type==='TD' ? '#34D399' : exo.type==='CM' ? '#3b82f6' : '#FBBF24'}`}}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                    <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                      <span style={{background:'var(--bg-tertiary)', padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.8rem'}}>
                        {exo.matiereNom} ({exo.type})
                      </span>
                      {exo.notebookLMLink && (
                        <button 
                          onClick={() => {
                            let link = exo.notebookLMLink;
                            if (link && !link.startsWith('http')) link = 'https://' + link;
                            window.open(link, '_blank');
                          }}
                          style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}}
                          title="Ouvrir NotebookLM pour cette matière"
                        >
                          📖
                        </button>
                      )}
                    </div>
                    <span style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                      {exo.type === 'CM' ? `Revu ${exo.repetitions || 0} fois (J${exo.jActuel || 0})` : `Pratiqué ${exo.nombrePratiques || 0} fois`}
                    </span>
                  </div>
                  
                  <h3 style={{margin:'0 0 1rem 0', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical'}} title={exo.titre}>{exo.titre}</h3>
                  
                  <div style={{display:'flex', gap:'1rem'}}>
                    {exo.type === 'CM' ? (
                       <>
                         <button onClick={() => evaluateCM(exo, 1)} style={{flex:1, background:'#ef4444', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Échec">À revoir (1)</button>
                         <button onClick={() => evaluateCM(exo, 2)} style={{flex:1, background:'#f97316', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Difficile">Difficile (2)</button>
                         <button onClick={() => evaluateCM(exo, 3)} style={{flex:1, background:'#3b82f6', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Bien">Bien (3)</button>
                         <button onClick={() => evaluateCM(exo, 4)} style={{flex:1, background:'#22c55e', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Parfait">Parfait (4)</button>
                       </>
                    ) : (
                       <>
                         {exo.pdfSource && (
                           <a 
                             href={`${exo.pdfSource}#page=${exo.page}`} 
                             target="_blank" 
                             rel="noreferrer"
                             className="btn-primary"
                             style={{flex:1, textAlign:'center', textDecoration:'none', padding:'0.6rem'}}
                           >
                             Ouvrir Page {exo.page}
                           </a>
                         )}
                         <button 
                           onClick={() => markAsDone(exo)}
                           className="btn-secondary"
                           style={{background:'#10B981', color:'white', border:'none'}}
                         >
                           Fait
                         </button>
                         {DIFFICULTY_LEVELS.map(dl => (
                           <button
                             key={dl.key}
                             onClick={() => markAsDone(exo, dl.key)}
                             title={dl.title}
                             style={{
                               background: 'transparent',
                               border: 'none',
                               cursor: 'pointer',
                               fontSize: '0.7rem',
                               padding: '0.05rem',
                               flexShrink: 0,
                               opacity: 0.7,
                               transition: 'opacity 0.2s',
                             }}
                             onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                             onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                           >
                             {dl.label}
                           </button>
                         ))}
                       </>
                    )}
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
