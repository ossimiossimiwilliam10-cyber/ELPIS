import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';
import MarkdownModal from './MarkdownModal';

// Séquence complète de la méthode des J sur 6 ans
const J_SEQUENCE = [0, 1, 3, 7, 14, 30, 60, 90, 180, 270, 365, 547, 730, 1095, 1460, 1825, 2190];

// Deep clone helper
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// Composant utilitaire : Affiche un nom + bouton renommer
function EditableLabel({ value, onRename, placeholder, style }) {
  const handleRename = () => {
    const newName = window.prompt("Nouveau nom :", value || '');
    if (newName !== null && newName.trim() !== '') {
      onRename(newName.trim());
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, ...style }}>
      <span title={value} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {value || <em style={{color:'var(--text-secondary)'}}>{placeholder}</em>}
      </span>
      <button 
        onClick={handleRename} 
        style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.9rem', padding:'0.2rem', flexShrink: 0}} 
        title="Renommer"
      >
        ✏️
      </button>
    </div>
  );
}

// Composant utilitaire : Affiche un texte éditable (notes/mémos) avec bouton
function EditableNote({ value, onClick, placeholder }) {
  return (
    <div 
      onClick={onClick}
      style={{
        padding:'0.3rem', fontSize:'0.75rem', 
        background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', 
        color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}
      title="Cliquer pour modifier"
    >
      {value || <em>{placeholder}</em>}
    </div>
  );
}

function CoursPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const [configLocal, setConfigLocal] = useState(() => deepClone(coursConfig || { semestres: [] }));
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSemestreIndex, setActiveSemestreIndex] = useState(0);
  const [collapsedUEs, setCollapsedUEs] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });

  const toggleUE = (sIndex, uIndex) => {
    const key = `${sIndex}-${uIndex}`;
    setCollapsedUEs(prev => ({...prev, [key]: !prev[key]}));
  };

  // Resynchroniser le state local quand le parent change (ex: import backup)
  useEffect(() => {
    if (coursConfig) {
      setConfigLocal(deepClone(coursConfig));
    }
  }, [coursConfig]);

  // ---- Recherche ----
  const matchesSearch = (str) => {
    if (!searchTerm.trim()) return true;
    return str?.toLowerCase().includes(searchTerm.toLowerCase());
  };
  const ueMatchesSearch = (ue) => matchesSearch(ue.nom) || ue.matieres?.some(m => matiereMatchesSearch(m));
  const matiereMatchesSearch = (m) => {
    if (matchesSearch(m.nom)) return true;
    if (m.listeCM?.some(cm => matchesSearch(cm.titre) || matchesSearch(cm.notes))) return true;
    if (m.listeTD?.some(td => matchesSearch(td.titre) || matchesSearch(td.notes))) return true;
    if (m.listeTP?.some(tp => matchesSearch(tp.titre) || matchesSearch(tp.notes))) return true;
    return false;
  };
  const semestreMatchesSearch = (semestre) => matchesSearch(semestre.nom) || semestre.ues?.some(ue => ueMatchesSearch(ue));

  // ---- Helpers de mutation (toujours deep clone) ----
  const updateField = (path, value) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      let target = newConf;
      for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      setCoursConfig(newConf); // Auto-save via Zustand debounce
      return newConf;
    });
  };

  const addSemestre = () => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.semestres) newConf.semestres = [];
      newConf.semestres.push({ nom: `Semestre ${newConf.semestres.length + 1}`, ues: [] });
      return newConf;
    });
    setActiveSemestreIndex(configLocal.semestres ? configLocal.semestres.length : 0);
  };

  const deleteSemestre = (sIndex) => {
    if (window.confirm("Supprimer ce semestre et toutes ses UEs ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres.splice(sIndex, 1);
        return newConf;
      });
      if (activeSemestreIndex === sIndex) {
        setActiveSemestreIndex(Math.max(0, sIndex - 1));
      } else if (activeSemestreIndex > sIndex) {
        setActiveSemestreIndex(activeSemestreIndex - 1);
      }
    }
  };

  const addUE = (sIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.semestres[sIndex].ues) newConf.semestres[sIndex].ues = [];
      newConf.semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
      return newConf;
    });
  };

  const deleteUE = (sIndex, uIndex) => {
    if (window.confirm("Supprimer cette UE et toutes ses matières ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues.splice(uIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addMatiere = (sIndex, uIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const newMatiere = { nom: "Nouvelle Matière", listeCM: [], listeTD: [], listeTP: [] };
      if(!newConf.semestres[sIndex].ues[uIndex].matieres) newConf.semestres[sIndex].ues[uIndex].matieres = [];
      newConf.semestres[sIndex].ues[uIndex].matieres.push(newMatiere);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteMatiere = (sIndex, uIndex, mIndex) => {
    if (window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addCM = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const mat = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeCM) mat.listeCM = [];
      const newCM = { titre: "Nouveau CM", jActuel: 0, derniereRevision: "" };
      mat.listeCM.push(newCM);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteCM = (sIndex, uIndex, mIndex, cmIndex) => {
    if (window.confirm("Supprimer ce CM ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addTDManuel = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const m = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if(!m.listeTD) m.listeTD = [];
      m.listeTD.push({ titre: "Nouveau TD Manuel", dernierePratique: "", nombrePratiques: 0, notes: "" });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteTD = (sIndex, uIndex, mIndex, tdIndex) => {
    if (window.confirm("Supprimer ce TD ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.splice(tdIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addTPManuel = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const m = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if(!m.listeTP) m.listeTP = [];
      m.listeTP.push({ titre: "Nouveau TP Manuel", dernierePratique: "", nombrePratiques: 0, notes: "" });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteTP = (sIndex, uIndex, mIndex, tpIndex) => {
    if (window.confirm("Supprimer ce TP ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.splice(tpIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const updateJActuel = (sIndex, uIndex, mIndex, cmIndex, newJ) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].jActuel = newJ;
      
      // Update derniereRevision logic
      const cm = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex];
      const today = new Date().toISOString().split('T')[0];
      if (newJ === 0) {
        cm.derniereRevision = "";
      } else {
        if (!cm.derniereRevision) {
          cm.derniereRevision = today;
        }
      }
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const getNextReviewDate = (cm) => {
    if (!cm.derniereRevision) return "Aujourd'hui";
    if (cm.jActuel === 0) return "Aujourd'hui";
    const date = new Date(cm.derniereRevision);
    date.setDate(date.getDate() + cm.jActuel);
    const diffTime = date.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const handleFileUpload = async (sIndex, uIndex, mIndex, file, type) => {
    if (!file) return;
    setIsScanning(true);
    const formData = new FormData();
    formData.append('pdfFile', file);
    try {
      const res = await fetch('http://localhost:3001/api/scan-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.exercises) {
        setConfigLocal(prev => {
          const newConf = deepClone(prev);
          const m = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
          if (type === 'TD') {
            if (!m.listeTD) m.listeTD = [];
            m.listeTD.push(...data.exercises);
          } else if (type === 'TP') {
            if (!m.listeTP) m.listeTP = [];
            m.listeTP.push(...data.exercises);
          }
          
          setCoursConfig(newConf);
          return newConf;
        });
        alert(`${data.exercises.length} exercices trouvés et ajoutés !`);
      } else {
        alert("Erreur serveur : " + data.error);
      }
    } catch(err) {
      alert("Erreur lors de l'upload : " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="cours-page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem'}}>
        <div>
          <h2 style={{margin:0}}>Architecture des Cours</h2>
          <p style={{color:'var(--text-secondary)', marginTop:'0.5rem'}}>Gère tes Semestres, Unités d'Enseignement et Matières.</p>
        </div>
        <div style={{display:'flex', gap:'1rem', alignItems: 'center', flexWrap:'wrap'}}>
          <input 
            type="text"
            placeholder="🔍 Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '220px'}}
          />
          <button onClick={addSemestre} className="btn-secondary" style={{padding:'0.4rem 0.8rem'}}>+ Semestre</button>
        </div>
      </div>

      <div style={{color:'var(--text-secondary)', fontSize:'0.9rem', fontStyle:'italic', marginTop:'1rem', textAlign:'right'}}>
        Sauvegarde automatique activée
      </div>

      <div className="semestre-tabs" style={{display:'flex', gap:'1.5rem'}}>
        {configLocal.semestres?.map((semestre, sIndex) => (
          <button 
            key={`tab-${sIndex}`} 
            className={`tab-btn ${activeSemestreIndex === sIndex ? 'active' : ''}`}
            onClick={() => setActiveSemestreIndex(sIndex)}
          >
            {semestre.nom}
          </button>
        ))}
        <button className="tab-btn" onClick={addSemestre} style={{color:'var(--accent-primary)'}}>+ Semestre</button>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        {configLocal.semestres && configLocal.semestres[activeSemestreIndex] && (() => {
          const sIndex = activeSemestreIndex;
          const semestre = configLocal.semestres[sIndex];
          if (!semestreMatchesSearch(semestre)) return null;
          return (
          <div key={`s-${sIndex}`} className="card glass-panel" style={{borderLeft:'4px solid var(--accent-primary)'}}>
            
            {/* === SEMESTRE HEADER === */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
              <EditableLabel 
                value={semestre.nom} 
                onRename={(v) => updateField(['semestres', sIndex, 'nom'], v)}
                placeholder="Nom du semestre"
                style={{fontSize:'1.4rem', fontWeight:'bold', flex: 1}}
              />
              <div style={{display:'flex', gap:'0.5rem', marginLeft:'1rem'}}>
                <button className="btn-secondary" onClick={() => addUE(sIndex)}>+ UE</button>
                <button onClick={() => deleteSemestre(sIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer">🗑️</button>
              </div>
            </div>

            {/* === UES === */}
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', marginLeft:'1rem'}}>
              {semestre.ues?.map((ue, uIndex) => {
                if (!ueMatchesSearch(ue)) return null;
                const isCollapsed = collapsedUEs[`${sIndex}-${uIndex}`];
                
                let ueTotalExos = 0;
                ue.matieres?.forEach(m => {
                  ueTotalExos += (m.listeCM?.length || 0) + (m.listeTD?.length || 0) + (m.listeTP?.length || 0);
                });

                return (
                <div key={`u-${sIndex}-${uIndex}`} style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)'}}>
                  
                  {/* UE HEADER */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isCollapsed ? '0' : '1rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flex: 1}}>
                      <button 
                        className={`ue-accordion-btn ${!isCollapsed ? 'open' : ''}`} 
                        onClick={() => toggleUE(sIndex, uIndex)}
                        title={isCollapsed ? "Développer" : "Réduire"}
                      >
                        🔽
                      </button>
                      <button onClick={() => deleteUE(sIndex, uIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem'}} title="Supprimer l'UE">🗑️</button>
                      <EditableLabel 
                        value={ue.nom}
                        onRename={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'nom'], v)}
                        placeholder="Nom de l'UE"
                        style={{fontWeight:'bold', fontSize:'1.1rem', flex: 1}}
                      />
                      <div style={{display:'flex', alignItems:'center', gap:'0.3rem', flexShrink: 0}}>
                        <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>ECTS:</span>
                        <input 
                          type="number" 
                          value={ue.creditsEcts || 0} 
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 0;
                            val = Math.min(60, Math.max(0, val));
                            updateField(['semestres', sIndex, 'ues', uIndex, 'creditsEcts'], val);
                          }}
                          style={{width:'60px', padding:'0.3rem'}}
                          title="Crédits ECTS (0-60)"
                        />
                      </div>
                    </div>
                    
                    <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                      {isCollapsed && (
                        <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                          {ue.matieres?.length || 0} Matière(s) • {ueTotalExos} Exercice(s)
                        </span>
                      )}
                      <button className="btn-secondary" style={{fontSize:'0.9rem'}} onClick={() => { if(isCollapsed) toggleUE(sIndex, uIndex); addMatiere(sIndex, uIndex); }}>+ Matière</button>
                    </div>
                  </div>

                  {/* MATIERES GRID (Accordion Content) */}
                  <div className={`ue-accordion-content ${isCollapsed ? 'closed' : 'open'}`}>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem'}}>
                    {ue.matieres?.map((matiere, mIndex) => {
                      if (!matiereMatchesSearch(matiere)) return null;
                      return (
                      <div key={`m-${sIndex}-${uIndex}-${mIndex}`} style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)', minWidth: 0}}>
                        
                        {/* MATIERE HEADER */}
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', minWidth: 0}}>
                          <button onClick={() => deleteMatiere(sIndex, uIndex, mIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}} title="Supprimer">🗑️</button>
                          <EditableLabel
                            value={matiere.nom}
                            onRename={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'nom'], v)}
                            placeholder="Nom de la matière"
                            style={{flex:1, borderBottom:'1px solid var(--bg-tertiary)', paddingBottom:'0.3rem'}}
                          />
                        </div>
                        
                        {/* --- CM --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>{matiere.listeCM?.length || 0} CM</span>
                          <button className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem'}} onClick={() => addCM(sIndex, uIndex, mIndex)}>+ CM</button>
                        </div>
                        {matiere.listeCM?.map((cm, cmIndex) => (
                          <div key={`cm-${cmIndex}`} className="cm-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.4rem', borderRadius:'4px'}}>
                            <button onClick={() => deleteCM(sIndex, uIndex, mIndex, cmIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
                            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                              <EditableLabel
                                value={cm.titre}
                                onRename={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'titre'], v)}
                                placeholder="Titre du CM"
                                style={{fontSize:'0.85rem'}}
                              />
                              <EditableNote 
                                value={cm.notes} 
                                onClick={() => setModalConfig({
                                  isOpen: true,
                                  title: `Notes CM : ${cm.titre}`,
                                  initialValue: cm.notes,
                                  onSave: (v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'notes'], v)
                                })} 
                                placeholder="+ Ajouter une note (markdown supporté)" 
                              />
                            </div>
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.2rem'}}>
                              <select 
                                value={cm.jActuel}
                                onChange={(e) => updateJActuel(sIndex, uIndex, mIndex, cmIndex, parseInt(e.target.value) || 0)}
                                style={{padding:'0.3rem', fontSize:'0.8rem'}}
                              >
                                {J_SEQUENCE.map(j => (
                                  <option key={j} value={j}>J{j}</option>
                                ))}
                              </select>
                              <span style={{fontSize:'0.65rem', color:'var(--text-secondary)'}}>
                                {getNextReviewDate(cm)}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* --- TD --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--success-color)'}}>{matiere.listeTD?.length || 0} TD</span>
                          <div style={{display:'flex', gap:'0.5rem'}}>
                            <button onClick={() => addTDManuel(sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>+ Manuel</button>
                            <input type="file" accept="application/pdf" id={`td-up-${sIndex}-${uIndex}-${mIndex}`} style={{display:'none'}} onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TD')} disabled={isScanning} />
                            <label htmlFor={`td-up-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor: isScanning ? 'not-allowed' : 'pointer', color:'var(--success-color)', border:'1px solid var(--success-glow)', opacity: isScanning ? 0.5 : 1}}>
                              {isScanning ? '⏳ Scan...' : 'Scanner PDF'}
                            </label>
                          </div>
                        </div>
                        {matiere.listeTD?.map((td, tdIndex) => (
                          <div key={`td-${tdIndex}`} className="td-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(52, 211, 153, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
                            <button onClick={() => deleteTD(sIndex, uIndex, mIndex, tdIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
                            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                              <EditableLabel
                                value={td.titre}
                                onRename={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'titre'], v)}
                                placeholder="Nom de l'exercice"
                                style={{fontSize:'0.85rem'}}
                              />
                              <EditableNote 
                                value={td.notes} 
                                onClick={() => setModalConfig({
                                  isOpen: true,
                                  title: `Notes TD : ${td.titre}`,
                                  initialValue: td.notes,
                                  onSave: (v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'notes'], v)
                                })}
                                placeholder="+ Ajouter une note (markdown supporté)" 
                              />
                            </div>
                          </div>
                        ))}

                        {/* --- TP --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--warning-color)'}}>{matiere.listeTP?.length || 0} TP</span>
                          <div style={{display:'flex', gap:'0.5rem'}}>
                            <button onClick={() => addTPManuel(sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>+ Manuel</button>
                            <input type="file" accept="application/pdf" id={`tp-up-${sIndex}-${uIndex}-${mIndex}`} style={{display:'none'}} onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TP')} disabled={isScanning} />
                            <label htmlFor={`tp-up-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor: isScanning ? 'not-allowed' : 'pointer', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)', opacity: isScanning ? 0.5 : 1}}>
                              {isScanning ? '⏳ Scan...' : 'Scanner PDF'}
                            </label>
                          </div>
                        </div>
                        {matiere.listeTP?.map((tp, tpIndex) => (
                          <div key={`tp-${tpIndex}`} className="tp-item" style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(251, 191, 36, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
                            <button onClick={() => deleteTP(sIndex, uIndex, mIndex, tpIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
                            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                              <EditableLabel
                                value={tp.titre}
                                onRename={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'titre'], v)}
                                placeholder="Nom de l'exercice"
                                style={{fontSize:'0.85rem'}}
                              />
                              <EditableNote 
                                value={tp.notes} 
                                onClick={() => setModalConfig({
                                  isOpen: true,
                                  title: `Notes TP : ${tp.titre}`,
                                  initialValue: tp.notes,
                                  onSave: (v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'notes'], v)
                                })}
                                placeholder="+ Ajouter une note (markdown supporté)" 
                              />
                            </div>
                          </div>
                        ))}
                        
                      </div>
                      )
                    })}
                    </div>
                  </div>

                </div>
                )
              })}
            </div>

          </div>
          )
        })()}
      </div>
      
      <MarkdownModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        initialValue={modalConfig.initialValue}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onSave={modalConfig.onSave}
      />
    </div>
  );
}

export default CoursPage;
