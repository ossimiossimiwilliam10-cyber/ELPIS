import { produce } from 'immer';
import EditableLabel from './EditableLabel';
import EditableNote from './EditableNote';
import StarRating from './StarRating';
import InfoTooltip from '../InfoTooltip';

/** Extrait "YYYY-MM-DD" d'une date ISO "YYYY-MM-DDTHH:MM:SS" pour <input type="date"> */
const toDateInput = (val) => {
  if (!val || typeof val !== 'string') return '';
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return val.substring(0, 10);
};

export default function MatiereCard({
  matiere,
  allMatiereNames,
  ankiDecks = [],
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
    input.accept = 'application/pdf,image/*';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');

      if (!isPdf && !isImg) {
        alert('Veuillez sélectionner un fichier PDF ou une image.');
        return;
      }

      const formData = new FormData();
      formData.append('pdf', file);

      try {
        const res = await fetch('/api/upload/pdf', {
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

  const handleUploadMultipleClick = (basePathArray, currentArray) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const newUrls = [];
      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImg = file.type.startsWith('image/');
        if (!isPdf && !isImg) {
          alert(`Le fichier ${file.name} n'est pas un PDF ou une image, ignoré.`);
          continue;
        }
        const formData = new FormData();
        formData.append('pdf', file);
        try {
          const res = await fetch('/api/upload/pdf', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success) newUrls.push(data.url);
          else alert(`Erreur lors de l'upload de ${file.name}: ` + data.error);
        } catch (err) {
          console.error(err);
          alert(`Erreur réseau pour ${file.name}`);
        }
      }
      
      if (newUrls.length > 0) {
        const merged = [...(currentArray || []), ...newUrls];
        updateField(basePathArray, merged);
      }
    };
    input.click();
  };

  const handleScanPdfFor = (typeListKey, defaultPathArray) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('pdf', file);

      try {
        const res = await fetch('/api/upload/pdf', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          if (data.suggestedExercises && data.suggestedExercises.length > 0) {
            const msg = `L'IA a détecté ${data.suggestedExercises.length} exercices dans ce PDF :\n- ` + data.suggestedExercises.slice(0, 10).join('\n- ') + (data.suggestedExercises.length > 10 ? `\n... et ${data.suggestedExercises.length - 10} autres` : '') + `\n\nVoulez-vous les ajouter automatiquement à la liste ?`;
            if (window.confirm(msg)) {
               const currentItems = [...(matiere[typeListKey] || [])];
               data.suggestedExercises.forEach(titre => {
                  currentItems.push({ titre, dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString(), pdfPath: data.url });
               });
               updateField(defaultPathArray, currentItems);
               return;
            }
          }
          alert(`PDF uploadé (${data.url}), mais aucun exercice n'a pu être extrait automatiquement. Vous pouvez ajouter les exercices manuellement et lier ce document.`);
        } else {
          alert("Erreur lors de l'upload: " + data.error);
        }
      } catch (err) {
        console.error(err);
        alert("Erreur réseau lors de l'upload et scan.");
      }
    };
    input.click();
  };

  return (
    <div style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)', minWidth: 0, opacity: matiere.dispense ? 0.5 : 1, transition: 'opacity 0.3s'}}>
      {/* MATIERE HEADER */}
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', minWidth: 0}}>
        <button onClick={() => deleteMatiere(lIndex, sIndex, uIndex, mIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}} title="Supprimer">🗑️</button>
        <EditableLabel
          value={matiere.nom}
          onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'nom'], v)}
          placeholder="Nom de la matière"
          style={{flex:1, borderBottom:'1px solid var(--bg-tertiary)', paddingBottom:'0.3rem'}}
        />
        <button
          onClick={() => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'dispense'], !matiere.dispense)}
          style={{
            background: matiere.dispense ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            border: matiere.dispense ? '1px solid var(--success-color)' : '1px solid var(--border-color)',
            color: matiere.dispense ? 'var(--success-color)' : 'var(--text-secondary)',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Marquer comme dispensé (Validation d'acquis)"
        >
          {matiere.dispense ? '🎓 Dispensé' : 'Normal'}
        </button>
        <button
          onClick={() => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'dette'], !matiere.dette)}
          style={{
            background: matiere.dette ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
            border: matiere.dette ? '1px solid var(--danger-color, #ef4444)' : '1px solid var(--border-color)',
            color: matiere.dette ? 'var(--danger-color, #ef4444)' : 'var(--text-secondary)',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: matiere.dispense ? 'none' : 'block' // Cannot be both
          }}
          title="Marquer comme Dette (Priorité absolue AJAC)"
        >
          {matiere.dette ? '⚠️ En Dette' : 'Non validé'}
        </button>
      </div>

      {/* CONFIG NOTEBOOK LM & SYNERGIES */}
      <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1rem', background:'rgba(0,0,0,0.2)', padding:'0.5rem', borderRadius:'6px'}}>
        <div style={{display:'flex', gap:'0.5rem', alignItems: 'center'}}>
          <span style={{fontSize:'1rem'}} title="Date du premier examen">🚨</span>
          <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Date du 1er examen :</span>
          <input
            type="date"
            value={toDateInput(matiere.examDates?.[0] || '')}
            onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'examDates'], e.target.value ? [e.target.value] : [])}
            style={{flex:1, padding:'0.4rem', fontSize:'0.8rem', background:'var(--bg-secondary)', border:'1px solid var(--danger-color)', borderRadius:'4px', color:'var(--text-primary)'}}
          />
        </div>
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
        <div style={{display:'flex', gap:'0.5rem', alignItems: 'center'}}>
          <span style={{fontSize:'1rem'}} title="Deck Anki Lié">🃏</span>
          <select
            value={matiere.ankiDeckName || ''}
            onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'ankiDeckName'], e.target.value)}
            style={{flex:1, padding:'0.4rem', fontSize:'0.8rem', background:'var(--bg-secondary)', border:'1px solid var(--bg-tertiary)', borderRadius:'4px', color:'var(--text-primary)'}}
          >
            <option value="">-- Aucun deck Anki lié --</option>
            {ankiDecks.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div style={{display:'flex', gap:'0.5rem', alignItems: 'flex-start'}}>
          <span style={{fontSize:'1rem', marginTop: '4px'}} title="Synergies inter-matières">🔗</span>
          <div style={{flex:1}}>
            <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px'}}>
              <InfoTooltip content="Lier deux matières crée des ponts cognitifs. Le système tentera de planifier des sessions mixtes (Interleaving) pour stimuler la mémorisation transversale." width={260}>
                Matières liées (Synergies) : <span style={{fontSize:'0.75rem'}}>ℹ️</span>
              </InfoTooltip>
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
              {(allMatiereNames || []).filter(name => name !== matiere.nom).map(name => {
                const isSelected = matiere.synergies?.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => {
                       let current = [...(matiere.synergies || [])];
                       if (isSelected) {
                         current = current.filter(n => n !== name);
                       } else {
                         current.push(name);
                       }
                       updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'synergies'], current);
                    }}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                      color: isSelected ? '#60a5fa' : 'var(--text-secondary)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {name}
                  </button>
                );
              })}
              {(!allMatiereNames || allMatiereNames.length <= 1) && (
                 <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic'}}>Ajoutez d'autres matières d'abord.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- CM --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>{matiere.listeCM?.length || 0} CM</span>
        <button className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem'}} onClick={() => addCM(lIndex, sIndex, uIndex, mIndex)}>+ CM</button>
      </div>
      {matiere.listeCM?.map((cm, cmIndex) => {
        const allPdfs = [...(cm.pdfPaths || [])];
        if (cm.pdfPath && !allPdfs.includes(cm.pdfPath)) {
          allPdfs.unshift(cm.pdfPath);
        }

        return (
        <div key={`cm-${cmIndex}`} className="cm-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.4rem', borderRadius:'4px', flexWrap: 'wrap'}}>
          <div style={{display:'flex', width: '100%', gap:'0.5rem', alignItems:'center'}}>
            <button onClick={() => deleteCM(lIndex, sIndex, uIndex, mIndex, cmIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
            <button
              onClick={() => handleUploadMultipleClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'pdfPaths'], allPdfs)}
              style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: 1, padding:0}}
              title="Ajouter un document (PDF ou Image)"
            >
              ➕
            </button>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0}}>
              <EditableLabel
                value={cm.titre}
                onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'titre'], v)}
                placeholder="Titre du CM"
                style={{fontSize:'0.85rem'}}
              />
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', background: 'rgba(59,130,246,0.08)', padding: '0.3rem 0.5rem', borderRadius: '6px'}}>
                <span style={{fontSize: '0.8rem'}}>📅</span>
                <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>Date de début :</span>
                <input type="date" value={toDateInput(cm.dateCM)} onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'dateCM'], e.target.value)} style={{background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', flex: 1}} />
              </div>
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
                      const newConf = produce(prev, draft => {
                        const currentCM = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex];
                        currentCM.jActuel = newJ;
                        currentCM.prochaineRevisionDate = null;
                        if (newJ > 0 && (!currentCM.derniereRevision || currentCM.derniereRevision === "")) {
                          const d = new Date();
                          d.setHours(d.getHours() - 4);
                          currentCM.derniereRevision = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        }
                      });
                      setCoursConfig(newConf);
                      return newConf;
                    });
                  }}
                  style={{padding:'0.15rem 0.3rem', borderRadius:'4px', background:'var(--bg-tertiary)', color:'white', border:'1px solid var(--accent-primary)', fontSize:'0.7rem', width:'50px', textAlign:'center'}}
                  title="Intervalle en jours avant la prochaine révision"
                />
                <span title="Facteur de facilité (FSRS)">EF: {cm.easeFactor != null ? cm.easeFactor.toFixed(1) : '2.5'}</span>
              </div>
            </div>
          </div>
          {allPdfs.length > 0 && (
            <div style={{width: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', paddingLeft: '1.5rem'}}>
              {allPdfs.map((pdf, pIdx) => (
                <div key={pIdx} style={{display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>
                  <a href={pdf} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer'}}>Doc {pIdx + 1}</a>
                  <button 
                    onClick={() => {
                      if(window.confirm("Supprimer ce document ?")) {
                         const newPdfs = allPdfs.filter((_, i) => i !== pIdx);
                         updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'pdfPaths'], newPdfs);
                         if (pdf === cm.pdfPath) {
                            updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'pdfPath'], "");
                         }
                      }
                    }}
                    style={{background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.2rem'}}
                    title="Supprimer ce document"
                  >❌</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )})}

      {/* --- TD --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--success-color)'}}>{matiere.listeTD?.length || 0} TD</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => addTDManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>+ Manuel</button>
          <button onClick={() => handleScanPdfFor('listeTD', ['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD'])} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>📄 Scanner PDF</button>
        </div>
      </div>
      {matiere.listeTD?.map((td, tdIndex) => {
        const allPdfs = [...(td.pdfPaths || [])];
        if (td.pdfPath && !allPdfs.includes(td.pdfPath)) {
          allPdfs.unshift(td.pdfPath);
        }

        return (
        <div key={`td-${tdIndex}`} className="td-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(52, 211, 153, 0.05)', padding:'0.4rem', borderRadius:'4px', flexWrap: 'wrap'}}>
          <div style={{display:'flex', width: '100%', gap:'0.5rem', alignItems:'center'}}>
            <button onClick={() => deleteTD(lIndex, sIndex, uIndex, mIndex, tdIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
            <button
              onClick={() => handleUploadMultipleClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'pdfPaths'], allPdfs)}
              style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: 1, padding:0}}
              title="Ajouter un document (PDF ou Image)"
            >
              ➕
            </button>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0}}>
              <EditableLabel
                value={td.titre}
                onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'titre'], v)}
                placeholder="Nom de l'exercice"
                style={{fontSize:'0.85rem'}}
              />
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', background: 'rgba(52,211,153,0.08)', padding: '0.3rem 0.5rem', borderRadius: '6px'}}>
                <span style={{fontSize: '0.8rem'}}>📅</span>
                <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>Date de début :</span>
                <input type="date" value={toDateInput(td.datePrevue)} onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'datePrevue'], e.target.value)} style={{background: 'var(--bg-primary)', border: '1px solid var(--success-color)', color: 'var(--text-primary)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', flex: 1}} />
              </div>
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
          {allPdfs.length > 0 && (
            <div style={{width: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', paddingLeft: '1.5rem'}}>
              {allPdfs.map((pdf, pIdx) => (
                <div key={pIdx} style={{display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>
                  <a href={pdf} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer'}}>Doc {pIdx + 1}</a>
                  <button 
                    onClick={() => {
                      if(window.confirm("Supprimer ce document ?")) {
                         const newPdfs = allPdfs.filter((_, i) => i !== pIdx);
                         updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'pdfPaths'], newPdfs);
                         if (pdf === td.pdfPath) {
                            updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'pdfPath'], "");
                         }
                      }
                    }}
                    style={{background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.2rem'}}
                    title="Supprimer ce document"
                  >❌</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )})}

      {/* --- TP --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'var(--warning-color)'}}>{matiere.listeTP?.length || 0} TP</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => addTPManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>+ Manuel</button>
          <button onClick={() => handleScanPdfFor('listeTP', ['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP'])} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>📄 Scanner PDF</button>
        </div>
      </div>
      {matiere.listeTP?.map((tp, tpIndex) => {
        const allPdfs = [...(tp.pdfPaths || [])];
        if (tp.pdfPath && !allPdfs.includes(tp.pdfPath)) {
          allPdfs.unshift(tp.pdfPath);
        }

        return (
        <div key={`tp-${tpIndex}`} className="tp-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(251, 191, 36, 0.05)', padding:'0.4rem', borderRadius:'4px', flexWrap: 'wrap'}}>
          <div style={{display:'flex', width: '100%', gap:'0.5rem', alignItems:'center'}}>
            <button onClick={() => deleteTP(lIndex, sIndex, uIndex, mIndex, tpIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
            <button
              onClick={() => handleUploadMultipleClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'pdfPaths'], allPdfs)}
              style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: 1, padding:0}}
              title="Ajouter un document (PDF ou Image)"
            >
              ➕
            </button>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0}}>
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
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', background: 'rgba(251,191,36,0.08)', padding: '0.3rem 0.5rem', borderRadius: '6px'}}>
                <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>📅 Date de début :</span>
                <input
                  type="date"
                  value={toDateInput(tp.dateTP)}
                  onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'dateTP'], e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.75rem'
                  }}
                />
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
              <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>Difficulté</span>
              <StarRating
                value={tp.difficulteInitiale || 1}
                onChange={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'difficulteInitiale'], v)}
              />
            </div>
          </div>
          {allPdfs.length > 0 && (
            <div style={{width: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', paddingLeft: '1.5rem'}}>
              {allPdfs.map((pdf, pIdx) => (
                <div key={pIdx} style={{display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>
                  <a href={pdf} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer'}}>Doc {pIdx + 1}</a>
                  <button 
                    onClick={() => {
                      if(window.confirm("Supprimer ce document ?")) {
                         const newPdfs = allPdfs.filter((_, i) => i !== pIdx);
                         updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'pdfPaths'], newPdfs);
                         if (pdf === tp.pdfPath) {
                            updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'pdfPath'], "");
                         }
                      }
                    }}
                    style={{background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.2rem'}}
                    title="Supprimer ce document"
                  >❌</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )})}

      {/* --- ANNALES --- */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
        <span style={{fontSize:'0.9rem', color:'#ef4444'}}>{matiere.listeAnnales?.length || 0} Annales</span>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button onClick={() => actions.addAnnaleManuel(lIndex, sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'#ef4444', border:'1px solid rgba(239, 68, 68, 0.4)'}}>+ Manuel</button>
          <button onClick={() => handleScanPdfFor('listeAnnales', ['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales'])} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'#ef4444', border:'1px solid rgba(239, 68, 68, 0.4)'}}>📄 Scanner PDF</button>
        </div>
      </div>
      {matiere.listeAnnales?.map((annale, aIndex) => {
        const allPdfs = [...(annale.pdfPaths || [])];
        if (annale.pdfPath && !allPdfs.includes(annale.pdfPath)) {
          allPdfs.unshift(annale.pdfPath);
        }

        return (
        <div key={`annale-${aIndex}`} className="annale-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(239, 68, 68, 0.05)', padding:'0.4rem', borderRadius:'4px', flexWrap: 'wrap'}}>
          <div style={{display:'flex', width: '100%', gap:'0.5rem', alignItems:'center'}}>
            <button onClick={() => actions.deleteAnnale(lIndex, sIndex, uIndex, mIndex, aIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
            <button
              onClick={() => handleUploadMultipleClick(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'pdfPaths'], allPdfs)}
              style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', opacity: 1, padding:0}}
              title="Ajouter un document (PDF ou Image)"
            >
              ➕
            </button>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0}}>
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
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', background: 'rgba(239,68,68,0.08)', padding: '0.3rem 0.5rem', borderRadius: '6px'}}>
                <span style={{fontSize: '0.8rem'}}>📅</span>
                <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>Date de début :</span>
                <input type="date" value={toDateInput(annale.datePrevue)} onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'datePrevue'], e.target.value)} style={{background: 'var(--bg-primary)', border: '1px solid var(--danger-color)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', flex: 1}} />
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.4rem'}}>
              <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>Difficulté</span>
              <StarRating
                value={annale.difficulteInitiale || 1}
                onChange={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'difficulteInitiale'], v)}
              />
            </div>
          </div>
          {allPdfs.length > 0 && (
            <div style={{width: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', paddingLeft: '1.5rem'}}>
              {allPdfs.map((pdf, pIdx) => (
                <div key={pIdx} style={{display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>
                  <a href={pdf} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer'}}>Doc {pIdx + 1}</a>
                  <button 
                    onClick={() => {
                      if(window.confirm("Supprimer ce document ?")) {
                         const newPdfs = allPdfs.filter((_, i) => i !== pIdx);
                         updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'pdfPaths'], newPdfs);
                         if (pdf === annale.pdfPath) {
                            updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeAnnales', aIndex, 'pdfPath'], "");
                         }
                      }
                    }}
                    style={{background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.2rem'}}
                    title="Supprimer ce document"
                  >❌</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )})}

    </div>
  );
}