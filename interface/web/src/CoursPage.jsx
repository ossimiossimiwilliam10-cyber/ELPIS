import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Séquence complète de la méthode des J sur 6 ans
const J_SEQUENCE = [0, 1, 3, 7, 14, 30, 60, 90, 180, 270, 365, 547, 730, 1095, 1460, 1825, 2190];

// Deep clone helper — garantit l'immutabilité du state
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

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

  const matchesSearch = (str) => {
    if (!searchTerm.trim()) return true;
    return str?.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const ueMatchesSearch = (ue) => {
    if (matchesSearch(ue.nom)) return true;
    return ue.matieres?.some(m => matiereMatchesSearch(m));
  };

  const matiereMatchesSearch = (m) => {
    if (matchesSearch(m.nom)) return true;
    if (m.listeCM?.some(cm => matchesSearch(cm.titre) || matchesSearch(cm.notes))) return true;
    if (m.listeTD?.some(td => matchesSearch(td.titre) || matchesSearch(td.notes))) return true;
    if (m.listeTP?.some(tp => matchesSearch(tp.titre) || matchesSearch(tp.notes))) return true;
    return false;
  };

  const semestreMatchesSearch = (semestre) => {
    if (matchesSearch(semestre.nom)) return true;
    return semestre.ues?.some(ue => ueMatchesSearch(ue));
  };

  // ============================================================
  // TOUTES les fonctions de mutation utilisent maintenant deepClone
  // pour garantir l'immutabilité complète du state React
  // ============================================================

  const addSemestre = () => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres) newConf.semestres = [];
    newConf.semestres.push({ nom: `Semestre ${newConf.semestres.length + 1}`, ues: [] });
    setConfigLocal(newConf);
  };

  const deleteSemestre = (sIndex) => {
    if (window.confirm("Supprimer ce semestre et toutes ses UEs ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres.splice(sIndex, 1);
      setConfigLocal(newConf);
    }
  };

  const addUE = (sIndex) => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres[sIndex].ues) newConf.semestres[sIndex].ues = [];
    newConf.semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
    setConfigLocal(newConf);
  };

  const deleteUE = (sIndex, uIndex) => {
    if (window.confirm("Supprimer cette UE et toutes ses matières ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres[sIndex].ues.splice(uIndex, 1);
      setConfigLocal(newConf);
    }
  };

  const addMatiere = (sIndex, uIndex) => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres[sIndex].ues[uIndex].matieres) newConf.semestres[sIndex].ues[uIndex].matieres = [];
    newConf.semestres[sIndex].ues[uIndex].matieres.push({
      nom: "Nouvelle Matière",
      listeCM: [], listeTD: [], listeTP: []
    });
    setConfigLocal(newConf);
  };

  const deleteMatiere = (sIndex, uIndex, mIndex) => {
    if (window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1);
      setConfigLocal(newConf);
    }
  };

  const addCM = (sIndex, uIndex, mIndex) => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM = [];
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.push({
      titre: "Nouveau CM",
      jActuel: 0,
      derniereRevision: ""
    });
    setConfigLocal(newConf);
  };

  const deleteCM = (sIndex, uIndex, mIndex, cmIndex) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce CM ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1);
      setConfigLocal(newConf);
    }
  };

  const addTDManuel = (sIndex, uIndex, mIndex) => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD = [];
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.push({
      titre: "Nouveau TD Manuel",
      dernierePratique: "",
      nombrePratiques: 0,
      pdfSource: "",
      page: 1
    });
    setConfigLocal(newConf);
  };

  const deleteTD = (sIndex, uIndex, mIndex, tdIndex) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce TD ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.splice(tdIndex, 1);
      setConfigLocal(newConf);
    }
  };

  const addTPManuel = (sIndex, uIndex, mIndex) => {
    const newConf = deepClone(configLocal);
    if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP = [];
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.push({
      titre: "Nouveau TP Manuel",
      dernierePratique: "",
      nombrePratiques: 0,
      pdfSource: "",
      page: 1
    });
    setConfigLocal(newConf);
  };

  const deleteTP = (sIndex, uIndex, mIndex, tpIndex) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce TP ?")) {
      const newConf = deepClone(configLocal);
      newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.splice(tpIndex, 1);
      setConfigLocal(newConf);
    }
  };

  // Fonctions de mise à jour en ligne — utilisent le callback de setState
  // pour garantir qu'on part toujours du dernier state
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

  const handleFileUpload = async (sIndex, uIndex, mIndex, file, type) => {
    if (!file) return;
    setIsScanning(true);
    const formData = new FormData();
    formData.append('pdfFile', file);
    try {
      const res = await fetch('http://localhost:3001/api/scan-pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.exercises) {
        const newConf = deepClone(configLocal);
        if (type === 'TD') {
          if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD = [];
          newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.push(...data.exercises);
        } else {
          if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP = [];
          newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.push(...data.exercises);
        }
        setConfigLocal(newConf);
        onSave(newConf); // SAUVEGARDE AUTOMATIQUE
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

  // Validation au moment de la sauvegarde
  const handleSave = () => {
    // Vérifier les ECTS et les Noms vides
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
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>Architecture des Cours</h2>
          <p style={{color:'var(--text-secondary)', marginTop:'0.5rem'}}>Gère tes Semestres, Unités d'Enseignement et Matières.</p>
        </div>
        <div style={{display:'flex', gap:'1rem', alignItems: 'center'}}>
          <input 
            type="text"
            placeholder="🔍 Rechercher (Matière, CM, Notes...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '250px'}}
          />
          <button className="btn-secondary" onClick={addSemestre}>+ Ajouter un Semestre</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Synchronisation...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        {/* PLUS de AnimatePresence ici — c'était la cause du démontage des inputs */}
        {configLocal.semestres?.map((semestre, sIndex) => {
          if (!semestreMatchesSearch(semestre)) return null;
          return (
          <div 
            key={`semestre-${sIndex}`} 
            className="card glass-panel" 
            style={{borderLeft:'4px solid var(--accent-primary)', overflow: 'hidden'}}
          >
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
              <div style={{display:'flex', alignItems:'center', gap:'1rem', flex: 1}}>
                <input 
                  type="text" 
                  value={semestre.nom || ''} 
                  onChange={(e) => updateField(['semestres', sIndex, 'nom'], e.target.value)}
                  placeholder="Nom du semestre"
                  style={{fontSize:'1.4rem', fontWeight:'bold', background:'transparent', border:'none', color:'var(--text-primary)', flex: 1}}
                />
                <button onClick={() => deleteSemestre(sIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer ce semestre">🗑️</button>
              </div>
              <button className="btn-secondary" style={{marginLeft:'1rem'}} onClick={() => addUE(sIndex)}>+ Ajouter une UE</button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', marginLeft:'1rem'}}>
              {/* PLUS de AnimatePresence ici non plus */}
              {semestre.ues?.map((ue, uIndex) => {
                if (!ueMatchesSearch(ue)) return null;
                return (
                <div 
                  key={`ue-${sIndex}-${uIndex}`} 
                  style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)', overflow: 'hidden'}}
                >
                  
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'1rem', flex: 1}}>
                      <button onClick={() => deleteUE(sIndex, uIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem'}} title="Supprimer l'UE">🗑️</button>
                      <input 
                        type="text" 
                        value={ue.nom || ''} 
                        onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'nom'], e.target.value)}
                        placeholder="Nom de l'UE (ex: UE1)"
                        style={{fontWeight:'bold', fontSize:'1.1rem'}}
                      />
                      <input 
                        type="number" 
                        value={ue.creditsEcts || 0} 
                        onChange={(e) => {
                          let val = parseInt(e.target.value) || 0;
                          val = Math.min(60, Math.max(0, val)); // Validation ECTS
                          updateField(['semestres', sIndex, 'ues', uIndex, 'creditsEcts'], val);
                        }}
                        placeholder="ECTS"
                        style={{width:'80px'}}
                        title="Crédits ECTS (0-60)"
                      />
                    </div>
                    <button className="btn-secondary" style={{fontSize:'0.9rem'}} onClick={() => addMatiere(sIndex, uIndex)}>+ Ajouter une Matière</button>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem'}}>
                    {/* PLUS de AnimatePresence ici */}
                    {ue.matieres?.map((matiere, mIndex) => {
                      if (!matiereMatchesSearch(matiere)) return null;
                      return (
                      <div 
                        key={`matiere-${sIndex}-${uIndex}-${mIndex}`}
                        style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden'}}
                      >
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem'}}>
                          <button onClick={() => deleteMatiere(sIndex, uIndex, mIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}} title="Supprimer la matière">🗑️</button>
                          <input 
                            type="text" 
                            value={matiere.nom || ''} 
                            onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'nom'], e.target.value)}
                            placeholder="Nom de la matière"
                            style={{flex:1, background:'transparent', borderBottom:'1px solid var(--bg-tertiary)', borderTop:'none', borderLeft:'none', borderRight:'none', borderRadius:0, padding:'0.5rem 0'}}
                          />
                        </div>
                        
                        {/* --- CM SECTION --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>{matiere.listeCM?.length || 0} CM programmés</span>
                          <button className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem'}} onClick={() => addCM(sIndex, uIndex, mIndex)}>+ CM</button>
                        </div>
                        <AnimatePresence>
                          {matiere.listeCM?.map((cm, cmIndex) => (
                            <motion.div 
                              key={`cm-${cmIndex}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.5rem', borderRadius:'4px'}}
                            >
                              <button onClick={() => deleteCM(sIndex, uIndex, mIndex, cmIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}} title="Supprimer ce CM">❌</button>
                              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                                <input 
                                  type="text" 
                                  value={cm.titre}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'titre'], e.target.value)}
                                  placeholder="ex: CM1"
                                  style={{padding:'0.3rem', fontSize:'0.8rem'}}
                                />
                                <input 
                                  type="text"
                                  value={cm.notes || ''}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'notes'], e.target.value)}
                                  placeholder="Notes ou mémos..."
                                  style={{padding:'0.3rem', fontSize:'0.75rem', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-secondary)'}}
                                />
                              </div>
                              <select 
                                value={cm.jActuel}
                                onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeCM', cmIndex, 'jActuel'], parseInt(e.target.value) || 0)}
                                style={{padding:'0.3rem', fontSize:'0.8rem'}}
                              >
                                {J_SEQUENCE.map(j => (
                                  <option key={j} value={j}>J{j}</option>
                                ))}
                              </select>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* --- TD SECTION --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--success-color)'}}>{matiere.listeTD?.length || 0} TD créés/scannés</span>
                          <div style={{display:'flex', gap:'0.5rem'}}>
                            <button onClick={() => addTDManuel(sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>+ Manuel</button>
                            <input 
                              type="file" 
                              accept="application/pdf"
                              id={`td-upload-${sIndex}-${uIndex}-${mIndex}`}
                              style={{display:'none'}}
                              onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TD')}
                              disabled={isScanning}
                            />
                            <label htmlFor={`td-upload-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor: isScanning ? 'not-allowed' : 'pointer', color:'var(--success-color)', border:'1px solid var(--success-glow)', opacity: isScanning ? 0.5 : 1}}>
                              {isScanning ? 'Scan en cours ⏳...' : 'Scanner PDF'}
                            </label>
                          </div>
                        </div>
                        <AnimatePresence>
                          {matiere.listeTD?.map((td, tdIndex) => (
                            <motion.div 
                              key={`td-${tdIndex}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(52, 211, 153, 0.05)', padding:'0.5rem', borderRadius:'4px'}}
                            >
                              <button onClick={() => deleteTD(sIndex, uIndex, mIndex, tdIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
                              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                                <input 
                                  type="text" 
                                  value={td.titre}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'titre'], e.target.value)}
                                  placeholder="Nom de l'exercice"
                                  style={{padding:'0.3rem', fontSize:'0.8rem'}}
                                />
                                <input 
                                  type="text"
                                  value={td.notes || ''}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTD', tdIndex, 'notes'], e.target.value)}
                                  placeholder="Notes ou mémos..."
                                  style={{padding:'0.3rem', fontSize:'0.75rem', background: 'transparent', border: '1px dashed rgba(52, 211, 153, 0.2)', color: 'var(--text-secondary)'}}
                                />
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* --- TP SECTION --- */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
                          <span style={{fontSize:'0.9rem', color:'var(--warning-color)'}}>{matiere.listeTP?.length || 0} TP créés/scannés</span>
                          <div style={{display:'flex', gap:'0.5rem'}}>
                            <button onClick={() => addTPManuel(sIndex, uIndex, mIndex)} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>+ Manuel</button>
                            <input 
                              type="file" 
                              accept="application/pdf"
                              id={`tp-upload-${sIndex}-${uIndex}-${mIndex}`}
                              style={{display:'none'}}
                              onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TP')}
                              disabled={isScanning}
                            />
                            <label htmlFor={`tp-upload-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor: isScanning ? 'not-allowed' : 'pointer', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)', opacity: isScanning ? 0.5 : 1}}>
                              {isScanning ? 'Scan en cours ⏳...' : 'Scanner PDF'}
                            </label>
                          </div>
                        </div>
                        <AnimatePresence>
                          {matiere.listeTP?.map((tp, tpIndex) => (
                            <motion.div 
                              key={`tp-${tpIndex}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(251, 191, 36, 0.05)', padding:'0.5rem', borderRadius:'4px'}}
                            >
                              <button onClick={() => deleteTP(sIndex, uIndex, mIndex, tpIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}}>❌</button>
                              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                                <input 
                                  type="text" 
                                  value={tp.titre}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'titre'], e.target.value)}
                                  placeholder="Nom de l'exercice"
                                  style={{padding:'0.3rem', fontSize:'0.8rem'}}
                                />
                                <input 
                                  type="text"
                                  value={tp.notes || ''}
                                  onChange={(e) => updateField(['semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, 'listeTP', tpIndex, 'notes'], e.target.value)}
                                  placeholder="Notes ou mémos..."
                                  style={{padding:'0.3rem', fontSize:'0.75rem', background: 'transparent', border: '1px dashed rgba(245, 158, 11, 0.2)', color: 'var(--text-secondary)'}}
                                />
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        
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
