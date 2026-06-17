import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { useToast } from './ToastProvider';
import { calculateSM2 } from './sm2';
import ExerciceCard from './components/cours/ExerciceCard';



function EntrainementPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry, config, startGlobalChrono, globalChrono, resetGlobalChrono } = useStore();
  const { toast } = useToast();

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const [configLocal, setConfigLocal] = useState(() => {
    if (coursConfig && coursConfig.licences) return JSON.parse(JSON.stringify(coursConfig));
    return { licences: [] };
  });
  const [filterMatiere, setFilterMatiere] = useState('all');
  const [topSubjects, setTopSubjects] = useState(null);
  const [tachesOrchestrateur, setTachesOrchestrateur] = useState(null);

  useEffect(() => {
    fetch('/api/orchestrateur')
      .then(res => res.json())
      .then(data => {
        if (data && data.tachesDuJour) {
          setTachesOrchestrateur(data.tachesDuJour);
          const subjects = new Set();
          data.tachesDuJour.forEach(t => subjects.add(t.matiere));
          setTopSubjects(Array.from(subjects));
        }
      })
      .catch(err => console.error(err));
  }, [coursConfig]);

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

  // Filtered exercises directly matching the orchestrator
  const strategicExercices = useMemo(() => {
    if (!tachesOrchestrateur) return [];
    
    let exosToReview = [];
    configLocal.licences?.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            const extractAndFilter = (listeExos, type) => {
               if (!listeExos) return;
               listeExos.forEach((ex, exIndex) => {
                 const isInOrchestrator = tachesOrchestrateur.some(t => 
                   t.matiere === m.nom && t.type === type && t.titre === ex.titre
                 );
                 if (isInOrchestrator) {
                   exosToReview.push({
                     ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom, notebookLMLink: m.notebookLMLink
                   });
                 }
               });
            };
            extractAndFilter(m.listeTD, 'TD');
            extractAndFilter(m.listeTP, 'TP');
            extractAndFilter(m.listeCM, 'CM');
            extractAndFilter(m.listeAnnales, 'ANNALE');
          });
        });
      });
    });
    return exosToReview;
  }, [configLocal, tachesOrchestrateur]);

  // Get unique matiere names for filter pills
  const matiereNames = useMemo(() => {
    const names = new Set();
    strategicExercices.forEach(ex => names.add(ex.matiereNom));
    return Array.from(names);
  }, [strategicExercices]);

  // Filtered exercises
  const exercicesDuJour = useMemo(() => {
    if (filterMatiere === 'all') return strategicExercices;
    return strategicExercices.filter(ex => ex.matiereNom === filterMatiere);
  }, [strategicExercices, filterMatiere]);

  // Count total (including already completed today)
  const totalExercisesToday = useMemo(() => {
    let completedToday = 0;
    const d = new Date();
    d.setHours(d.getHours() - 4);
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.listeTD) completedToday += m.listeTD.filter(td => td.dernierePratique === todayStr).length;
            if (m.listeTP) completedToday += m.listeTP.filter(tp => tp.dernierePratique === todayStr).length;
            if (m.listeAnnales) completedToday += m.listeAnnales.filter(a => a.dernierePratique === todayStr).length;
            if (m.listeCM) completedToday += m.listeCM.filter(cm => cm.derniereRevision === todayStr).length;
          });
        });
      });
    });
    return completedToday + (tachesOrchestrateur ? tachesOrchestrateur.length : 0);
  }, [configLocal, tachesOrchestrateur]);

  const evaluateCM = (exo, score, elapsedMinutes = 0) => {
    const newConf = JSON.parse(JSON.stringify(configLocal));
    const d = new Date();
    d.setHours(d.getHours() - 4);
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const cm = newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];
    
    let finalScore = score;
    
    // --- PÉNALITÉ / BONUS TEMPOREL ---
    // Si l'utilisateur a passé beaucoup plus de temps que sa moyenne historique,
    // on dégrade le score pour forcer une révision plus précoce.
    if (elapsedMinutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
      const ratio = elapsedMinutes / cm.tempsMoyen;
      
      if (ratio > 1.5 && finalScore > 1) finalScore -= 1; // +50% de temps = -1 point
      if (ratio > 2.0 && finalScore > 1) finalScore -= 1; // +100% de temps = encore -1 point
      
      if (ratio < 0.5 && finalScore < 4) finalScore += 1; // 2x plus rapide = +1 point
    }

    let actualDaysElapsed = -1;
    if (cm.derniereRevision) {
      const todayStrLocal = getTodayStr();
      const revDate = new Date(cm.derniereRevision + 'T00:00:00');
      const nowDate = new Date(todayStrLocal + 'T00:00:00');
      actualDaysElapsed = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));
    }

    const { interval, easeFactor, repetitions, prochaineRevisionDate } = calculateSM2(
      finalScore,
      cm.jActuel || 0,
      cm.easeFactor || 2.5,
      cm.repetitions || 0,
      newConf,
      actualDaysElapsed
    );

    cm.jActuel = interval;
    cm.easeFactor = easeFactor;
    cm.repetitions = repetitions;
    cm.prochaineRevisionDate = prochaineRevisionDate;
    
    const today = getTodayStr();
    cm.derniereRevision = today;
    
    // Update tempsMoyen if a timer was used
    if (elapsedMinutes > 0) {
      const currentAvg = cm.tempsMoyen || 0;
      const currentCount = cm.nombreRevisionsTemps || 0;
      cm.tempsMoyen = ((currentAvg * currentCount) + elapsedMinutes) / (currentCount + 1);
      cm.nombreRevisionsTemps = currentCount + 1;
    }
    
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
      action: `Révisé (J${cm.jActuel})`,
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : (configLocal?.defaultDurationRevCM || 30),
      easeFactor: easeFactor
    });
  };

  const markAsDone = (exo, difficulte = "", elapsedMinutes = 0) => {
    const todayStr = getTodayStr();
    const newConf = JSON.parse(JSON.stringify(configLocal));
    
    let targetList;
    if (exo.type === 'TD') targetList = newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD;
    else if (exo.type === 'TP') targetList = newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;
    else if (exo.type === 'ANNALE') targetList = newConf.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeAnnales;

    const currentExo = targetList[exo.exIndex];
    currentExo.dernierePratique = todayStr;
    currentExo.nombrePratiques = (currentExo.nombrePratiques || 0) + 1;
    if (difficulte) currentExo.difficulte = difficulte;
    
    if (elapsedMinutes > 0) {
      const currentAvg = currentExo.tempsMoyen || 0;
      const currentCount = currentExo.nombreRevisionsTemps || 0;
      currentExo.tempsMoyen = ((currentAvg * currentCount) + elapsedMinutes) / (currentCount + 1);
      currentExo.nombreRevisionsTemps = currentCount + 1;
    }
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : exo.type === 'TP' ? ['#FBBF24', '#ffffff'] : ['#ef4444', '#ffffff']
    });

    setConfigLocal(newConf);
    setCoursConfig(newConf);
    let fallbackDuration = 30;
    if (exo.type === 'TD') fallbackDuration = configLocal?.defaultDurationTD || 20;
    else if (exo.type === 'TP') fallbackDuration = configLocal?.defaultDurationTP || 30;
    else if (exo.type === 'ANNALE') fallbackDuration = configLocal?.defaultDurationAnnales || 60;

    addHistoriqueEntry({
      type: exo.type,
      titre: currentExo.titre,
      matiere: exo.matiereNom,
      action: 'Terminé',
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : fallbackDuration
    });
  };

  // Progression : cible du jour - restants = déjà faits
  const progressPercent = totalExercisesToday > 0
    ? Math.round(((totalExercisesToday - strategicExercices.length) / totalExercisesToday) * 100)
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
          {globalChrono.exoId === 'anki' ? (
            <button 
              className="btn-secondary" 
              style={{padding:'0.4rem 0.8rem', fontSize:'0.85rem', background:'rgba(16, 185, 129, 0.2)', color:'#10b981', borderColor:'#059669'}}
              onClick={() => {
                const elapsedMinutes = Math.round(globalChrono.elapsedSeconds / 60);
                addHistoriqueEntry({
                  type: 'ANKI',
                  titre: 'Session Anki',
                  matiere: 'Révisions globales',
                  action: 'Terminé',
                  dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : 1
                });
                resetGlobalChrono();
                toast.success(`Session Anki de ${elapsedMinutes > 0 ? elapsedMinutes : 1} min enregistrée !`);
              }}
            >
              ✅ Terminer Anki
            </button>
          ) : (
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
                    startGlobalChrono({ id: 'anki', titre: 'Session Anki', matiereNom: 'Révisions globales' });
                  }
                } catch(e) {
                  toast.error("Impossible de contacter le serveur.");
                }
              }}
            >
              🗂️ Lancer Anki
            </button>
          )}
        </div>
        <span style={{color:'var(--text-secondary)'}}>{exercicesDuJour.length} exercice{exercicesDuJour.length > 1 ? 's' : ''} restant{exercicesDuJour.length > 1 ? 's' : ''}</span>
      </div>

      {/* === PROGRESS BAR === */}
      <div className="progress-header">
        <span className="progress-header-text" style={{color: progressPercent === 100 ? 'var(--success-color)' : 'var(--text-primary)'}}>
          {progressPercent === 100 ? 'Bravo !' : `${strategicExercices.length} restant${strategicExercices.length > 1 ? 's' : ''}`}
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
            Tout ({strategicExercices.length})
          </button>
          {matiereNames.map(name => {
            const count = strategicExercices.filter(e => e.matiereNom === name).length;
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
            {strategicExercices.length === 0 ? (
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
                <ExerciceCard 
                  key={exo.matiereNom + exo.titre + exo.type}
                  exo={exo}
                  onEvaluateCM={evaluateCM}
                  onMarkAsDone={markAsDone}
                  DIFFICULTY_LEVELS={DIFFICULTY_LEVELS}
                  itemVariants={itemVariants}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EntrainementPage;
