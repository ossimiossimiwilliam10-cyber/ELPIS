import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function CoursPage({ coursConfig, onSave, saving }) {
  const [configLocal, setConfigLocal] = useState(coursConfig || { semestres: [] });

  const updateConfig = (newConf) => {
    setConfigLocal(newConf);
  };

  const addSemestre = () => {
    const newConf = { ...configLocal };
    if (!newConf.semestres) newConf.semestres = [];
    newConf.semestres.push({ nom: `Semestre ${newConf.semestres.length + 1}`, ues: [] });
    updateConfig(newConf);
  };

  const deleteSemestre = (sIndex) => {
    if (window.confirm("Supprimer ce semestre et toutes ses UEs ?")) {
      const newConf = { ...configLocal };
      newConf.semestres.splice(sIndex, 1);
      updateConfig(newConf);
    }
  };

  const addUE = (sIndex) => {
    const newConf = { ...configLocal };
    if (!newConf.semestres[sIndex].ues) newConf.semestres[sIndex].ues = [];
    newConf.semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
    updateConfig(newConf);
  };

  const deleteUE = (sIndex, uIndex) => {
    if (window.confirm("Supprimer cette UE et toutes ses matières ?")) {
      const newConf = { ...configLocal };
      newConf.semestres[sIndex].ues.splice(uIndex, 1);
      updateConfig(newConf);
    }
  };

  const addMatiere = (sIndex, uIndex) => {
    const newConf = { ...configLocal };
    if (!newConf.semestres[sIndex].ues[uIndex].matieres) newConf.semestres[sIndex].ues[uIndex].matieres = [];
    newConf.semestres[sIndex].ues[uIndex].matieres.push({
      nom: "Nouvelle Matière",
      listeCM: [], listeTD: [], listeTP: []
    });
    updateConfig(newConf);
  };

  const deleteMatiere = (sIndex, uIndex, mIndex) => {
    if (window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) {
      const newConf = { ...configLocal };
      newConf.semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1);
      updateConfig(newConf);
    }
  };

  const addCM = (sIndex, uIndex, mIndex) => {
    const newConf = { ...configLocal };
    if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM = [];
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.push({
      titre: "Nouveau CM",
      jActuel: 0,
      derniereRevision: ""
    });
    updateConfig(newConf);
  };

  const deleteCM = (sIndex, uIndex, mIndex, cmIndex) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1);
    updateConfig(newConf);
  };

  const updateNomMatiere = (sIndex, uIndex, mIndex, val) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].nom = val;
    updateConfig(newConf);
  };

  const updateNomUE = (sIndex, uIndex, val) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues[uIndex].nom = val;
    updateConfig(newConf);
  };

  const handleFileUpload = async (sIndex, uIndex, mIndex, file, type) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('pdfFile', file);
    try {
      const res = await fetch('http://localhost:3001/api/scan-pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.exercises) {
        const newConf = {...configLocal};
        if (type === 'TD') {
          if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD = [];
          newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.push(...data.exercises);
        } else {
          if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP) newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP = [];
          newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.push(...data.exercises);
        }
        updateConfig(newConf);
        alert(`${data.exercises.length} exercices trouvés et ajoutés !`);
      }
    } catch(err) {
      alert("Erreur lors du scan du PDF.");
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, height: 0, scale: 0.95 },
    show: { opacity: 1, height: 'auto', scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  return (
    <div className="cours-page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <div>
          <h2 style={{margin:0}}>Architecture des Cours</h2>
          <p style={{color:'var(--text-secondary)', marginTop:'0.5rem'}}>Gère tes Semestres, Unités d'Enseignement et Matières.</p>
        </div>
        <div style={{display:'flex', gap:'1rem'}}>
          <button className="btn-secondary" onClick={addSemestre}>+ Ajouter un Semestre</button>
          <button className="btn-primary" onClick={() => onSave(configLocal)} disabled={saving}>
            {saving ? 'Synchronisation...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        <AnimatePresence>
          {configLocal.semestres?.map((semestre, sIndex) => (
            <motion.div 
              key={sIndex + (semestre.nom || '')} 
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="card glass-panel" 
              style={{borderLeft:'4px solid var(--accent-primary)', overflow: 'hidden'}}
            >
              
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                <div style={{display:'flex', alignItems:'center', gap:'1rem', flex: 1}}>
                  <input 
                    type="text" 
                    value={semestre.nom || ''} 
                    onChange={(e) => {
                      const newConf = {...configLocal};
                      newConf.semestres[sIndex].nom = e.target.value;
                      updateConfig(newConf);
                    }}
                    placeholder="Nom du semestre"
                    style={{fontSize:'1.4rem', fontWeight:'bold', background:'transparent', border:'none', color:'var(--text-primary)', flex: 1}}
                  />
                  <button onClick={() => deleteSemestre(sIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer ce semestre">🗑️</button>
                </div>
                <button className="btn-secondary" style={{marginLeft:'1rem'}} onClick={() => addUE(sIndex)}>+ Ajouter une UE</button>
              </div>

              <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', marginLeft:'1rem'}}>
                <AnimatePresence>
                  {semestre.ues?.map((ue, uIndex) => (
                    <motion.div 
                      key={uIndex + (ue.nom || '')} 
                      variants={itemVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)', overflow: 'hidden'}}
                    >
                      
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'1rem', flex: 1}}>
                          <button onClick={() => deleteUE(sIndex, uIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem'}} title="Supprimer l'UE">🗑️</button>
                          <input 
                            type="text" 
                            value={ue.nom || ''} 
                            onChange={(e) => updateNomUE(sIndex, uIndex, e.target.value)}
                            placeholder="Nom de l'UE (ex: UE1)"
                            style={{fontWeight:'bold', fontSize:'1.1rem'}}
                          />
                          <input 
                            type="number" 
                            value={ue.creditsEcts || 0} 
                            onChange={(e) => {
                              const newConf = {...configLocal};
                              newConf.semestres[sIndex].ues[uIndex].creditsEcts = parseInt(e.target.value) || 0;
                              updateConfig(newConf);
                            }}
                            placeholder="ECTS"
                            style={{width:'80px'}}
                            title="Crédits ECTS"
                          />
                        </div>
                        <button className="btn-secondary" style={{fontSize:'0.9rem'}} onClick={() => addMatiere(sIndex, uIndex)}>+ Ajouter une Matière</button>
                      </div>

                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem'}}>
                        <AnimatePresence>
                          {ue.matieres?.map((matiere, mIndex) => (
                            <motion.div 
                              key={mIndex + (matiere.nom || '')}
                              variants={itemVariants}
                              initial="hidden"
                              animate="show"
                              exit="exit"
                              style={{background:'rgba(15, 23, 42, 0.4)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden'}}
                            >
                              <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem'}}>
                                <button onClick={() => deleteMatiere(sIndex, uIndex, mIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1rem', padding:0}} title="Supprimer la matière">🗑️</button>
                                <input 
                                  type="text" 
                                  value={matiere.nom || ''} 
                                  onChange={(e) => updateNomMatiere(sIndex, uIndex, mIndex, e.target.value)}
                                  placeholder="Nom de la matière"
                                  style={{flex:1, background:'transparent', borderBottom:'1px solid var(--bg-tertiary)', borderTop:'none', borderLeft:'none', borderRight:'none', borderRadius:0, padding:'0.5rem 0'}}
                                />
                              </div>
                              
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
                                <span style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>{matiere.listeCM?.length || 0} CM programmés</span>
                                <button className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem'}} onClick={() => addCM(sIndex, uIndex, mIndex)}>+ CM</button>
                              </div>
                              
                              <AnimatePresence>
                                {matiere.listeCM?.map((cm, cmIndex) => (
                                  <motion.div 
                                    key={cmIndex + (cm.titre || '')}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'0.5rem', borderRadius:'4px'}}
                                  >
                                    <button onClick={() => deleteCM(sIndex, uIndex, mIndex, cmIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--danger-color)', padding:0}} title="Supprimer ce CM">❌</button>
                                    <input 
                                      type="text" 
                                      value={cm.titre}
                                      onChange={(e) => {
                                        const newConf = {...configLocal};
                                        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].titre = e.target.value;
                                        updateConfig(newConf);
                                      }}
                                      placeholder="ex: CM1"
                                      style={{flex: 1, padding:'0.3rem', fontSize:'0.8rem'}}
                                    />
                                    <select 
                                      value={cm.jActuel}
                                      onChange={(e) => {
                                        const newConf = {...configLocal};
                                        newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].jActuel = parseInt(e.target.value) || 0;
                                        updateConfig(newConf);
                                      }}
                                      style={{padding:'0.3rem', fontSize:'0.8rem'}}
                                    >
                                      <option value={0}>J0</option>
                                      <option value={1}>J1</option>
                                      <option value={3}>J3</option>
                                      <option value={7}>J7</option>
                                      <option value={14}>J14</option>
                                    </select>
                                  </motion.div>
                                ))}
                              </AnimatePresence>

                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', marginTop:'1rem'}}>
                                <span style={{fontSize:'0.9rem', color:'var(--success-color)'}}>{matiere.listeTD?.length || 0} TD scannés</span>
                                <div>
                                  <input 
                                    type="file" 
                                    accept="application/pdf"
                                    id={`td-upload-${sIndex}-${uIndex}-${mIndex}`}
                                    style={{display:'none'}}
                                    onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TD')}
                                  />
                                  <label htmlFor={`td-upload-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor:'pointer', color:'var(--success-color)', border:'1px solid var(--success-glow)'}}>
                                    Scanner PDF TD
                                  </label>
                                </div>
                              </div>

                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span style={{fontSize:'0.9rem', color:'var(--warning-color)'}}>{matiere.listeTP?.length || 0} TP scannés</span>
                                <div>
                                  <input 
                                    type="file" 
                                    accept="application/pdf"
                                    id={`tp-upload-${sIndex}-${uIndex}-${mIndex}`}
                                    style={{display:'none'}}
                                    onChange={(e) => handleFileUpload(sIndex, uIndex, mIndex, e.target.files[0], 'TP')}
                                  />
                                  <label htmlFor={`tp-upload-${sIndex}-${uIndex}-${mIndex}`} className="btn-secondary" style={{padding:'0.3rem 0.6rem', fontSize:'0.8rem', cursor:'pointer', color:'var(--warning-color)', border:'1px solid rgba(245, 158, 11, 0.4)'}}>
                                    Scanner PDF TP
                                  </label>
                                </div>
                              </div>
                              
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default CoursPage;
