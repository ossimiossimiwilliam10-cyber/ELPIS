import { useState } from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store';

function ExerciceCard({ exo, onEvaluateCM, onMarkAsDone, DIFFICULTY_LEVELS, itemVariants }) {
  const { globalChrono, startGlobalChrono, toggleGlobalChrono, resetGlobalChrono } = useStore();
  
  const exoId = exo.id || exo.titre;
  const isThisExoActive = globalChrono.exoId === exoId;
  const isRunning = isThisExoActive && globalChrono.isRunning;
  const elapsedSeconds = isThisExoActive ? globalChrono.elapsedSeconds : 0;

  const toggleTimer = () => {
    if (isThisExoActive) {
      toggleGlobalChrono();
    } else {
      startGlobalChrono(exo);
    }
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleValidation = (callback, ...args) => {
    if (isThisExoActive) {
      resetGlobalChrono();
    }
    // Convert elapsed seconds to minutes, rounding up to nearest minute. Minimum 1 minute if started.
    const elapsedMinutes = elapsedSeconds > 0 ? Math.max(1, Math.ceil(elapsedSeconds / 60)) : 0;
    callback(exo, ...args, elapsedMinutes);
  };

  const handleOpenPdf = async () => {
    if (!exo.pdfPath) return;
    
    // Si l'URL est relative (commence par /documents/), on utilise le chemin relatif.
    let url = exo.pdfPath;
    
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
              cursor: 'pointer'
            }}
            title={isRunning ? "Mettre en pause" : "Démarrer le chrono"}
          >
            {isRunning ? '⏸' : '▶'}
          </button>
          <span style={{fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)'}}>
            {formatTime(elapsedSeconds)}
          </span>
        </div>
        {exo.tempsMoyen && (
          <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
            Moy. {Math.round(exo.tempsMoyen)} min
          </span>
        )}
      </div>

      <div style={{display:'flex', gap:'0.5rem', flexDirection: 'column'}}>
        {exo.pdfPath && (
          <button 
            onClick={handleOpenPdf}
            className="btn-secondary"
            style={{background:'var(--bg-tertiary)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.1)', padding:'0.6rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginBottom:'0.5rem'}}
          >
            📄 Ouvrir le document
          </button>
        )}
        <div style={{display:'flex', gap:'0.5rem'}}>
          {exo.type === 'CM' ? (
             <>
               <button onClick={() => handleValidation(onEvaluateCM, 1)} style={{flex:1, background:'#ef4444', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Échec">À revoir (1)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 2)} style={{flex:1, background:'#f97316', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Difficile">Difficile (2)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 3)} style={{flex:1, background:'#3b82f6', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Bien">Bien (3)</button>
               <button onClick={() => handleValidation(onEvaluateCM, 4)} style={{flex:1, background:'#22c55e', color:'white', border:'none', borderRadius:'6px', padding:'0.6rem'}} title="Parfait">Parfait (4)</button>
             </>
          ) : (
           <div style={{display:'flex', width:'100%', gap:'0.5rem'}}>
             <button 
               onClick={() => handleValidation(onMarkAsDone, "")}
               className="btn-secondary"
               style={{background:'#10B981', color:'white', border:'none', flex: 2}}
             >
               Fait
             </button>
             <div style={{display:'flex', flexWrap:'wrap', gap:'2px', justifyContent:'center', alignItems:'center'}}>
               {DIFFICULTY_LEVELS.map(dl => (
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
    </motion.div>
  );
}

export default ExerciceCard;
