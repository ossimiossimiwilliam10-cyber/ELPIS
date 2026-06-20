import { useState, useEffect } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';
import MarkdownModal from './MarkdownModal';
import EditableLabel from './components/cours/EditableLabel';
import MatiereCard from './components/cours/MatiereCard';

function CoursPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const [configLocal, setConfigLocal] = useState(coursConfig || { licences: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLicenceIndex, setActiveLicenceIndex] = useState(0);
  const [activeSemestreIndex, setActiveSemestreIndex] = useState(0);
  const [activeUEIndex, setActiveUEIndex] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });

  // Helper : applique une mutation Immer, sauvegarde dans le store, et retourne le nouvel état
  const mutateAndSave = (recipe) => {
    setConfigLocal(prev => {
      const newConf = produce(prev, recipe);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  // Resynchroniser le state local quand le store change (ex: import backup)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (coursConfig) setConfigLocal(coursConfig);
  }, [coursConfig]);

  // Écouter la recherche globale (Ctrl+K) pour naviguer vers l'élément trouvé
  useEffect(() => {
    const handleSearchSelect = (e) => {
      const item = e.detail;
      if (item.lIndex !== undefined) {
        setActiveLicenceIndex(item.lIndex);
        setActiveSemestreIndex(item.sIndex || 0);
        if (item.uIndex !== undefined) {
          setActiveUEIndex(item.uIndex);
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

  // ---- Mutation d'un champ par chemin ----
  const updateField = (path, value) => {
    mutateAndSave(draft => {
      let target = draft;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
    });
  };

  // ---- CRUD Licence ----
  const addLicence = () => {
    mutateAndSave(draft => {
      if (!draft.licences) draft.licences = [];
      draft.licences.push({ nom: `Licence ${draft.licences.length + 1}`, semestres: [] });
    });
    setActiveLicenceIndex(configLocal.licences ? configLocal.licences.length : 0);
    setActiveSemestreIndex(0);
    setActiveUEIndex(0);
  };

  const deleteLicence = (lIndex) => {
    if (!window.confirm("Supprimer cette licence et tous ses semestres ?")) return;
    mutateAndSave(draft => { draft.licences.splice(lIndex, 1); });
    if (activeLicenceIndex === lIndex) { setActiveLicenceIndex(Math.max(0, lIndex - 1)); setActiveSemestreIndex(0); }
    else if (activeLicenceIndex > lIndex) setActiveLicenceIndex(activeLicenceIndex - 1);
  };

  // ---- CRUD Semestre ----
  const addSemestre = (lIndex) => {
    mutateAndSave(draft => {
      if (!draft.licences[lIndex].semestres) draft.licences[lIndex].semestres = [];
      draft.licences[lIndex].semestres.push({ nom: `Semestre ${draft.licences[lIndex].semestres.length + 1}`, ues: [] });
    });
    setActiveSemestreIndex(configLocal.licences[lIndex].semestres ? configLocal.licences[lIndex].semestres.length : 0);
  };

  const deleteSemestre = (lIndex, sIndex) => {
    if (!window.confirm("Supprimer ce semestre et toutes ses UEs ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres.splice(sIndex, 1); });
    if (activeSemestreIndex === sIndex) { setActiveSemestreIndex(Math.max(0, sIndex - 1)); setActiveUEIndex(0); }
    else if (activeSemestreIndex > sIndex) setActiveSemestreIndex(activeSemestreIndex - 1);
  };

  // ---- CRUD UE ----
  const addUE = (lIndex, sIndex) => {
    mutateAndSave(draft => {
      if (!draft.licences[lIndex].semestres[sIndex].ues) draft.licences[lIndex].semestres[sIndex].ues = [];
      draft.licences[lIndex].semestres[sIndex].ues.push({ nom: "Nouvelle UE", ects: 0, matieres: [] });
    });
    setActiveUEIndex(configLocal.licences[lIndex].semestres[sIndex].ues ? configLocal.licences[lIndex].semestres[sIndex].ues.length : 0);
  };

  const deleteUE = (lIndex, sIndex, uIndex) => {
    if (!window.confirm("Supprimer cette UE et toutes ses matières ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues.splice(uIndex, 1); });
    if (activeUEIndex === uIndex) setActiveUEIndex(Math.max(0, uIndex - 1));
    else if (activeUEIndex > uIndex) setActiveUEIndex(activeUEIndex - 1);
  };

  // ---- CRUD Matiere ----
  const addMatiere = (lIndex, sIndex, uIndex) => {
    mutateAndSave(draft => {
      const ue = draft.licences[lIndex].semestres[sIndex].ues[uIndex];
      if (!ue.matieres) ue.matieres = [];
      ue.matieres.push({ nom: "Nouvelle Matière", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] });
    });
  };

  const deleteMatiere = (lIndex, sIndex, uIndex, mIndex) => {
    if (!window.confirm("Supprimer cette matière (et ses CM/TD/TP) ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1); });
  };

  // ---- CRUD CM ----
  const addCM = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const mat = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeCM) mat.listeCM = [];
      mat.listeCM.push({ titre: "Nouveau CM", jActuel: 0, derniereRevision: "", easeFactor: 2.5, repetitions: 0 });
    });
  };

  const deleteCM = (lIndex, sIndex, uIndex, mIndex, cmIndex) => {
    if (!window.confirm("Supprimer ce CM ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM.splice(cmIndex, 1); });
  };

  // ---- CRUD TD ----
  const addTDManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeTD) m.listeTD = [];
      m.listeTD.push({ titre: `TD ${m.listeTD.length + 1}`, dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteTD = (lIndex, sIndex, uIndex, mIndex, tdIndex) => {
    if (!window.confirm("Supprimer ce TD ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeTD.splice(tdIndex, 1); });
  };

  // ---- CRUD TP ----
  const addTPManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeTP) m.listeTP = [];
      m.listeTP.push({ titre: `TP ${m.listeTP.length + 1}`, dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteTP = (lIndex, sIndex, uIndex, mIndex, tpIndex) => {
    if (!window.confirm("Supprimer ce TP ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeTP.splice(tpIndex, 1); });
  };

  // ---- CRUD Annales ----
  const addAnnaleManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeAnnales) m.listeAnnales = [];
      m.listeAnnales.push({ titre: `Annale ${m.listeAnnales.length + 1}`, dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteAnnale = (lIndex, sIndex, uIndex, mIndex, annaleIndex) => {
    if (!window.confirm("Supprimer cette Annale ?")) return;
    mutateAndSave(draft => { draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeAnnales.splice(annaleIndex, 1); });
  };

  const getNextReviewDate = (cm) => {
    // Priorité au champ prochaineRevisionDate calculé par SM-2
    if (cm.prochaineRevisionDate) {
      const target = new Date(cm.prochaineRevisionDate + 'T00:00:00');
      if (!isNaN(target.getTime())) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "Aujourd'hui";
        if (diffDays === 1) return "Demain";
        return target.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      }
    }
    // Fallback : ancienne logique (derniereRevision + jActuel)
    if (!cm.derniereRevision) return "Aujourd'hui";
    if (cm.jActuel === 0) return "Aujourd'hui";
    const date = new Date(cm.derniereRevision + 'T00:00:00');
    if (isNaN(date.getTime())) return "Aujourd'hui";
    date.setDate(date.getDate() + cm.jActuel);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };  const getAllMatiereNames = () => {
    const names = [];
    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom && m.nom.trim() !== '') names.push(m.nom.trim());
          });
        });
      });
    });
    return Array.from(new Set(names));
  };
  const allMatiereNames = getAllMatiereNames();

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
            key={`lic-${lIndex}-${licence.nom}`} 
            className={`tab-btn ${activeLicenceIndex === lIndex ? 'active' : ''}`}
            onClick={() => { setActiveLicenceIndex(lIndex); setActiveSemestreIndex(0); setActiveUEIndex(0); }}
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
                  key={`sem-${sIndex}-${semestre.nom}`} 
                  className={`tab-btn ${activeSemestreIndex === sIndex ? 'active' : ''}`}
                  onClick={() => { setActiveSemestreIndex(sIndex); setActiveUEIndex(0); }}
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

                  <div className="ue-tabs" style={{display:'flex', gap:'1rem', marginLeft:'1rem', flexWrap:'wrap'}}>
                    {semestre.ues?.map((ue, uIndex) => {
                      if (!ueMatchesSearch(ue)) return null;
                      return (
                        <button 
                          key={`ue-tab-${uIndex}-${ue.nom}`} 
                          className={`tab-btn ${activeUEIndex === uIndex ? 'active' : ''}`}
                          style={{ fontSize:'0.95rem', padding:'0.4rem 1rem', background: activeUEIndex === uIndex ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)' }}
                          onClick={() => setActiveUEIndex(uIndex)}
                        >
                          {ue.nom}
                        </button>
                      );
                    })}
                    <button className="tab-btn" onClick={() => addUE(lIndex, sIndex)} style={{color:'var(--accent-primary)', fontSize:'0.95rem', padding:'0.4rem 1rem'}}>+ UE</button>
                  </div>

                  <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', marginLeft:'1rem', marginTop:'1.5rem'}}>
                    <AnimatePresence mode="wait">
                      {semestre.ues && semestre.ues[activeUEIndex] && (() => {
                        const uIndex = activeUEIndex;
                        const ue = semestre.ues[uIndex];
                        if (!ueMatchesSearch(ue)) return null;
                        
                        return (
                          <motion.div
                            key={`ue-content-${uIndex}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            style={{background:'rgba(255,255,255,0.02)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--bg-tertiary)'}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '1.5rem'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'1rem', flex: 1}}>
                              <EditableLabel 
                                value={ue.nom}
                                onRename={(v) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'nom'], v)}
                                placeholder="Nom de l'UE"
                                style={{fontWeight:'bold', fontSize:'1.3rem', color:'var(--text-primary)'}}
                              />
                              <div style={{display:'flex', alignItems:'center', gap:'0.4rem', background:'rgba(0,0,0,0.2)', padding:'0.3rem 0.6rem', borderRadius:'6px'}}>
                                <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>ECTS:</span>
                                <input 
                                  type="number" value={ue.ects || 0} 
                                  onChange={(e) => updateField(['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'ects'], Math.min(60, Math.max(0, parseInt(e.target.value) || 0)))}
                                  style={{width:'50px', padding:'0.2rem', fontSize:'0.85rem'}} title="Crédits ECTS (0-60)"
                                />
                              </div>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                              <button className="btn-secondary" onClick={() => addMatiere(lIndex, sIndex, uIndex)}>+ Matière</button>
                              <button onClick={() => deleteUE(lIndex, sIndex, uIndex)} style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'1.2rem'}} title="Supprimer l'UE">🗑️</button>
                            </div>
                          </div>

                          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1.5rem'}}>
                            {ue.matieres?.map((matiere, mIndex) => {
                              if (!matiereMatchesSearch(matiere)) return null;
                              return (
                                <MatiereCard
                                  key={`m-${sIndex}-${uIndex}-${mIndex}`}
                                  matiere={matiere}
                                  allMatiereNames={allMatiereNames}
                                  lIndex={lIndex} sIndex={sIndex} uIndex={uIndex} mIndex={mIndex}
                                  actions={{
                                    deleteMatiere, updateField, addCM, deleteCM,
                                    addTDManuel, deleteTD, addTPManuel, deleteTP,
                                    addAnnaleManuel, deleteAnnale,
                                    setModalConfig, getNextReviewDate, setConfigLocal, setCoursConfig
                                  }}
                                />
                              );
                            })}
                            {(!ue.matieres || ue.matieres.length === 0) && (
                              <div style={{gridColumn: '1 / -1', textAlign:'center', padding:'3rem', color:'var(--text-secondary)', border:'1px dashed var(--bg-tertiary)', borderRadius:'8px'}}>
                                Aucune matière dans cette UE. <br/>Cliquez sur "+ Matière" pour en ajouter.
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                  </div>
                </div>);
              })()}
            </div>
          </div>);
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
