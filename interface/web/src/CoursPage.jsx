import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...style }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
function EditableNote({ value, onEdit, placeholder }) {
  const handleEdit = () => {
    const newVal = window.prompt("Modifier :", value || '');
    if (newVal !== null) {
      onEdit(newVal);
    }
  };

  return (
    <div 
      onClick={handleEdit}
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

function CoursPage({ coursConfig, onSave, saving }) {
  const [configLocal, setConfigLocal] = useState(() => deepClone(coursConfig || { semestres: [] }));
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
  };

  const deleteSemestre = (sIndex) => {
    if (window.confirm("Supprimer ce semestre et toutes ses UEs ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres.splice(sIndex, 1);
        return newConf;
      });
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
        return newConf;
      });
    }
  };

  const addMatiere = (sIndex, uIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.semestres[sIndex].ues[uIndex].matieres) newConf.semestres[sIndex].ues[uIndex].matieres = [];
      newConf.semestres[sIndex].ues[uIndex].matieres.push({ nom: "Nouvelle Matière", listeCM: [], listeTD: [], listeTP: [] });
      return newConf;
    });
  };

  const deleteMatiere = (sIndex, uIndex, mIndex) => {
    if (window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1);
        return newConf;
      });
    }
  };

  const addCM = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const mat = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeCM) mat.listeCM = [];
      mat.listeCM.push({ titre: "Nouveau CM", jActuel: 0, derniereRevision: "" });
      return newConf;
    });
  };

  const deleteCM = (sIndex, uIndex, mIndex, cmIndex) => {
    if (window.confirm("Supprimer ce CM ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1);
        return newConf;
      });
    }
  };

  const addTDManuel = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const mat = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeTD) mat.listeTD = [];
      mat.listeTD.push({ titre: "Nouveau TD Manuel", dernierePratique: "", nombrePratiques: 0, pdfSource: "", page: 1 });
      return newConf;
    });
  };

  const deleteTD = (sIndex, uIndex, mIndex, tdIndex) => {
    if (window.confirm("Supprimer ce TD ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.splice(tdIndex, 1);
        return newConf;
      });
    }
  };

  const addTPManuel = (sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const mat = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeTP) mat.listeTP = [];
      mat.listeTP.push({ titre: "Nouveau TP Manuel", dernierePratique: "", nombrePratiques: 0, pdfSource: "", page: 1 });
      return newConf;
    });
  };

  const deleteTP = (sIndex, uIndex, mIndex, tpIndex) => {
    if (window.confirm("Supprimer ce TP ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.splice(tpIndex, 1);
        return newConf;
      });
    }
  };

  const updateJActuel = (sIndex, uIndex, mIndex, cmIndex, val) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const cm = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex];
      cm.jActuel = val;
      if (val > 0) {
        // Le compteur démarre aujourd'hui pour le nouveau J
        cm.derniereRevision = new Date().toISOString().split('T')[0];
      } else {
        cm.derniereRevision = "";
      }
      return newConf;
    });
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
          const mat = newConf.semestres[sIndex].ues[uIndex].matieres[mIndex];
          if (type === 'TD') {
            if (!mat.listeTD) mat.listeTD = [];
            mat.listeTD.push(...data.exercises);
          } else {
            if (!mat.listeTP) mat.listeTP = [];
            mat.listeTP.push(...data.exercises);
          }
          onSave(newConf);
          return newConf;
        });
        alert(`${data.exercises.length} exercices trouvés et ajoutés !`);
      } else {
        alert("Erreur: Aucun exercice reconnu ou fichier invalide.");
      }
    } catch(err) {
      alert("Erreur lors de la communication avec le serveur Node.js.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = () => {
    let isValid = true;
    configLocal.semestres?.forEach(s => {
      if (!s.nom || s.nom.trim() === '') isValid = false;
      s.ues?.forEach(u => {
        if (!u.nom || u.nom.trim() === '') isValid = false;
        u.matieres?.forEach(m => {
          if (!m.nom || m.nom.trim() === '') isValid = false;
        });
      });
    });
    if (!isValid) {
      alert("Erreur: Veuillez remplir tous les noms de semestres, UEs et matières avant de sauvegarder.");
      return;
    }
    onSave(configLocal);
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
          <button className="btn-secondary" onClick={addSemestre}>+ Semestre</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Synchronisation...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        {configLocal.semestres?.map((semestre, sIndex) => {
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
                return (
                <div key={`u-${sIndex}-${uIndex}`} style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)'}}>
                  
                  {/* UE HEADER */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flex: 1}}>
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
                    <button className="btn-secondary" style={{fontSize:'0.9rem', marginLeft:'0.75rem'}} onClick={() => addMatiere(sIndex, uIndex)}>+ Matière</button>
                  </div>

                  {/* MATIERES GRID */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem'}}>
                    {ue.matieres?.map((matiere, mIndex) => {
                      if (!matiereMatchesSearch(matiere)) return null;
                      return (
                      <div key={`m-${sIndex}-${uIndex}-${mIndex}`} style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)'}}>
                        
                        {/* MATIERE HEADER */}
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem'}}>
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
                          <div key={`cm-${cmIndex}`} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.4rem', borderRadius:'4px'}}>
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
                                onEdit={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'notes'], v)}
                                placeholder="Notes ou mémos..."
                              />
                            </div>
                            <select 
                              value={cm.jActuel}
                              onChange={(e) => updateJActuel(sIndex, uIndex, mIndex, cmIndex, parseInt(e.target.value) || 0)}
                              style={{padding:'0.3rem', fontSize:'0.8rem'}}
                            >
                              {J_SEQUENCE.map(j => (
                                <option key={j} value={j}>J{j}</option>
                              ))}
                            </select>
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
                          <div key={`td-${tdIndex}`} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(52, 211, 153, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
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
                                onEdit={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'notes'], v)}
                                placeholder="Notes ou mémos..."
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
                          <div key={`tp-${tpIndex}`} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(251, 191, 36, 0.05)', padding:'0.4rem', borderRadius:'4px'}}>
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
                                onEdit={(v) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'notes'], v)}
                                placeholder="Notes ou mémos..."
                              />
                            </div>
                          </div>
                        ))}
                        
                      </div>
                      )
                    })}
                  </div>

                </div>
                )
              })}
            </div>

          </div>
          )
        })}
      </div>
    </div>
  );
}

export default CoursPage;
