import React from 'react';
import EditableLabel from './EditableLabel';
import EditableNote from './EditableNote';

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const StarRating = ({ value, onChange, tooltip }) => {
  return (
    <div style={{display:'flex', gap:'2px'}} title={tooltip || "Difficulté (1 à 5 étoiles)"}>
      {[1, 2, 3, 4, 5].map(v => (
        <span 
          key={v} 
          onClick={() => onChange(v)} 
          style={{cursor:'pointer', color: v <= (value || 1) ? '#fbbf24' : 'rgba(255,255,255,0.2)', fontSize:'0.9rem'}}
        >
          ★
        </span>
      ))}
    </div>
  );
};

export default function MatiereCard({ 
  matiere, 
  lIndex, sIndex, uIndex, mIndex, 
  actions
}) {
  const {
    deleteMatiere,
    updateField,
    addCM,
    deleteCM,
    addTDManuel,
    deleteTD,
    addTPManuel,
    deleteTP,
    setModalConfig,
    getNextReviewDate,
    setConfigLocal,
    setCoursConfig
  } = actions;

  const handleUploadClick = (pathArray) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Veuillez sélectionner un fichier PDF.');
        return;
      }
      
      const formData = new FormData();
      formData.append('pdf', file);
      
      try {
        const res = await fetch('http://localhost:3001/api/upload/pdf', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          updateField(pathArray, data.url);
        } else {
          alert("Erreur lors de l'upload: " + data.error);
        }
      } catch (err) {
        console.error(err);
        alert("Erreur réseau lors de l'upload.");
      }
    };
    input.click();
  };

  return (
    <div style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)', minWidth: 0}}>
      {/* MATIERE HEADER */}
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', minWidth: 0}}>
        <button onClick={() => deleteMatiere(lIndex, sIndex, uIndex, mIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}} title="Supprimer">🗑️</button>
        <EditableLabel
          value={matiere.nom}
          onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'nom'], v)}
          placeholder="Nom de la matière"
          style={{flex:1, borderBottom:'1px solid var(--bg-tertiary)', paddingBottom:'0.3rem'}}
        />
      </div>
      
      {/* CONFIG NOTEBOOK LM */}
      <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1rem', background:'rgba(0,0,0,0.2)', padding:'0.5rem', borderRadius:'6px'}}>
        <div style={{display:'flex', gap:'0.5rem', alignItems: 'center'}}>
          <span style={{fontSize:'1rem'}} title="Lien NotebookLM">📖</span>
          <input 
            type="text" 
            placeholder="Collez ici le lien NotebookLM pour cette matière..." 
            value={matiere.notebookLMLink || ''}
            onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'notebookLMLink'], e.target.value)}
            style={{flex:1, padding:'0.4rem', fontSize:'0.8rem', background:'var(--bg-secondary)', border:'1px solid var(--bg-tertiary)', borderRadius:'4px', color:'var(--text-primary)'}}
          />
        </div>
      </div>
      
      {/* --- CM --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>{matiere.listeCM?.length || 0} CM</span>
        <button className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem'}} onClick={() => addCM(lIndex, sIndex, uIndex, mIndex)}>+ CM</button>
      </div>
      {matiere.listeCM?.map((cm, cmIndex) => (
        <div key={`cm-${cmIndex}`} className="cm-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.4rem', borderRadius:'4px'}}>
          <button onClick={() => deleteCM(lIndex, sIndex, uIndex, mIndex, cmIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
          <button 
            onClick={() => {
              if (cm.pdfPath && window.confirm("Remplacer le document existant ?")) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'pdfPath']);
              } else if (!cm.pdfPath) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'pdfPath']);
              }
            }}
            style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: cm.pdfPath ? 1 : 0.4, padding:0}}
            title={cm.pdfPath ? `Document lié. Cliquez pour remplacer.` : "Importer un document (PDF)"}
          >
            📄
          </button>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
            <EditableLabel
              value={cm.titre}
              onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'titre'], v)}
              placeholder="Titre du CM"
              style={{fontSize:'0.85rem'}}
            />
            <EditableNote 
              value={cm.notes} 
              onClick={() => setModalConfig({
                isOpen: true,
                title: `Notes CM : ${cm.titre}`,
                initialValue: cm.notes,
                onSave: (v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'notes'], v)
              })} 
              placeholder="+ Ajouter une note (markdown supporté)" 
            />
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
            <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>
              Revu <b>{cm.repetitions || 0}</b> fois · Prochain : <b>{getNextReviewDate(cm)}</b>
            </span>
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.7rem', color:'var(--text-secondary)'}}>
              <span title="Intervalle (jours)">Intervalle</span>
              <input 
                type="number"
                min="0"
                value={cm.jActuel || 0}
                onChange={(e) => {
                  const newJ = parseInt(e.target.value) || 0;
                  setConfigLocal(prev => {
                    const newConf = deepClone(prev);
                    const currentCM = newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex];
                    currentCM.jActuel = newJ;
                    if (newJ > 0 && (!currentCM.derniereRevision || currentCM.derniereRevision === "")) {
                      currentCM.derniereRevision = new Date().toISOString().split('T')[0];
                    }
                    setCoursConfig(newConf);
                    return newConf;
                  });
                }}
                style={{padding:'0.15rem 0.3rem', borderRadius:'4px', background:'var(--bg-tertiary)', color:'white', border:'1px solid var(--accent-primary)', fontSize:'0.7rem', width:'50px', textAlign:'center'}}
                title="Intervalle en jours avant la prochaine révision"
              />
              <span title="Facteur de facilité (SM-2)">EF: {cm.easeFactor != null ? cm.easeFactor.toFixed(1) : '2.5'}</span>
            </div>
          </div>
        </div>
      ))}

      {/* --- TD --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--success-color)'}}>{matiere.listeTD?.length || 0} TD</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => addTDManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>+ Manuel</button>
        </div>
      </div>
      {matiere.listeTD?.map((td, tdIndex) => (
        <div key={`td-${tdIndex}`} className="td-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(52, 211, 153, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
          <button onClick={() => deleteTD(lIndex, sIndex, uIndex, mIndex, tdIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
          <button 
            onClick={() => {
              if (td.pdfPath && window.confirm("Remplacer le document existant ?")) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'pdfPath']);
              } else if (!td.pdfPath) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'pdfPath']);
              }
            }}
            style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: td.pdfPath ? 1 : 0.4, padding:0}}
            title={td.pdfPath ? `Document lié. Cliquez pour remplacer.` : "Importer un document (PDF)"}
          >
            📄
          </button>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
            <EditableLabel
              value={td.titre}
              onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'titre'], v)}
              placeholder="Nom de l'exercice"
              style={{fontSize:'0.85rem'}}
            />
            <EditableNote 
              value={td.notes} 
              onClick={() => setModalConfig({
                isOpen: true,
                title: `Notes TD : ${td.titre}`,
                initialValue: td.notes,
                onSave: (v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'notes'], v)
              })}
              placeholder="+ Ajouter une note (markdown supporté)" 
            />
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
            <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>Difficulté</span>
            <StarRating 
              value={td.difficulteInitiale || 1} 
              onChange={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'difficulteInitiale'], v)} 
            />
          </div>
        </div>
      ))}

      {/* --- TP --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--warning-color)'}}>{matiere.listeTP?.length || 0} TP</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => addTPManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>+ Manuel</button>
        </div>
      </div>
      {matiere.listeTP?.map((tp, tpIndex) => (
        <div key={`tp-${tpIndex}`} className="tp-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(251, 191, 36, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
          <button onClick={() => deleteTP(lIndex, sIndex, uIndex, mIndex, tpIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
          <button 
            onClick={() => {
              if (tp.pdfPath && window.confirm("Remplacer le document existant ?")) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'pdfPath']);
              } else if (!tp.pdfPath) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'pdfPath']);
              }
            }}
            style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: tp.pdfPath ? 1 : 0.4, padding:0}}
            title={tp.pdfPath ? `Document lié. Cliquez pour remplacer.` : "Importer un document (PDF)"}
          >
            📄
          </button>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
            <EditableLabel
              value={tp.titre}
              onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'titre'], v)}
              placeholder="Nom de l'exercice"
              style={{fontSize:'0.85rem'}}
            />
            <EditableNote 
              value={tp.notes} 
              onClick={() => setModalConfig({
                isOpen: true,
                title: `Notes TP : ${tp.titre}`,
                initialValue: tp.notes,
                onSave: (v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'notes'], v)
              })}
              placeholder="+ Ajouter une note (markdown supporté)" 
            />
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
            <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>Difficulté</span>
            <StarRating 
              value={tp.difficulteInitiale || 1} 
              onChange={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'difficulteInitiale'], v)} 
            />
          </div>
        </div>
      ))}
      
      {/* --- ANNALES --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'#ef4444'}}>{matiere.listeAnnales?.length || 0} Annales</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => actions.addAnnaleManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'#ef4444', border:'1px solid rgba(239, 68, 68, 0.4)'}}>+ Manuel</button>
        </div>
      </div>
      {matiere.listeAnnales?.map((annale, aIndex) => (
        <div key={`annale-${aIndex}`} className="annale-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(239, 68, 68, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
          <button onClick={() => actions.deleteAnnale(lIndex, sIndex, uIndex, mIndex, aIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
          <button 
            onClick={() => {
              if (annale.pdfPath && window.confirm("Remplacer le document existant ?")) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'pdfPath']);
              } else if (!annale.pdfPath) {
                handleUploadClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'pdfPath']);
              }
            }}
            style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: annale.pdfPath ? 1 : 0.4, padding:0}}
            title={annale.pdfPath ? `Document lié. Cliquez pour remplacer.` : "Importer un document (PDF)"}
          >
            📄
          </button>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
            <EditableLabel
              value={annale.titre}
              onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'titre'], v)}
              placeholder="Nom de l'annale"
              style={{fontSize:'0.85rem'}}
            />
            <EditableNote 
              value={annale.notes} 
              onClick={() => setModalConfig({
                isOpen: true,
                title: `Notes Annale : ${annale.titre}`,
                initialValue: annale.notes,
                onSave: (v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'notes'], v)
              })}
              placeholder="+ Ajouter une note (markdown supporté)" 
            />
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
            <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>Difficulté</span>
            <StarRating 
              value={annale.difficulteInitiale || 3} 
              onChange={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'difficulteInitiale'], v)} 
              tooltip="Difficulté de l'annale (par défaut: 3)"
            />
          </div>
        </div>
      ))}
      
    </div>
  );
}
