import { useState, useEffect } from 'react';
import useStore from './store';
import { produce } from 'immer';
import EditableLabel from './components/cours/EditableLabel';

export default function BulletinPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const [activeLicenceIndex, setActiveLicenceIndex] = useState(0);
  const [expandedUEs, setExpandedUEs] = useState({});
  const [intelligence, setIntelligence] = useState(null);
  
  // AXE 15: What-If Simulation Mode
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState(null);

  const toggleSimulationMode = () => {
    if (isSimulationMode) {
      setIsSimulationMode(false);
      setSimulationConfig(null);
    } else {
      setSimulationConfig(coursConfig);
      setIsSimulationMode(true);
    }
  };

  const activeConfig = isSimulationMode ? simulationConfig : coursConfig;

  // Fetch intelligence data from orchestrateur
  useEffect(() => {
    fetch('/api/orchestrateur?extraTime=0')
      .then(r => r.json())
      .then(d => { if (d.intelligence) setIntelligence(d.intelligence); })
      .catch(() => {});
  }, [coursConfig]);

  if (!activeConfig || !activeConfig.licences || activeConfig.licences.length === 0) {
    return <div style={{padding: '2rem'}}>Aucun cours configuré.</div>;
  }

  const currentLicenceIndex = activeLicenceIndex < activeConfig.licences.length ? activeLicenceIndex : 0;
  const licence = activeConfig.licences[currentLicenceIndex];
  
  const ues = [];
  licence.semestres?.forEach((sem, semIndex) => {
    sem.ues?.forEach((ue, ueIndex) => {
      ues.push({ ...ue, semIndex, ueIndex, semNom: sem.nom });
    });
  });

  const mutateConfig = (recipe) => {
    if (isSimulationMode) {
      setSimulationConfig(produce(simulationConfig, recipe));
    } else {
      setCoursConfig(produce(coursConfig, recipe));
    }
  };

  const handleUpdateNote = (semIndex, ueIndex, matIndex, evalIndex, newValStr) => {
    const val = parseFloat(newValStr.replace(',', '.'));
    const finalVal = (!isNaN(val) && val >= 0 && val <= 20) ? val : null;
    mutateConfig(draft => {
      draft.licences[currentLicenceIndex].semestres[semIndex].ues[ueIndex].matieres[matIndex].evaluations[evalIndex].note = finalVal;
    });
  };

  const handleUpdateEvalField = (semIndex, ueIndex, matIndex, evalIndex, field, value) => {
    mutateConfig(draft => {
      let val = value;
      if (field === 'coefficient') {
        val = parseFloat(value.replace(',', '.'));
        if (isNaN(val) || val <= 0) val = 1;
      }
      draft.licences[currentLicenceIndex].semestres[semIndex].ues[ueIndex].matieres[matIndex].evaluations[evalIndex][field] = val;
    });
  };

  const handleAddEval = (semIndex, ueIndex, matIndex) => {
    mutateConfig(draft => {
      const mat = draft.licences[currentLicenceIndex].semestres[semIndex].ues[ueIndex].matieres[matIndex];
      if (!mat.evaluations) mat.evaluations = [];
      mat.evaluations.push({ nom: "Nouvelle Éval", coefficient: 1, note: null, type: 'SC', date: null });
    });
  };

  const handleDeleteEval = (semIndex, ueIndex, matIndex, evalIndex) => {
    if (!window.confirm("Supprimer cette évaluation ?")) return;
    mutateConfig(draft => {
      draft.licences[currentLicenceIndex].semestres[semIndex].ues[ueIndex].matieres[matIndex].evaluations.splice(evalIndex, 1);
    });
  };

  const getSubjectAverage = (evaluations) => {
    if (!evaluations || !Array.isArray(evaluations)) return null;
    let totalScore = 0;
    let totalCoef = 0;
    evaluations.forEach(ev => {
      if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
        const c = ev.coefficient || 1;
        totalScore += ev.note * c;
        totalCoef += c;
      }
    });
    return totalCoef > 0 ? (totalScore / totalCoef) : null;
  };

  const semesterAverages = [];
  licence.semestres?.forEach(sem => {
    let semSumNotes = 0;
    let semSumECTS = 0;
    
    sem.ues?.forEach(ue => {
      let ueSumWeight = 0;
      let ueSumNotes = 0;
      ue.matieres?.forEach(m => {
        const avg = getSubjectAverage(m.evaluations);
        if (avg !== null) {
          const coef = m.coefficient || 1;
          ueSumWeight += coef;
          ueSumNotes += avg * coef;
        }
      });
      
      const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
      if (ueAvg !== null) {
        const ects = ue.ects || 0; // Use ECTS for UE weighting
        semSumNotes += ueAvg * ects;
        semSumECTS += ects;
      }
    });
    
    const semAvg = semSumECTS > 0 ? (semSumNotes / semSumECTS).toFixed(2) : '--';
    semesterAverages.push({ nom: sem.nom, avg: semAvg });
  });


  const toggleUE = (idx) => {
    setExpandedUEs(prev => ({ ...prev, [idx]: prev[idx] !== undefined ? !prev[idx] : true }));
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', marginBottom: '1rem' }}>📝 Espace Bulletin</h1>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {coursConfig.licences.map((lic, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveLicenceIndex(idx); setExpandedUEs({}); }}
                className={`btn ${currentLicenceIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
              >
                {lic.nom}
              </button>
            ))}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>(Pour ajouter une licence, rends-toi dans Bibliothèque)</span>
            
          <button 
            onClick={toggleSimulationMode}
            style={{
              padding: '0.6rem 1rem', 
              borderRadius: '8px', 
              border: isSimulationMode ? '1px solid #a855f7' : '1px solid var(--border-color)', 
              background: isSimulationMode ? 'rgba(168, 85, 247, 0.15)' : 'transparent', 
              color: isSimulationMode ? '#a855f7' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isSimulationMode ? '🔮 Quitter le Mode Simulation' : '🧪 Mode Simulation (What-If)'}
          </button>
        </div>
      </div>

      {isSimulationMode && (
        <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid #a855f7', color: '#d8b4fe', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🧪</span>
          <div>
            <strong>Mode Simulation (What-If) Actif</strong>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Les notes que tu entres ici sont virtuelles et ne seront pas sauvegardées. Observe comment cela impacte tes moyennes et la compensation.</div>
          </div>
        </div>
      )}

      {/* RECAP GLOBAL PAR SEMESTRE */}
      <div style={{display:'flex', gap:'1rem', flexWrap:'wrap', justifyContent:'flex-end', marginBottom:'1.5rem'}}>
        {semesterAverages.map((sem, idx) => (
          <div key={idx} className="card glass-panel" style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '12px', minWidth: '150px' }}>
            <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>Moyenne {sem.nom}</span>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>{sem.avg} <span style={{fontSize:'1.2rem', opacity:0.8}}>/ 20</span></div>
          </div>
        ))}
      </div>
      </div>

      <div style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        <p>Saisis tes notes pour chaque épreuve officielle (ex: 12.5). Tu peux maintenant renommer les épreuves, changer leurs coefficients ou en ajouter de nouvelles en cliquant directement sur le texte !</p>
      </div>

      {ues.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
          Aucune UE configurée pour cette année. N'hésite pas à ajouter des matières depuis la section Bibliothèque.
        </div>
      )}

      {ues.map((ue, idx) => {
        let ueSumWeight = 0;
        let ueSumNotes = 0;
        ue.matieres?.forEach(m => {
          const avg = getSubjectAverage(m.evaluations);
          if (avg !== null) {
            const coef = m.coefficient || 1;
            ueSumWeight += coef;
            ueSumNotes += avg * coef;
          }
        });
        const ueAverage = ueSumWeight > 0 ? (ueSumNotes / ueSumWeight).toFixed(2) : '--';
        const isCollapsed = expandedUEs[idx];

        return (
          <div key={idx} className="card glass-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'rgba(0,0,0,0.2)', cursor: 'pointer' }}
              onClick={() => toggleUE(idx)}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>
                  {ue.semNom}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{ue.nom}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {/* Compensation badge */}
                {(() => {
                  if (ueAverage === '--' || parseFloat(ueAverage) >= 10) return null;
                  
                  // Compute semester average locally for real-time simulation (using ECTS rules)
                  let semSumECTS = 0;
                  let semSumNotes = 0;
                  (licence.semestres[ue.semIndex]?.ues || []).forEach(siblingUe => {
                     let ueSumWeight = 0;
                     let ueSumNotes = 0;
                     siblingUe.matieres?.forEach(m => {
                       const avg = getSubjectAverage(m.evaluations);
                       if (avg !== null) {
                         const coef = m.coefficient || 1;
                         ueSumWeight += coef;
                         ueSumNotes += avg * coef;
                       }
                     });
                     const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
                     if (ueAvg !== null) {
                         const ects = siblingUe.ects || 0;
                         semSumNotes += ueAvg * ects;
                         semSumECTS += ects;
                     }
                  });
                  const semAverage = semSumECTS > 0 ? (semSumNotes / semSumECTS) : 0;
                  const isCompensable = semAverage >= 10;

                  
                  return isCompensable 
                      ? <span style={{ background: 'rgba(52, 211, 153, 0.2)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ Compensable</span>
                      : <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>⚠️ Non compensable</span>;
                })()}
                <div style={{ fontWeight: 'bold', color: ueAverage !== '--' ? (ueAverage >= 10 ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                  {ueAverage !== '--' ? `Moyenne : ${ueAverage} / 20` : 'Pas de notes'}
                </div>
                <div style={{color: 'var(--text-secondary)'}}>{isCollapsed ? '▶' : '▼'}</div>
              </div>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {ue.matieres?.map((matiere, matIndex) => {
                  const avg = getSubjectAverage(matiere.evaluations);
                  const coef = matiere.coefficient || 1;
                  const projected = intelligence?.projectedScoreMap?.[matiere.nom];
                  return (
                    <div key={matIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{matiere.nom}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          {projected !== undefined && (
                            <span style={{ fontSize: '0.85rem', color: '#d8b4fe', background: 'rgba(168, 85, 247, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 'bold' }} title="Score Projeté par l'IA">
                              🔮 Projeté : {projected} / 20
                            </span>
                          )}
                          <span style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 'bold', background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Coef {coef}</span>
                          <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: avg !== null ? (avg >= 10 ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                            {avg !== null ? `${avg.toFixed(2)} / 20` : '--'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                        {(matiere.evaluations || []).map((ev, evIndex) => (
                          <div key={evIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <button 
                              onClick={() => handleDeleteEval(ue.semIndex, ue.ueIndex, matIndex, evIndex)}
                              style={{ position: 'absolute', top: '0.2rem', right: '0.2rem', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }}
                              title="Supprimer l'évaluation"
                            >×</button>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingRight: '1rem', gap: '0.2rem' }}>
                              <EditableLabel 
                                text={ev.nom} 
                                onSave={(val) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'nom', val)} 
                                style={{ fontWeight: 'bold', color: 'var(--text-primary)', cursor: 'text' }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>Coef:</span>
                                <EditableLabel 
                                  text={String(ev.coefficient)} 
                                  onSave={(val) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'coefficient', val)} 
                                  style={{ cursor: 'text' }}
                                />
                                <select 
                                  value={ev.type || 'SC'} 
                                  onChange={(e) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'type', e.target.value)}
                                  style={{ padding: '0.1rem 0.3rem', background: ev.type === 'AC' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)', color: ev.type === 'AC' ? '#ef4444' : '#34d399', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  <option value="SC">SC</option>
                                  <option value="AC">AC</option>
                                </select>
                              </div>
                              <input 
                                type="date" 
                                value={ev.date || ''}
                                onChange={(e) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'date', e.target.value || null)}
                                style={{ padding: '0.15rem 0.3rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '0.75rem', width: '100%' }}
                              />
                            </div>
                            <input 
                              type="number" 
                              step="0.1"
                              min="0" max="20"
                              placeholder="-- / 20" 
                              defaultValue={ev.note !== null ? ev.note : ''}
                              onBlur={(e) => handleUpdateNote(ue.semIndex, ue.ueIndex, matIndex, evIndex, e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem' }}
                            />
                          </div>
                        ))}
                        
                        <button 
                          onClick={() => handleAddEval(ue.semIndex, ue.ueIndex, matIndex)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', minHeight: '100px', transition: 'all 0.2s' }}
                          className="hover-bright"
                        >
                          + Épreuve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
