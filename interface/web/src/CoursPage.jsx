import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';
import MarkdownModal from './MarkdownModal';
import EditableLabel from './components/cours/EditableLabel';
import MatiereCard from './components/cours/MatiereCard';

// Deep clone helper
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

function CoursPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const [configLocal, setConfigLocal] = useState(() => deepClone(coursConfig || { licences: [] }));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLicenceIndex, setActiveLicenceIndex] = useState(0);
  const [activeSemestreIndex, setActiveSemestreIndex] = useState(0);
  const [collapsedUEs, setCollapsedUEs] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });

  const toggleUE = (lIndex, sIndex, uIndex) => {
    const key = `${lIndex}-${sIndex}-${uIndex}`;
    setCollapsedUEs(prev => ({...prev, [key]: !prev[key]}));
  };

  // Resynchroniser le state local quand le parent change (ex: import backup)
  useEffect(() => {
    if (coursConfig) {
      setConfigLocal(deepClone(coursConfig));
    }
  }, [coursConfig]);

  // Écouter la recherche globale (Ctrl+K) pour naviguer vers l'élément trouvé
  useEffect(() => {
    const handleSearchSelect = (e) => {
      const item = e.detail;
      if (item.lIndex !== undefined) {
        setActiveLicenceIndex(item.lIndex);
        setActiveSemestreIndex(item.sIndex || 0);
        if (item.uIndex !== undefined) {
          // Déployer l'UE cible
          const key = `${item.lIndex}-${item.sIndex || 0}-${item.uIndex}`;
          setCollapsedUEs(prev => ({ ...prev, [key]: false }));
        }
      }
    };
    window.addEventListener('elpisSearchSelect', handleSearchSelect);
    return () => window.removeEventListener('elpisSearchSelect', handleSearchSelect);
  }, []);

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
    if (m.listeAnnales?.some(annale => matchesSearch(annale.titre) || matchesSearch(annale.notes))) return true;
    return false;
  };
  const semestreMatchesSearch = (semestre) => matchesSearch(semestre.nom) || semestre.ues?.some(ue => ueMatchesSearch(ue));
  const licenceMatchesSearch = (licence) => matchesSearch(licence.nom) || licence.semestres?.some(s => semestreMatchesSearch(s));

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

  const addLicence = () => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.licences) newConf.licences = [];
      newConf.licences.push({ nom: `Licence ${newConf.licences.length + 1}`, semestres: [] });
      setCoursConfig(newConf); // Auto-save
      return newConf;
    });
    setActiveLicenceIndex(configLocal.licences ? configLocal.licences.length : 0);
    setActiveSemestreIndex(0);
  };

  const deleteLicence = (lIndex) => {
    if (window.confirm("Supprimer cette licence et tous ses semestres ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences.splice(lIndex, 1);
        setCoursConfig(newConf); // Auto-save
        return newConf;
      });
      if (activeLicenceIndex === lIndex) {
        setActiveLicenceIndex(Math.max(0, lIndex - 1));
        setActiveSemestreIndex(0);
      } else if (activeLicenceIndex > lIndex) {
        setActiveLicenceIndex(activeLicenceIndex - 1);
      }
    }
  };

  const addSemestre = (lIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.licences[lIndex].semestres) newConf.licences[lIndex].semestres = [];
      newConf.licences[lIndex].semestres.push({ nom: `Semestre ${newConf.licences[lIndex].semestres.length + 1}`, ues: [] });
      setCoursConfig(newConf); // Auto-save
      return newConf;
    });
    setActiveSemestreIndex(configLocal.licences[lIndex].semestres ? configLocal.licences[lIndex].semestres.length : 0);
  };

  const deleteSemestre = (lIndex, sIndex) => {
    if (window.confirm("Supprimer ce semestre et toutes ses UEs ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres.splice(sIndex, 1);
        setCoursConfig(newConf); // Auto-save
        return newConf;
      });
      if (activeSemestreIndex === sIndex) {
        setActiveSemestreIndex(Math.max(0, sIndex - 1));
      } else if (activeSemestreIndex > sIndex) {
        setActiveSemestreIndex(activeSemestreIndex - 1);
      }
    }
  };

  const addUE = (lIndex, sIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      if (!newConf.licences[lIndex].semestres[sIndex].ues) newConf.licences[lIndex].semestres[sIndex].ues = [];
      newConf.licences[lIndex].semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteUE = (lIndex, sIndex, uIndex) => {
    if (window.confirm("Supprimer cette UE et toutes ses matières ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues.splice(uIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addMatiere = (lIndex, sIndex, uIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const newMatiere = { nom: "Nouvelle Matière", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] };
      if(!newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres) newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres = [];
      newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres.push(newMatiere);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteMatiere = (lIndex, sIndex, uIndex, mIndex) => {
    if (window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addCM = (lIndex, sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const mat = newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeCM) mat.listeCM = [];
      const newCM = { titre: "Nouveau CM", jActuel: 0, derniereRevision: "", easeFactor: 2.5, repetitions: 0 };
      mat.listeCM.push(newCM);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteCM = (lIndex, sIndex, uIndex, mIndex, cmIndex) => {
    if (window.confirm("Supprimer ce CM ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addTDManuel = (lIndex, sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const m = newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if(!m.listeTD) m.listeTD = [];
      m.listeTD.push({ titre: "Nouveau TD Manuel", dernierePratique: "", nombrePratiques: 0, notes: "" });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteTD = (lIndex, sIndex, uIndex, mIndex, tdIndex) => {
    if (window.confirm("Supprimer ce TD ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.splice(tdIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addTPManuel = (lIndex, sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const m = newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if(!m.listeTP) m.listeTP = [];
      m.listeTP.push({ titre: "Nouveau TP Manuel", dernierePratique: "", nombrePratiques: 0, notes: "" });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteTP = (lIndex, sIndex, uIndex, mIndex, tpIndex) => {
    if (window.confirm("Supprimer ce TP ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.splice(tpIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
  };

  const addAnnaleManuel = (lIndex, sIndex, uIndex, mIndex) => {
    setConfigLocal(prev => {
      const newConf = deepClone(prev);
      const m = newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if(!m.listeAnnales) m.listeAnnales = [];
      m.listeAnnales.push({ titre: "Nouvelle Annale", dernierePratique: "", nombrePratiques: 0, notes: "" });
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const deleteAnnale = (lIndex, sIndex, uIndex, mIndex, annaleIndex) => {
    if (window.confirm("Supprimer cette Annale ?")) {
      setConfigLocal(prev => {
        const newConf = deepClone(prev);
        newConf.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeAnnales.splice(annaleIndex, 1);
        setCoursConfig(newConf);
        return newConf;
      });
    }
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


  return (
    <div className="cours-page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem'}}>
        <div>
          <h2 style={{margin:0}}>Bibliothèque de Cours</h2>
          <p style={{color:'var(--text-secondary)', marginTop:'0.5rem'}}>Configure ton année scolaire : Semestres, UEs, et Matières.</p>
        </div>
        <div style={{display:'flex', gap:'1rem', alignItems: 'center', flexWrap:'wrap'}}>
          <input 
            type="text"
            placeholder="🔍 Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '220px'}}
          />
          <button onClick={addLicence} className="btn-secondary" style={{padding:'0.4rem 0.8rem'}}>+ Licence</button>
        </div>
      </div>

      <div style={{color:'var(--text-secondary)', fontSize:'0.9rem', fontStyle:'italic', marginTop:'1rem', textAlign:'right'}}>
        Sauvegarde automatique activée
      </div>

      <div className="licence-tabs" style={{display:'flex', gap:'1.5rem', marginBottom:'1rem', borderBottom:'1px solid var(--bg-tertiary)', paddingBottom:'0.5rem'}}>
        {configLocal.licences?.map((licence, lIndex) => (
          <button 
            key={`lic-${lIndex}`} 
            className={`tab-btn ${activeLicenceIndex === lIndex ? 'active' : ''}`}
            onClick={() => { setActiveLicenceIndex(lIndex); setActiveSemestreIndex(0); }}
            style={{fontSize:'1.1rem', fontWeight: activeLicenceIndex === lIndex ? 'bold' : 'normal'}}
          >
            {licence.nom}
          </button>
        ))}
        <button className="tab-btn" onClick={addLicence} style={{color:'var(--accent-primary)', fontSize:'1.1rem'}}>+ Licence</button>
      </div>

      {configLocal.licences && configLocal.licences[activeLicenceIndex] && (() => {
        const lIndex = activeLicenceIndex;
        const licence = configLocal.licences[lIndex];
        if (!licenceMatchesSearch(licence)) return null;
        
        return (
          <div key={`l-${lIndex}`}>
            {/* === LICENCE HEADER === */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
              <EditableLabel 
                value={licence.nom} 
                onRename={(v) => updateField(['licences', lIndex, 'nom'], v)}
                placeholder="Nom de la licence"
                style={{fontSize:'1.8rem', fontWeight:'bold', flex: 1}}
              />
              <button onClick={() => deleteLicence(lIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer la licence">🗑️</button>
            </div>

            <div className="semestre-tabs" style={{display:'flex', gap:'1.5rem'}}>
              {licence.semestres?.map((semestre, sIndex) => (
                <button 
                  key={`tab-${sIndex}`} 
                  className={`tab-btn ${activeSemestreIndex === sIndex ? 'active' : ''}`}
                  onClick={() => setActiveSemestreIndex(sIndex)}
                >
                  {semestre.nom}
                </button>
              ))}
              <button className="tab-btn" onClick={() => addSemestre(lIndex)} style={{color:'var(--accent-primary)'}}>+ Semestre</button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'2rem', marginTop:'1.5rem'}}>
              {licence.semestres && licence.semestres[activeSemestreIndex] && (() => {
                const sIndex = activeSemestreIndex;
                const semestre = licence.semestres[sIndex];
                if (!semestreMatchesSearch(semestre)) return null;
                return (
                <div key={`s-${sIndex}`} className="card glass-panel" style={{borderLeft:'4px solid var(--accent-primary)'}}>
                  
                  {/* === SEMESTRE HEADER === */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                    <EditableLabel 
                      value={semestre.nom} 
                      onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'nom'], v)}
                      placeholder="Nom du semestre"
                      style={{fontSize:'1.4rem', fontWeight:'bold', flex: 1}}
                    />
                    <div style={{display:'flex', gap:'0.5rem', marginLeft:'1rem'}}>
                      <button className="btn-secondary" onClick={() => addUE(lIndex, sIndex)}>+ UE</button>
                      <button onClick={() => deleteSemestre(lIndex, sIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer">🗑️</button>
                    </div>
                  </div>

                  {/* === UES === */}
                  <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', marginLeft:'1rem'}}>
                    {semestre.ues?.map((ue, uIndex) => {
                      if (!ueMatchesSearch(ue)) return null;
                      const isCollapsed = collapsedUEs[`${lIndex}-${sIndex}-${uIndex}`];
                      
                      let ueTotalExos = 0;
                      let ueTotalCMs = 0;
                      ue.matieres?.forEach(m => {
                        ueTotalCMs += (m.listeCM?.length || 0);
                        ueTotalExos += (m.listeTD?.length || 0) + (m.listeTP?.length || 0);
                      });

                      return (
                      <div key={`u-${sIndex}-${uIndex}`} style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)'}}>
                        
                        {/* UE HEADER */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isCollapsed ? '0' : '1rem'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flex: 1}}>
                            <button 
                              className={`ue-accordion-btn ${!isCollapsed ? 'open' : ''}`} 
                              onClick={() => toggleUE(lIndex, sIndex, uIndex)}
                              title={isCollapsed ? "Développer" : "Réduire"}
                            >
                              🔽
                            </button>
                            <button onClick={() => deleteUE(lIndex, sIndex, uIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem'}} title="Supprimer l'UE">🗑️</button>
                            <EditableLabel 
                              value={ue.nom}
                              onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'nom'], v)}
                              placeholder="Nom de l'UE"
                              style={{fontWeight:'bold', fontSize:'1.1rem', flex: 1}}
                            />
                            <div style={{display:'flex', alignItems:'center', gap:'0.3rem', flexShrink: 0}}>
                              <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>ECTS:</span>
                              <input 
                                type="number" 
                                value={ue.ects || 0} 
                                onChange={(e) => {
                                  let val = parseInt(e.target.value) || 0;
                                  val = Math.min(60, Math.max(0, val));
                                  updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'ects'], val);
                                }}
                                style={{width:'60px', padding:'0.3rem'}}
                                title="Crédits ECTS (0-60)"
                              />
                            </div>
                          </div>
                          
                          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                            {isCollapsed && (
                              <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                                {ue.matieres?.length || 0} Matière(s) • {ueTotalCMs} CM(s) • {ueTotalExos} Exercice(s)
                              </span>
                            )}
                            <button className="btn-secondary" style={{fontSize:'0.9rem'}} onClick={() => { if(isCollapsed) toggleUE(lIndex, sIndex, uIndex); addMatiere(lIndex, sIndex, uIndex); }}>+ Matière</button>
                          </div>
                        </div>

                        {/* MATIERES GRID (Accordion Content) */}
                        <div className={`ue-accordion-content ${isCollapsed ? 'closed' : 'open'}`}>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem'}}>
                          {ue.matieres?.map((matiere, mIndex) => {
                            if (!matiereMatchesSearch(matiere)) return null;
                            return (
                            <MatiereCard
                              key={`m-${sIndex}-${uIndex}-${mIndex}`}
                              matiere={matiere}
                              lIndex={lIndex}
                              sIndex={sIndex}
                              uIndex={uIndex}
                              mIndex={mIndex}
                              actions={{
                                deleteMatiere,
                                updateField,
                                addCM,
                                deleteCM,
                                addTDManuel,
                                deleteTD,
                                addTPManuel,
                                deleteTP,
                                addAnnaleManuel,
                                deleteAnnale,
                                setModalConfig,
                                getNextReviewDate,
                                setConfigLocal,
                                setCoursConfig
                              }}
                            />
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
          </div>
        )
      })()}
      

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
