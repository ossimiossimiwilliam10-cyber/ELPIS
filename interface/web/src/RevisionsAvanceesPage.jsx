import { useState, useMemo } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore from './store';
import { useToast } from './ToastProvider';
import { evaluateFSRS, migrateToFSRSCard, Rating } from './fsrsEngine';
import ExerciceCard from './components/cours/ExerciceCard';

export default function RevisionsAvanceesPage() {
  const { coursConfig, setCoursConfig, addHistoriqueEntry, config, intelligence, pendingTasksCount } = useStore();
  const { toast } = useToast();
  const [matiereSelectionnee, setMatiereSelectionnee] = useState('');
  
  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // Extraire tous les exercices disponibles de toutes les licences/semestres/ues
  const tousExercices = useMemo(() => {
    if (!coursConfig || !coursConfig.licences) return [];
    let exos = [];
    coursConfig.licences.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            const extractAndAdd = (listeExos, type) => {
              if (!listeExos) return;
              listeExos.forEach((ex, exIndex) => {
                exos.push({
                  ...ex, lIndex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom, notebookLMLink: m.notebookLMLink
                });
              });
            };
            extractAndAdd(m.listeTD, 'TD');
            extractAndAdd(m.listeTP, 'TP');
            extractAndAdd(m.listeCM, 'CM');
            extractAndAdd(m.listeAnnales, 'ANNALE');
          });
        });
      });
    });
    return exos;
  }, [coursConfig]);

  // Liste unique des matières pour le menu déroulant
  const matiereNames = useMemo(() => {
    const names = new Set();
    tousExercices.forEach(ex => names.add(ex.matiereNom));
    return Array.from(names).sort();
  }, [tousExercices]);

  // Si la matière sélectionnée n'est pas valide, on prend la première disponible
  const currentMatiere = matiereSelectionnee || (matiereNames.length > 0 ? matiereNames[0] : '');

  // Filtrer les exercices de la matière sélectionnée et trier pour avoir le plus "urgent" / le plus ancien non fait
  const exerciceCourant = useMemo(() => {
    if (!currentMatiere) return null;
    
    const todayStr = getTodayStr();
    
    const exosDeLaMatiere = tousExercices.filter(ex => ex.matiereNom === currentMatiere);
    
    // On exclut ceux déjà faits aujourd'hui pour être sûr d'avancer
    const exosDisponibles = exosDeLaMatiere.filter(exo => {
      if (exo.type === 'CM') return exo.derniereRevision !== todayStr;
      return exo.dernierePratique !== todayStr;
    });

    if (exosDisponibles.length === 0) return null;

    // On trie pour prioriser les CM avec une date de révision passée, puis par ordre d'apparition
    exosDisponibles.sort((a, b) => {
      // Priorité aux dates (derniereRevision/dernierePratique null = en premier)
      const dateA = a.type === 'CM' ? a.derniereRevision : a.dernierePratique;
      const dateB = b.type === 'CM' ? b.derniereRevision : b.dernierePratique;
      if (!dateA && dateB) return -1;
      if (dateA && !dateB) return 1;
      if (dateA && dateB) {
        return dateA.localeCompare(dateB);
      }
      return 0;
    });

    return exosDisponibles[0]; // Une seule tâche à la fois
  }, [tousExercices, currentMatiere]);

  const handleNextExo = () => {
     // Si l'utilisateur clique sur "Passer", on pourrait potentiellement marquer l'exo comme ignoré temporairement
     toast("Passé à un autre exercice (bientôt disponible)", "info");
  };

  const evaluateCM = (exo, score, elapsedMinutes = 0) => {
    let finalJActuel = 0;
    let finalEaseFactor = 2.5;

    const newConf = produce(coursConfig, draft => {
      const cm = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeCM[exo.exIndex];
      let finalScore = score;
      
      if (elapsedMinutes > 0 && cm.tempsMoyen > 0 && (cm.nombreRevisionsTemps || 0) >= 1) {
        const ratio = elapsedMinutes / cm.tempsMoyen;
        if (ratio > 1.5 && finalScore > 1) finalScore -= 1;
        if (ratio > 2.0 && finalScore > 1) finalScore -= 1;
        if (ratio < 0.5 && finalScore < 4) finalScore += 1;
      }

      let personalizedDecayMultiplier = 1.0;
      if (intelligence?.velocityMap && exo.matiereNom) {
         const vData = intelligence.velocityMap[exo.matiereNom];
         if (vData && vData.isSlowLearner) personalizedDecayMultiplier = 0.8;
         else if (vData && vData.avgSessionsToMaster && vData.avgSessionsToMaster <= 2) personalizedDecayMultiplier = 1.2;
      }

      let fsrsCard = cm.fsrsCard ? { ...cm.fsrsCard } : migrateToFSRSCard(cm);
      if (typeof fsrsCard.due === 'string') fsrsCard.due = new Date(fsrsCard.due);
      if (typeof fsrsCard.last_review === 'string') fsrsCard.last_review = new Date(fsrsCard.last_review);

      const ratingMap = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
      const fsrsRating = ratingMap[finalScore] || Rating.Good;
      const newCard = evaluateFSRS(fsrsCard, fsrsRating, personalizedDecayMultiplier);

      cm.fsrsCard = newCard;
      cm.jActuel = newCard.scheduled_days || 1;
      cm.easeFactor = (10 - newCard.difficulty) / 4 + 1.3;
      cm.repetitions = newCard.reps;
      cm.prochaineRevisionDate = newCard.due instanceof Date ? newCard.due.toISOString().split('T')[0] : new Date(newCard.due).toISOString().split('T')[0];
      
      const today = getTodayStr();
      cm.derniereRevision = today;
      
      let effectiveMinutes = elapsedMinutes;
      if (effectiveMinutes <= 0) {
        effectiveMinutes = (cm.jActuel === 0) ? (config?.defaultDurationNewCM || 120) : (config?.defaultDurationRevCM || 30);
      }
      
      const currentAvg = cm.tempsMoyen || 0;
      const currentCount = cm.nombreRevisionsTemps || 0;
      cm.tempsMoyen = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
      cm.nombreRevisionsTemps = currentCount + 1;

      finalJActuel = cm.jActuel;
      finalEaseFactor = cm.easeFactor;
    });

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3b82f6', '#ffffff'] });
    setCoursConfig(newConf);
    addHistoriqueEntry({
      type: 'CM',
      titre: exo.titre,
      matiere: exo.matiereNom,
      action: `Révisé en avance (J${finalJActuel})`,
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : (config?.defaultDurationRevCM || 30),
      easeFactor: finalEaseFactor
    });
    toast("Exercice validé ! Un nouveau est prêt.", "success");
  };

  const markAsDone = (exo, difficulte = "", elapsedMinutes = 0) => {
    const todayStr = getTodayStr();
    let actionLabel = 'Terminé en avance';

    const newConfig = produce(coursConfig, draft => {
      let targetList;
      if (exo.type === 'TD') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD;
      else if (exo.type === 'TP') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;
      else if (exo.type === 'ANNALE') targetList = draft.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeAnnales;

      const currentExo = targetList[exo.exIndex];
      currentExo.dernierePratique = todayStr;
      currentExo.nombrePratiques = (currentExo.nombrePratiques || 0) + 1;
      
      if (exo.type === 'ANNALE' && difficulte !== "") {
        const note = parseFloat(difficulte);
        if (!isNaN(note)) {
          currentExo.derniereNote = note;
          actionLabel = `Terminé en avance (Note: ${note}/20)`;
          if (note >= 18) currentExo.difficulte = 'tres_facile';
          else if (note >= 15) currentExo.difficulte = 'facile';
          else if (note >= 11) currentExo.difficulte = 'moyen';
          else if (note >= 9) currentExo.difficulte = 'assez_difficile';
          else currentExo.difficulte = 'difficile';
        }
      } else if (difficulte) {
        currentExo.difficulte = difficulte;
      }
      
      let effectiveMinutes = elapsedMinutes;
      if (effectiveMinutes <= 0) {
        if (exo.type === 'TD') effectiveMinutes = config?.defaultDurationTD || 20;
        else if (exo.type === 'TP') {
          const stepIndex = (currentExo.nombrePratiques || 1) - 1;
          const TP_STEP_DURATIONS = [
            config?.defaultDurationTP_Etape1 || 45, 
            config?.defaultDurationTP_Etape2 || 180, 
            config?.defaultDurationTP_Etape3 || 90, 
            config?.defaultDurationTP_Etape4 || 30
          ];
          effectiveMinutes = TP_STEP_DURATIONS[stepIndex] || 30;
        }
        else if (exo.type === 'ANNALE') effectiveMinutes = config?.defaultDurationAnnales || 60;
      }
      
      if (exo.type === 'TP') {
        const stepIndex = (currentExo.nombrePratiques || 1) - 1;
        if (!currentExo.tempsMoyenEtapes) currentExo.tempsMoyenEtapes = [];
        while(currentExo.tempsMoyenEtapes.length <= stepIndex) currentExo.tempsMoyenEtapes.push(null);
        if (!currentExo.nombreRevisionsEtapes) currentExo.nombreRevisionsEtapes = [];
        while(currentExo.nombreRevisionsEtapes.length <= stepIndex) currentExo.nombreRevisionsEtapes.push(0);
        
        const currentAvg = currentExo.tempsMoyenEtapes[stepIndex] || 0;
        const currentCount = currentExo.nombreRevisionsEtapes[stepIndex] || 0;
        currentExo.tempsMoyenEtapes[stepIndex] = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
        currentExo.nombreRevisionsEtapes[stepIndex] = currentCount + 1;
      } else {
        const currentAvg = currentExo.tempsMoyen || 0;
        const currentCount = currentExo.nombreRevisionsTemps || 0;
        currentExo.tempsMoyen = ((currentAvg * currentCount) + effectiveMinutes) / (currentCount + 1);
        currentExo.nombreRevisionsTemps = currentCount + 1;
      }
    });
    
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: exo.type === 'TD' ? ['#34D399', '#ffffff'] : exo.type === 'TP' ? ['#FBBF24', '#ffffff'] : ['#ef4444', '#ffffff'] });
    setCoursConfig(newConfig);

    let fallbackDuration = 30;
    if (exo.type === 'TD') fallbackDuration = config?.defaultDurationTD || 20;
    else if (exo.type === 'TP') fallbackDuration = config?.defaultDurationTP || 30;
    else if (exo.type === 'ANNALE') fallbackDuration = config?.defaultDurationAnnales || 60;

    const updatedExo = newConfig.licences[exo.lIndex].semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex][
      exo.type === 'TD' ? 'listeTD' : exo.type === 'TP' ? 'listeTP' : 'listeAnnales'
    ][exo.exIndex];

    addHistoriqueEntry({
      type: exo.type,
      titre: updatedExo.titre,
      matiere: exo.matiereNom,
      action: actionLabel,
      dureeMinutes: elapsedMinutes > 0 ? elapsedMinutes : fallbackDuration
    });
    toast("Exercice validé ! Un nouveau est prêt.", "success");
  };

  if (pendingTasksCount > 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem', paddingTop: '4rem', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card glass-panel"
          style={{ padding: '3rem', border: '1px solid var(--accent-primary)' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Section Verrouillée</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Tu as encore <strong>{pendingTasksCount} tâche{pendingTasksCount > 1 ? 's' : ''}</strong> à terminer dans ta Session du Jour.
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            L'algorithme requiert que tu atteignes ta cible quotidienne avant de pouvoir t'avancer sur d'autres matières.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>🚀 Avance & Bonus</h1>
      </div>

      <div className="card glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Choix de la matière</h3>
        <select 
          value={currentMatiere} 
          onChange={(e) => setMatiereSelectionnee(e.target.value)}
          style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', fontSize: '1rem', cursor: 'pointer' }}
        >
          {matiereNames.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Sélectionne la matière sur laquelle tu veux t'avancer. L'algorithme te proposera automatiquement la prochaine tâche la plus pertinente.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {exerciceCourant ? (
          <motion.div
            key={`${exerciceCourant.matiereNom}-${exerciceCourant.titre}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              Une seule tâche affichée pour rester focus. 🎯
            </div>
            <ExerciceCard 
              exo={exerciceCourant}
              matiereNom={exerciceCourant.matiereNom}
              notebookLMLink={exerciceCourant.notebookLMLink}
              onMarkAsDone={(passedExo, difficulte, elapsedMinutes) => markAsDone(passedExo, difficulte, elapsedMinutes)}
              onEvaluateCM={(passedExo, score, elapsedMinutes) => evaluateCM(passedExo, score, elapsedMinutes)}
            />
            {/* Optionnel: Bouton Passer */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
               <button 
                 onClick={handleNextExo}
                 style={{ background: 'transparent', border: '1px dashed var(--text-secondary)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', opacity: 0.7 }}
                 title="Bientôt disponible"
               >
                 Passer à un autre exercice (Prochainement)
               </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card glass-panel"
            style={{ textAlign: 'center', padding: '3rem' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
            <h3 style={{ color: 'var(--success-color)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Plus rien à faire !</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Tu as terminé absolument tous les exercices disponibles pour cette matière.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
