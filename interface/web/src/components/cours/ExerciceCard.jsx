import { useState } from 'react';
import { motion } from 'framer-motion';
import useStore, { useChronoStore } from '../../store';
import { useToast } from '../../ToastProvider';
import InfoTooltip from '../InfoTooltip';
import { DIFFICULTY_LEVELS } from '../../constants';
import { parseTimeInput } from '../../utils/timeParser';
import useInputModal from '../../hooks/useInputModal';
import InputModal from '../InputModal';
import { getApiUrl } from '../../utils/apiConfig';

function ExerciceCard({ exo, onEvaluateCM, onMarkAsDone, onSuspendCM }) {
  const { globalChrono, startGlobalChrono, toggleGlobalChrono, resetGlobalChrono } = useChronoStore();
  // resetGlobalChrono is also needed for suspend action
  const { toast } = useToast();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();
  const [note, setNote] = useState('');
  const [manualTime, setManualTime] = useState(null);

  const getTPStepName = (etape) => {
    switch(etape) {
      case 1: return "🔍 Étape 1 : Découverte";
      case 2: return "🗺️ Étape 2 : Planification";
      case 3: return "📊 Étape 3 : Vérification";
      case 4: return "🚨 Étape 4 : Révision Finale";
      default: return `Étape ${etape}`;
    }
  };

  const getTPButtonText = (etape) => {
    switch(etape) {
      case 1: return "Valider la Découverte";
      case 2: return "Valider la Planification";
      case 3: return "Valider la Vérification";
      case 4: return "Valider la Révision";
      default: return "Valider le TP";
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8, x: -50, transition: { duration: 0.2 } }
  };

  const exoId = exo.id || exo.titre;
  const isThisExoActive = globalChrono.exoId === exoId;
  const isRunning = isThisExoActive && globalChrono.isRunning;
  const elapsedSeconds = isThisExoActive ? globalChrono.elapsedSeconds : 0;

  const toggleTimer = async () => {
    if (isThisExoActive) {
      toggleGlobalChrono();
    } else {
      setManualTime(null);
      if (exo.type === 'ANKI') {
        try {
          const res = await fetch(`${getApiUrl()}/open/anki`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok || !data.success) {
            toast.error(data.error || "Échec du lancement d'Anki.");
          } else {
            toast.success("Anki lancé avec succès !");
          }
        } catch {
          toast.error("Impossible de lancer Anki (serveur injoignable).");
        }
      }
      startGlobalChrono(exo);
    }
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleValidation = async (callback, ...args) => {
    if (isThisExoActive) {
      resetGlobalChrono();
    }

    let finalMinutes = manualTime !== null
      ? manualTime
      : (elapsedSeconds > 0 ? Math.max(1, Math.ceil(elapsedSeconds / 60)) : 0);

    if (finalMinutes === 0 && exo.type === 'ANKI') {
      const input = await prompt(
        `Temps passé sur Anki (en minutes) ? Laissez vide pour utiliser le temps moyen (${Math.round(exo.tempsMoyen || 30)} min).`,
        ""
      );
      if (input !== null && input.trim() !== "") {
        const parsed = parseTimeInput(input);
        if (parsed !== null) {
          finalMinutes = parsed;
        }
      }
    }

    callback(exo, ...args, finalMinutes);
    setManualTime(null);
  };

  const handleOpenUrl = (url) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      layout
      className="card glass-panel"
      style={{borderTop:`4px solid ${exo.type==='TD' ? '#34D399' : exo.type==='CM' ? '#3b82f6' : exo.type==='ANNALE' ? '#ef4444' : '#FBBF24'}`, position: 'relative'}}
    >
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
          <span style={{background:'var(--bg-tertiary)', padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.8rem'}}>
            {exo.matiereNom} ({exo.type})
          </span>
          {exo.raisons && exo.raisons.map((r, i) => {
            const reasonDict = {
              "REPRISE_EN_MAIN": { text: "🛡️ Reprise en main", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
              "URGENCE_NOTE": { text: "🚨 Urgence (Note < 5)", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
              "EXAMEN_PROCHE": { text: "⏳ Examen Proche", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
              "COEF_ELEVE": { text: "🔥 Coefficient Élevé", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
              "EXAMEN_IMMINENT": { text: "🚨 Examen Imminent", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
              "DEFI_PRECOCE": { text: "🚀 Défi Précoce", color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
              "MAITRISE_ATTEINTE": { text: "🏆 Maîtrise Atteinte", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
              "PREPA_TD": { text: "🔗 Pour préparer le TD", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
              "ESPACEE_GLOBALE": { text: "🧠 Répétition Espacée Globale", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
              "ESPACEE_GLOBALE_BONUS": { text: "🧠 Répétition Espacée Globale (Bonus)", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" }
            };
            const mapped = reasonDict[r] || { text: r, color: "var(--text-secondary)", bg: "var(--bg-tertiary)" };
            return (
              <span key={i} style={{background: mapped.bg, color: mapped.color, padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'500'}}>
                {mapped.text}
              </span>
            );
          })}
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
          {exo.type === 'CM' ? (
            <span>
              Revu {exo.repetitions || 0} fois <InfoTooltip content="L'algorithme FSRS calcule ce délai (en jours) en fonction de ta note de difficulté. Plus tu réussis, plus l'intervalle augmente.">(J{exo.jActuel || 0}) <span style={{fontSize:'0.8rem'}}>ℹ️</span></InfoTooltip>
            </span>
          ) :
           exo.type === 'TP' && exo.etape ? getTPStepName(exo.etape) :
           `Pratiqué ${exo.nombrePratiques || 0} fois`}
        </span>
      </div>

      <h3 style={{margin:'0 0 1rem 0', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical'}} title={exo.titre}>{exo.titre}</h3>

      {/* Timer Section */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px', marginBottom: '1rem'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <button
            onClick={toggleTimer}
            style={{
              background: isRunning ? '#ef4444' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title={isRunning ? "Mettre en pause" : "Démarrer le chrono"}
          >
            {isRunning ? '⏸' : '▶'}
          </button>
          <span
            style={{fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 'bold', color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)', minWidth: '50px'}}
          >
            {formatTime(elapsedSeconds)}
          </span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
          <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>ou</span>
          <input
            type="number"
            min="0"
            max="999"
            placeholder={exo.tempsMoyen ? `${Math.round(exo.tempsMoyen)}` : "min"}
            value={manualTime !== null ? manualTime : ''}
            onChange={e => {
              const val = e.target.value;
              if (val === '') {
                setManualTime(null);
              } else {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 0) setManualTime(parsed);
              }
            }}
            style={{
              width: '52px',
              background: 'var(--bg-primary)',
              color: manualTime !== null ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: manualTime !== null ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: '1rem',
              padding: '0.3rem 0.2rem',
              transition: 'border-color 0.2s'
            }}
            title="Entrez le temps manuellement (en minutes)"
          />
          <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>min</span>
        </div>
      </div>

      <div style={{display:'flex', gap:'0.5rem', flexDirection: 'column'}}>
        {(() => {
          const allPdfs = [...(exo.pdfPaths || [])];
          if (exo.pdfPath && !allPdfs.includes(exo.pdfPath)) {
            allPdfs.unshift(exo.pdfPath);
          }

          if (allPdfs.length === 0) return null;

          if (allPdfs.length === 1) {
            return (
              <button
                onClick={() => handleOpenUrl(allPdfs[0])}
                className="btn-secondary"
                style={{background:'var(--bg-tertiary)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.1)', padding:'0.6rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginBottom:'0.5rem'}}
              >
                📄 Ouvrir le document
              </button>
            );
          }

          return (
            <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.5rem'}}>
              {allPdfs.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenUrl(url)}
                  className="btn-secondary"
                  style={{flex: '1 1 calc(50% - 0.5rem)', background:'var(--bg-tertiary)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.1)', padding:'0.4rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', fontSize:'0.85rem'}}
                >
                  📄 Doc {idx + 1}
                </button>
              ))}
            </div>
          );
        })()}
        <div style={{display:'flex', gap:'0.5rem'}}>
          {exo.type === 'CM' ? (
             <>
               <button onClick={() => handleValidation(onEvaluateCM, 1)} style={{flex:1, background:'#ef4444', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Échec">À revoir (1)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 2)} style={{flex:1, background:'#f97316', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Difficile">Difficile (2)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 3)} style={{flex:1, background:'#3b82f6', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Bien">Bien (3)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 4)} style={{flex:1, background:'#22c55e', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Parfait">Parfait (4)</button>
               {onSuspendCM && (
                 <button
                   onClick={() => {
                     let finalMinutes = manualTime !== null
                       ? manualTime
                       : (elapsedSeconds > 0 ? Math.max(1, Math.ceil(elapsedSeconds / 60)) : 0);
                     if (isThisExoActive) {
                       resetGlobalChrono();
                     }
                     onSuspendCM(exo, finalMinutes);
                     setManualTime(null);
                   }}
                   style={{
                     flex: 4,
                     background: 'rgba(245, 158, 11, 0.15)',
                     color: '#f59e0b',
                     border: '1px solid rgba(245, 158, 11, 0.4)',
                     borderRadius: '6px',
                     padding: '0.6rem',
                     cursor: 'pointer',
                     fontWeight: 'bold',
                     transition: 'all 0.2s',
                     marginTop: '0.3rem',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '0.4rem'
                   }}
                   title="Clôturer la séance sans terminer le CM — il reviendra demain"
                   onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'; }}
                   onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
                 >
                   ⏸️ Suspendre la séance (à continuer demain)
                 </button>
               )}
             </>
          ) : exo.type === 'ANNALE' ? (
             <div style={{display:'flex', width:'100%', gap:'0.5rem', alignItems: 'center'}}>
               <input
                 type="number"
                 min="0"
                 max="20"
                 step="0.5"
                 placeholder="Note /20"
                 value={note}
                 onChange={e => setNote(e.target.value)}
                 style={{flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'var(--bg-primary)', color: 'white', fontSize: '1rem'}}
               />
               <button
                 onClick={() => {
                   if(note !== '') handleValidation(onMarkAsDone, note);
                 }}
                 className="btn-secondary"
                 style={{background:'#ef4444', color:'white', border:'none', flex: 1, opacity: note === '' ? 0.5 : 1, cursor: note === '' ? 'not-allowed' : 'pointer'}}
                 disabled={note === ''}
               >
                 Valider la note
               </button>
             </div>
          ) : (
           <div style={{display:'flex', width:'100%', gap:'0.5rem'}}>
             <button
               onClick={() => handleValidation(onMarkAsDone, "")}
               className="btn-secondary"
               style={{background:'#10B981', color:'white', border:'none', flex: 2}}
             >
               {exo.type === 'TP' && exo.etape ? getTPButtonText(exo.etape) : "Fait"}
             </button>
             <div style={{display:'flex', flexWrap:'wrap', gap:'2px', justifyContent:'center', alignItems:'center'}}>
               {DIFFICULTY_LEVELS?.map(dl => (
                 <button
                   key={dl.key}
                   onClick={() => handleValidation(onMarkAsDone, dl.key)}
                   title={dl.title}
                   style={{
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     fontSize: '0.8rem',
                     padding: '0.2rem',
                     opacity: 0.7,
                     transition: 'opacity 0.2s',
                   }}
                   onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                   onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                 >
                   {dl.label}
                 </button>
               ))}
             </div>
           </div>
          )}
        </div>
      </div>
      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </motion.div>
  );
}

export default ExerciceCard;
