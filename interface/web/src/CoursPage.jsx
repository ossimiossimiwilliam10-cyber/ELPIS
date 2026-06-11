import { useState } from 'react';

function CoursPage({ coursConfig, onSave, saving }) {
  const [configLocal, setConfigLocal] = useState(coursConfig || { semestres: [] });

  const updateConfig = (newConf) => {
    setConfigLocal(newConf);
  };

  const addSemestre = () => {
    const newConf = { ...configLocal };
    newConf.semestres.push({ nom: `Nouveau Semestre ${newConf.semestres.length + 1}`, ues: [] });
    updateConfig(newConf);
  };

  const addUE = (sIndex) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
    updateConfig(newConf);
  };

  const addMatiere = (sIndex, uIndex) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues[uIndex].matieres.push({
      nom: "Nouvelle Matière",
      cm_h: 0, td_h: 0, tp_h: 0,
      listeCM: []
    });
    updateConfig(newConf);
  };

  const addCM = (sIndex, uIndex, mIndex) => {
    const newConf = { ...configLocal };
    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.push({
      titre: "Nouveau CM",
      jActuel: 0,
      derniereRevision: ""
    });
    updateConfig(newConf);
  };

  return (
    <div className="cours-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <h2>Programme d'Études</h2>
        <button className="btn-primary" onClick={() => onSave(configLocal)} disabled={saving}>
          {saving ? 'Synchronisation C++...' : 'Sauvegarder les Cours'}
        </button>
      </div>

      <button className="btn-secondary" onClick={addSemestre} style={{marginBottom:'1rem'}}>+ Ajouter un Semestre</button>

      <div className="semestres-list">
        {configLocal.semestres.map((semestre, sIndex) => (
          <div key={sIndex} className="card glass-panel" style={{marginBottom:'2rem', border:'1px solid var(--bg-tertiary)'}}>
            <div className="form-group" style={{display:'flex', gap:'1rem', alignItems:'center'}}>
              <h3 style={{margin:0}}>Semestre</h3>
              <input 
                type="text" 
                value={semestre.nom} 
                onChange={(e) => {
                  const newConf = {...configLocal};
                  newConf.semestres[sIndex].nom = e.target.value;
                  updateConfig(newConf);
                }}
                style={{flex: 1}}
              />
              <button className="btn-secondary" onClick={() => addUE(sIndex)}>+ UE</button>
            </div>

            <div className="ues-list" style={{paddingLeft:'1rem', marginTop:'1rem', borderLeft:'2px solid var(--bg-tertiary)'}}>
              {semestre.ues.map((ue, uIndex) => (
                <div key={uIndex} className="ue-card" style={{marginBottom:'1.5rem', padding:'1rem', background:'var(--bg-secondary)', borderRadius:'8px'}}>
                  <div className="form-group" style={{display:'flex', gap:'1rem', alignItems:'center', marginBottom:'1rem'}}>
                    <h4 style={{margin:0, color:'var(--text-secondary)'}}>UE</h4>
                    <input 
                      type="text" 
                      value={ue.nom}
                      onChange={(e) => {
                        const newConf = {...configLocal};
                        newConf.semestres[sIndex].ues[uIndex].nom = e.target.value;
                        updateConfig(newConf);
                      }}
                      style={{flex: 2}}
                    />
                    <input 
                      type="number" 
                      title="ECTS"
                      placeholder="ECTS"
                      value={ue.ects}
                      onChange={(e) => {
                        const newConf = {...configLocal};
                        newConf.semestres[sIndex].ues[uIndex].ects = parseInt(e.target.value) || 0;
                        updateConfig(newConf);
                      }}
                      style={{width: '80px'}}
                    /> ECTS
                    <button className="btn-secondary" onClick={() => addMatiere(sIndex, uIndex)}>+ Matière</button>
                  </div>

                  <div className="matieres-list">
                    {ue.matieres.map((matiere, mIndex) => (
                      <div key={mIndex} className="matiere-card" style={{background:'var(--bg-primary)', padding:'1rem', borderRadius:'6px', marginBottom:'1rem'}}>
                        <div style={{display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'center'}}>
                          <input 
                            type="text" 
                            value={matiere.nom}
                            onChange={(e) => {
                              const newConf = {...configLocal};
                              newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].nom = e.target.value;
                              updateConfig(newConf);
                            }}
                            placeholder="Nom de la matière"
                            style={{fontWeight:'bold'}}
                          />
                          <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                            <span style={{color:'var(--text-secondary)'}}>Heures globales :</span>
                            <input type="number" title="TD" placeholder="TD" value={matiere.td_h} style={{width:'60px'}} 
                              onChange={(e) => {
                                const newConf = {...configLocal};
                                newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].td_h = parseInt(e.target.value) || 0;
                                updateConfig(newConf);
                              }}
                            /> TD
                            <input type="number" title="TP" placeholder="TP" value={matiere.tp_h} style={{width:'60px'}} 
                              onChange={(e) => {
                                const newConf = {...configLocal};
                                newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].tp_h = parseInt(e.target.value) || 0;
                                updateConfig(newConf);
                              }}
                            /> TP
                          </div>
                          <button className="btn-secondary" style={{marginLeft:'auto', fontSize:'0.8rem'}} onClick={() => addCM(sIndex, uIndex, mIndex)}>+ Ajouter un CM</button>
                        </div>

                        <div style={{display:'flex', gap:'1rem', marginTop:'0.5rem'}}>
                            <label style={{cursor:'pointer', fontSize:'0.8rem', color:'#34D399', textDecoration:'underline'}}>
                                📄 Scanner un TD (PDF)
                                <input 
                                    type="file" 
                                    accept="application/pdf" 
                                    style={{display:'none'}}
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
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
                                                if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD) {
                                                    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD = [];
                                                }
                                                // Add found exercises
                                                newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.push(...data.exercises);
                                                updateConfig(newConf);
                                                alert(`${data.exercises.length} exercices trouvés et ajoutés !`);
                                            }
                                        } catch(err) {
                                            alert("Erreur lors du scan du PDF TD.");
                                        }
                                    }}
                                />
                            </label>
                            
                            <label style={{cursor:'pointer', fontSize:'0.8rem', color:'#FBBF24', textDecoration:'underline'}}>
                                📄 Scanner un TP (PDF)
                                <input 
                                    type="file" 
                                    accept="application/pdf" 
                                    style={{display:'none'}}
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
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
                                                if (!newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP) {
                                                    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP = [];
                                                }
                                                newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.push(...data.exercises);
                                                updateConfig(newConf);
                                                alert(`${data.exercises.length} exercices de TP trouvés et ajoutés !`);
                                            }
                                        } catch(err) {
                                            alert("Erreur lors du scan du PDF TP.");
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        {/* List of scanned TD exercises */}
                        {matiere.listeTD && matiere.listeTD.length > 0 && (
                            <div style={{marginTop:'0.5rem', fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                                ✓ {matiere.listeTD.length} exercices TD scannés en attente.
                            </div>
                        )}
                        {matiere.listeTP && matiere.listeTP.length > 0 && (
                            <div style={{marginTop:'0.5rem', fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                                ✓ {matiere.listeTP.length} exercices TP scannés en attente.
                            </div>
                        )}

                        {/* Liste des CM avec méthode des J */}
                        {matiere.listeCM && matiere.listeCM.length > 0 && (
                          <div style={{marginTop:'1rem', padding:'0.5rem', border:'1px dashed var(--bg-tertiary)', borderRadius:'4px'}}>
                            <h5 style={{margin:'0 0 0.5rem 0', color:'#A78BFA'}}>🧠 Suivi des CM (Répétition Espacée)</h5>
                            {matiere.listeCM.map((cm, cmIndex) => (
                              <div key={cmIndex} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center'}}>
                                <input 
                                  type="text" 
                                  value={cm.titre}
                                  onChange={(e) => {
                                    const newConf = {...configLocal};
                                    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].titre = e.target.value;
                                    updateConfig(newConf);
                                  }}
                                  placeholder="ex: CM1 - Algèbre Linéaire"
                                  style={{flex: 1, padding:'0.4rem'}}
                                />
                                <span style={{color:'var(--text-secondary)'}}>Intervalle :</span>
                                <select 
                                  value={cm.jActuel}
                                  onChange={(e) => {
                                    const newConf = {...configLocal};
                                    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].jActuel = parseInt(e.target.value) || 0;
                                    updateConfig(newConf);
                                  }}
                                  style={{padding:'0.4rem', borderRadius:'4px', background:'var(--bg-tertiary)', color:'white', border:'none'}}
                                >
                                  <option value={0}>J0 (Nouveau)</option>
                                  <option value={1}>J1 (Revu 1 fois)</option>
                                  <option value={3}>J3</option>
                                  <option value={7}>J7</option>
                                  <option value={14}>J14</option>
                                  <option value={30}>J30</option>
                                  <option value={60}>J60</option>
                                  <option value={2190}>J2190 (6 ans)</option>
                                </select>
                                <input 
                                  type="date"
                                  title="Dernière révision"
                                  value={cm.derniereRevision}
                                  onChange={(e) => {
                                    const newConf = {...configLocal};
                                    newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].derniereRevision = e.target.value;
                                    updateConfig(newConf);
                                  }}
                                  style={{padding:'0.4rem'}}
                                />
                                {/* Section PDF */}
                                <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginLeft:'auto'}}>
                                  {!cm.fichePdfPath ? (
                                    <label style={{cursor:'pointer', fontSize:'0.8rem', color:'#60A5FA', textDecoration:'underline'}}>
                                      📎 Uploader PDF
                                      <input 
                                        type="file" 
                                        accept="application/pdf" 
                                        style={{display:'none'}}
                                        onChange={async (e) => {
                                          const file = e.target.files[0];
                                          if (!file) return;
                                          const formData = new FormData();
                                          formData.append('pdfFile', file);
                                          try {
                                            const res = await fetch('http://localhost:3001/api/upload-pdf', {
                                              method: 'POST',
                                              body: formData
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                              const newConf = {...configLocal};
                                              newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].fichePdfPath = data.url;
                                              updateConfig(newConf);
                                            }
                                          } catch(err) {
                                            alert("Erreur upload");
                                          }
                                        }}
                                      />
                                    </label>
                                  ) : (
                                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                                      <a href={`http://localhost:3001${cm.fichePdfPath}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{fontSize:'0.7rem', padding:'0.2rem 0.5rem'}}>
                                        📄 Voir la Fiche
                                      </a>
                                      <button 
                                        onClick={() => {
                                          const newConf = {...configLocal};
                                          newConf.semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[cmIndex].fichePdfPath = "";
                                          updateConfig(newConf);
                                        }}
                                        style={{background:'transparent', border:'none', color:'red', cursor:'pointer'}}
                                        title="Supprimer la fiche"
                                      >
                                        ✖
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {configLocal.semestres.length === 0 && (
          <div style={{textAlign:'center', color:'var(--text-secondary)', padding:'2rem'}}>
            Aucun semestre configuré. Cliquez sur "+ Ajouter un Semestre".
          </div>
        )}
      </div>
    </div>
  );
}

export default CoursPage;
