import { useState } from 'react';
import useStore from './store';
import { produce } from 'immer';
import EditableLabel from './components/cours/EditableLabel';
import InfoTooltip from './components/InfoTooltip';

export default function BulletinPage() {
  const { coursConfig, setCoursConfig, intelligence } = useStore();
  const [activeLicenceIndex, setActiveLicenceIndex] = useState(0);
  const [expandedUEs, setExpandedUEs] = useState({});
  const [unlockedUEs, setUnlockedUEs] = useState(new Set());
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // AXE 15: What-If Simulation Mode
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState(null);
  const [pointsJury, setPointsJury] = useState(0);

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
        val = parseFloat(String(value).replace(',', '.'));
        if (isNaN(val) || val < 0) val = 1;
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
    let isDefaillant = false;
    let totalScore = 0;
    let totalCoef = 0;
    evaluations.forEach(ev => {
      if (ev.statut === 'defaillant') {
        isDefaillant = true;
      } else if (ev.statut !== 'excuse' && ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
        const c = ev.coefficient !== undefined ? Number(ev.coefficient) : 1;
        totalScore += ev.note * c;
        totalCoef += c;
      }
    });
    if (isDefaillant) return 'DEF';
    return totalCoef > 0 ? (totalScore / totalCoef) : null;
  };

  const semesterAverages = [];
  licence.semestres?.forEach(sem => {
    let semSumNotes = 0;
    let semSumECTS = 0;

    sem.ues?.forEach(ue => {
      let ueSumWeight = 0;
      let ueSumNotes = 0;
      let ueBonus = 0;
      let ueIsDefaillant = false;
      
      ue.matieres?.forEach(m => {
        if (m.dispense) return;
        const avg = getSubjectAverage(m.evaluations);
        if (avg === 'DEF') {
          ueIsDefaillant = true;
        } else if (avg !== null) {
          const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
          if (coef === 0) {
            ueBonus += avg;
          } else {
            ueSumWeight += coef;
            ueSumNotes += avg * coef;
          }
        }
      });

      const ueAvg = ueIsDefaillant ? 'DEF' : (ueSumWeight > 0 ? (ueSumNotes / ueSumWeight) + ueBonus : null);
      if (ueAvg === 'DEF') {
         semSumNotes = 'DEF'; // propagate DEF
      } else if (ueAvg !== null && semSumNotes !== 'DEF') {
        const ects = ue.ects || 0; // Use ECTS for UE weighting
        semSumNotes += ueAvg * ects;
        semSumECTS += ects;
      }
    });

    const semAvg = semSumNotes === 'DEF' ? 'DEF' : (semSumECTS > 0 ? (semSumNotes / semSumECTS).toFixed(2) : '--');
    semesterAverages.push({ nom: sem.nom, avg: semAvg });
  });

  // AXE 16: Moyenne Générale au Diplôme (Arithmétique)
  let globalSum = 0;
  let globalCount = 0;
  let deugSum = 0;
  let deugCount = 0;

  semesterAverages.forEach((sem, idx) => {
    if (sem.avg !== '--' && sem.avg !== 'DEF') {
      const val = parseFloat(sem.avg);
      globalSum += val;
      globalCount++;
      if (idx < 4) { // DEUG = 4 premiers semestres
        deugSum += val;
        deugCount++;
      }
    }
  });

  let baseGlobalAvg = globalCount > 0 ? (globalSum / globalCount) : null;
  let globalAvgWithJury = baseGlobalAvg !== null ? (baseGlobalAvg + (parseFloat(pointsJury) || 0)).toFixed(2) : '--';
  let globalAvg = baseGlobalAvg !== null ? baseGlobalAvg.toFixed(2) : '--';
  let deugAvg = deugCount > 0 ? (deugSum / deugCount).toFixed(2) : '--';

  let mention = "";
  if (globalAvgWithJury !== '--') {
    const score = parseFloat(globalAvgWithJury);
    if (score >= 16) mention = "Très Bien";
    else if (score >= 14) mention = "Bien";
    else if (score >= 12) mention = "Assez Bien";
    else if (score >= 10) mention = "Passable";
    else mention = "Ajourné";
  }

  // AXE AJAC & Compensation Annuelle
  let totalAcquiredECTS = 0;
  let statusAJAC = "En attente d'évaluations";
  let statusColor = "var(--text-secondary)";
  let isAJAC = false;
  let isAjourne = false;
  let isEnCours = false;
  let hasEvaluations = false;
  const capitalisedUEs = new Set();
  let ectsS1 = 0;
  let ectsS2 = 0;

  if (licence && licence.semestres) {
    for (let yearIdx = 0; yearIdx < Math.ceil(licence.semestres.length / 2); yearIdx++) {
      const s1Idx = yearIdx * 2;
      const s2Idx = yearIdx * 2 + 1;
      
      const sem1 = licence.semestres[s1Idx];
      const sem2 = licence.semestres[s2Idx];

      const processSemester = (sem) => {
        if (!sem) return { avg: null, acquiredECTS: 0, totalECTS: 0, isCompensated: false, ues: [] };
        
        let semSumECTS = 0;
        let semSumNotes = 0;
        let uesData = [];

        sem.ues?.forEach(ue => {
          let ueSumWeight = 0;
          let ueSumNotes = 0;
          let ueBonus = 0;
          let isUeDispense = true;
          let hasMatieres = false;
          
          ue.matieres?.forEach(m => {
            hasMatieres = true;
            if (!m.dispense) isUeDispense = false;
            if (m.dispense) return;
            const avg = getSubjectAverage(m.evaluations);
            if (avg !== null) {
              const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
              if (coef === 0) {
                ueBonus += avg;
              } else {
                ueSumWeight += coef;
                ueSumNotes += avg * coef;
              }
            }
          });
          
          if (!hasMatieres) isUeDispense = false;
          
          const ueAvg = ueSumWeight > 0 ? (ueSumNotes / ueSumWeight) + ueBonus : null;
          const isUeValidated = (ueAvg !== null && ueAvg >= 10) || isUeDispense;
          const ects = ue.ects || 0;
          
          if (ueAvg !== null) {
              semSumNotes += ueAvg * ects;
              semSumECTS += ects;
          }
          
          uesData.push({ nom: ue.nom, ueAvg, isUeValidated, ects, isUeDispense });
        });
        
        const semAverage = semSumECTS > 0 ? (semSumNotes / semSumECTS) : null;
        const isCompensated = semAverage !== null && semAverage >= 10;
        
        return { avg: semAverage, totalECTS: semSumECTS, isCompensated, ues: uesData };
      };

      const dataS1 = processSemester(sem1);
      const dataS2 = processSemester(sem2);

      let annualAvg = null;
      if (dataS1.avg !== null && dataS2.avg !== null) {
        annualAvg = (dataS1.avg + dataS2.avg) / 2;
      }

      let s1AcquiredECTS = 0;
      let s2AcquiredECTS = 0;

      if (annualAvg !== null && annualAvg >= 10) {
        s1AcquiredECTS = dataS1.ues.reduce((acc, u) => acc + u.ects, 0);
        s2AcquiredECTS = dataS2.ues.reduce((acc, u) => acc + u.ects, 0);
        dataS1.ues.forEach(u => capitalisedUEs.add(u.nom));
        dataS2.ues.forEach(u => capitalisedUEs.add(u.nom));
      } else {
        dataS1.ues.forEach(u => {
          if (dataS1.isCompensated || u.isUeValidated) { s1AcquiredECTS += u.ects; capitalisedUEs.add(u.nom); }
        });
        dataS2.ues.forEach(u => {
          if (dataS2.isCompensated || u.isUeValidated) { s2AcquiredECTS += u.ects; capitalisedUEs.add(u.nom); }
        });
      }

      totalAcquiredECTS += s1AcquiredECTS + s2AcquiredECTS;
      ectsS1 = s1AcquiredECTS;
      ectsS2 = s2AcquiredECTS;

      const yearMaxECTS = dataS1.ues.reduce((acc, u) => acc + u.ects, 0) + dataS2.ues.reduce((acc, u) => acc + u.ects, 0);
      
      if (dataS1.avg !== null || dataS2.avg !== null) hasEvaluations = true;

      if (yearMaxECTS > 0 && (dataS1.avg !== null || dataS2.avg !== null)) {
        if (annualAvg !== null && annualAvg >= 10) {
           // Validated (no flag needed)
        } else if ((s1AcquiredECTS + s2AcquiredECTS) >= yearMaxECTS) {
           // Validated (no flag needed)
        } else if (dataS1.avg !== null && dataS2.avg !== null) {
           if (s1AcquiredECTS >= 24 && s2AcquiredECTS >= 24) {
              isAJAC = true;
           } else {
              isAjourne = true;
           }
        } else {
           isEnCours = true;
        }
      }
    }
  }

  if (!hasEvaluations) {
     statusAJAC = "En attente d'évaluations";
     statusColor = "var(--text-secondary)";
  } else if (isAjourne) {
     statusAJAC = `Ajourné (${totalAcquiredECTS} ECTS)`;
     statusColor = "var(--danger)";
  } else if (isAJAC) {
     statusAJAC = `AJAC (${totalAcquiredECTS} ECTS)`;
     statusColor = "var(--warning)";
  } else if (isEnCours) {
     statusAJAC = `En cours (${totalAcquiredECTS} ECTS)`;
     statusColor = "var(--text-secondary)";
  } else {
     statusAJAC = `Validé (${totalAcquiredECTS} ECTS)`;
     statusColor = "var(--success)";
  }

  const toggleUE = (idx) => {
    setExpandedUEs(prev => ({ ...prev, [idx]: prev[idx] !== undefined ? !prev[idx] : true }));
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>

      {/* BANNIERE SUPER MOYENNE GENERALE */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{flex: 1, minWidth: '250px'}}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>Moyenne Générale (Licence)</h2>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Moyenne arithmétique globale sans pondération
          </div>
          {mention && (
            <div style={{ marginTop: '0.8rem', display: 'inline-block', padding: '0.3rem 0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '8px', fontWeight: 'bold' }}>
              Mention : {mention}
            </div>
          )}
          <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Points de Jury :</span>
            <input type="number" step="0.01" value={pointsJury} onChange={(e) => setPointsJury(e.target.value)} style={{ width: '70px', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Ajout manuel de points pour l'obtention d'une mention" />
          </div>
        </div>
        
        <div style={{ textAlign: 'right', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>DEUG (S1 à S4)</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: deugAvg >= 10 ? '#4ade80' : 'var(--text-primary)' }}>
              {deugAvg}<span style={{fontSize: '1rem', color:'var(--text-muted)'}}>/20</span>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Diplôme (Licence)</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: globalAvgWithJury >= 10 ? '#4ade80' : '#f87171', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
              {globalAvgWithJury}<span style={{fontSize: '1.2rem', color:'var(--text-muted)'}}>/20</span>
            </div>
          </div>
        </div>
      </div>

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
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsLegendOpen(true)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📚 Légende MCC
            </button>

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

      {/* WIDGET AJAC / ECTS */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎓 Progression ECTS (Année Courante)</span>
            <InfoTooltip content="Validation: 60 ECTS. AJAC: Minimum 24 ECTS requis pour CHAQUE semestre afin de passer à l'année supérieure." width={300}>
              <span style={{ fontSize: '0.9rem', cursor: 'help', color: 'var(--text-secondary)' }}>ℹ️</span>
            </InfoTooltip>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Semestre Impair : <strong>{ectsS1} / 30 ECTS</strong> | Semestre Pair : <strong>{ectsS2} / 30 ECTS</strong>
          </div>
        </div>
        
        <div style={{ background: 'var(--bg-tertiary)', padding: '0.8rem 1.5rem', borderRadius: '8px', borderLeft: `4px solid ${statusColor}` }}>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Statut Prévisionnel</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: statusColor }}>{statusAJAC}</div>
        </div>
      </div>

      {/* RECAP GLOBAL PAR SEMESTRE */}
      <div style={{display:'flex', gap:'1rem', flexWrap:'wrap', justifyContent:'flex-end', marginBottom:'1.5rem'}}>
        {semesterAverages.map((sem, idx) => (
          <div key={idx} className="card glass-panel" style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '12px', minWidth: '150px' }}>
            <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
              Moyenne {sem.nom}
              <InfoTooltip content="La moyenne du semestre est pondérée par les ECTS de chaque UE. La moyenne d'une UE est elle-même pondérée par les coefficients de ses matières." width={280}>
                <span style={{ marginLeft: '0.3rem', fontSize: '0.85rem', opacity: 0.7, cursor: 'help' }}>ℹ️</span>
              </InfoTooltip>
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>{sem.avg} <span style={{fontSize:'1.2rem', opacity:0.8}}>/ 20</span></div>
          </div>
        ))}
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
        let ueBonus = 0;
        ue.matieres?.forEach(m => {
          if (m.dispense) return;
          const avg = getSubjectAverage(m.evaluations);
          if (avg !== null) {
            const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
            if (coef === 0) {
              ueBonus += avg;
            } else {
              ueSumWeight += coef;
              ueSumNotes += avg * coef;
            }
          }
        });
        const ueAverage = ueSumWeight > 0 ? ((ueSumNotes / ueSumWeight) + ueBonus).toFixed(2) : '--';
        const isCollapsed = expandedUEs[idx];
        const isUeCapitalised = capitalisedUEs.has(ue.nom);
        const isLocked = isUeCapitalised && !unlockedUEs.has(ue.nom);

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
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{ue.nom} {isUeCapitalised && (isLocked ? '🔒' : '🔓')}</h2>
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
                     let ueBonus = 0;
                     let ueIsDefaillant = false;
                     siblingUe.matieres?.forEach(m => {
                       if (m.dispense) return;
                       const avg = getSubjectAverage(m.evaluations);
                       if (avg === 'DEF') {
                         ueIsDefaillant = true;
                       } else if (avg !== null) {
                         const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
                         if (coef === 0) {
                           ueBonus += avg;
                         } else {
                           ueSumWeight += coef;
                           ueSumNotes += avg * coef;
                         }
                       }
                     });
                     const ueAvg = ueIsDefaillant ? 'DEF' : (ueSumWeight > 0 ? (ueSumNotes / ueSumWeight) + ueBonus : null);
                     if (ueAvg === 'DEF') {
                         semSumNotes = 'DEF';
                     } else if (ueAvg !== null && semSumNotes !== 'DEF') {
                         const ects = siblingUe.ects || 0;
                         semSumNotes += ueAvg * ects;
                         semSumECTS += ects;
                     }
                  });
                  const semAverage = semSumNotes === 'DEF' ? 'DEF' : (semSumECTS > 0 ? (semSumNotes / semSumECTS) : 0);
                  const isCompensable = semAverage !== 'DEF' && semAverage >= 10;


                  return isCompensable
                      ? <span title="Compensation inter-semestrielle annuelle. Vous pouvez renoncer à cette compensation (notamment S5-S6) après la tenue du jury." style={{ background: 'rgba(52, 211, 153, 0.2)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'help' }}>✅ Compensable</span>
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
                {isUeCapitalised && (
                  <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid var(--success)', padding: '1rem', borderRadius: '8px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>{isLocked ? '🔒' : '🔓'}</span>
                      <strong>UE Capitalisée (Acquise)</strong>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Les notes de cette UE sont verrouillées car elle est définitivement acquise.</div>
                    </div>
                    {isLocked ? (
                       <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setUnlockedUEs(prev => new Set(prev).add(ue.nom))}>Déverrouiller pour correction</button>
                    ) : (
                       <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => { const s = new Set(unlockedUEs); s.delete(ue.nom); setUnlockedUEs(s); }}>Reverrouiller</button>
                    )}
                  </div>
                )}
                {(() => {
                  const ueSumMatiereCoefs = ue.matieres?.reduce((acc, m) => acc + (m.dispense ? 0 : (m.coefficient !== undefined ? Number(m.coefficient) : 1)), 0) || 1;
                  return ue.matieres?.map((matiere, matIndex) => {
                  const isDispense = matiere.dispense === true;
                  const avg = getSubjectAverage(matiere.evaluations);
                  const coef = matiere.coefficient !== undefined ? Number(matiere.coefficient) : 1;
                  const matSumEvalCoefs = matiere.evaluations?.reduce((acc, e) => acc + (Number(e.coefficient) || 0), 0) || 1;
                  const projected = intelligence?.projectedScoreMap?.[(matiere.nom || '').toLowerCase().trim()];
                  return (
                    <div key={matIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-primary)', opacity: isDispense ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                           {matiere.nom} {isDispense && <span style={{fontSize:'0.8rem', color:'var(--success)', marginLeft:'0.5rem'}}>🎓 Dispensé</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          {projected !== undefined && !isDispense && (
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
                        {(matiere.evaluations || []).map((ev, evIndex) => {
                          const evCoef = Number(ev.coefficient) || 0;
                          const globalWeight = ueSumMatiereCoefs > 0 && matSumEvalCoefs > 0 && !isDispense ? (evCoef / matSumEvalCoefs) * (coef / ueSumMatiereCoefs) : 0;
                          const isWeightIllegal = globalWeight > 0.5;

                          return (
                          <div key={evIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: '6px', border: isWeightIllegal ? '1px solid var(--danger)' : '1px solid rgba(255,255,255,0.05)', position: 'relative', opacity: isLocked ? 0.7 : 1 }}>
                            {isWeightIllegal && (
                               <div title={`Le poids global de cette note dans l'UE est de ${(globalWeight*100).toFixed(1)}%. Le règlement interdit de dépasser 50%.`} style={{position: 'absolute', top: '-0.5rem', left: '0.5rem', background: 'var(--danger)', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold', zIndex: 2}}>
                                 ⚠️ &gt; 50% UE
                               </div>
                            )}
                            {!isLocked && (
                               <button
                                 onClick={() => handleDeleteEval(ue.semIndex, ue.ueIndex, matIndex, evIndex)}
                                 style={{ position: 'absolute', top: '0.2rem', right: '0.2rem', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }}
                                 title="Supprimer l'évaluation"
                               >×</button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingRight: '1rem', gap: '0.2rem' }}>
                              {isLocked ? (
                                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{ev.nom}</span>
                              ) : (
                                <EditableLabel
                                  value={ev.nom}
                                  onRename={(val) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'nom', val)}
                                  placeholder="Nouvelle Éval"
                                  style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}
                                />
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>Coef:</span>
                                {isLocked ? (
                                  <span>{ev.coefficient}</span>
                                ) : (
                                  <EditableLabel
                                    value={String(ev.coefficient)}
                                    onRename={(val) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'coefficient', val)}
                                  />
                                )}
                                <select
                                  disabled={isLocked}
                                  value={ev.type || 'SC'}
                                  title="Type d'épreuve (AC: Avec Convocation, SC: Sans Convocation)"
                                  onChange={(e) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'type', e.target.value)}
                                  style={{ padding: '0.1rem 0.3rem', background: ev.type === 'AC' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)', color: ev.type === 'AC' ? '#ef4444' : '#34d399', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.7 : 1 }}
                                >
                                  <option value="SC" title="Épreuve sans convocation">SC</option>
                                  <option value="AC" title="Épreuve avec convocation">AC</option>
                                </select>
                              </div>
                              <input
                                type="date"
                                disabled={isLocked}
                                value={ev.date || ''}
                                onChange={(e) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'date', e.target.value || null)}
                                style={{ padding: '0.15rem 0.3rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '0.75rem', width: '100%', opacity: isLocked ? 0.7 : 1 }}
                              />
                            </div>
                            <div style={{marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'}}>
                              <select
                                disabled={isLocked}
                                value={ev.statut || 'present'}
                                onChange={(e) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'statut', e.target.value)}
                                style={{ padding: '0.3rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.7 : 1 }}
                              >
                                <option value="present">Présent (Noté)</option>
                                <option value="excuse">Absence Justifiée (EXC)</option>
                                <option value="defaillant">Défaillant (DEF)</option>
                              </select>

                              {(!ev.statut || ev.statut === 'present') && (
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  step="0.1"
                                  min="0" max="20"
                                  placeholder="-- / 20"
                                  defaultValue={ev.note !== null ? ev.note : ''}
                                  onBlur={(e) => handleUpdateNote(ue.semIndex, ue.ueIndex, matIndex, evIndex, e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', background: isLocked ? 'rgba(0,0,0,0.1)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', cursor: isLocked ? 'not-allowed' : 'text' }}
                                />
                              )}
                              {ev.statut === 'excuse' && (
                                <div style={{ width: '100%', padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px dashed #60a5fa', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>EXC (Neutralisé)</div>
                              )}
                              {ev.statut === 'defaillant' && (
                                <div style={{ width: '100%', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>DEF (Blocage)</div>
                              )}
                            </div>
                          </div>
                          );
                        })}

                        <button
                          disabled={isLocked}
                          onClick={() => handleAddEval(ue.semIndex, ue.ueIndex, matIndex)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: isLocked ? 'not-allowed' : 'pointer', minHeight: '100px', transition: 'all 0.2s', opacity: isLocked ? 0.3 : 1 }}
                          className={isLocked ? '' : "hover-bright"}
                        >
                          + Épreuve
                        </button>
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* MODAL LÉGENDE */}
      {isLegendOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setIsLegendOpen(false)}>
          <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '16px', maxWidth: '600px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', overflowY: 'auto', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>📚 Légende des MCC</h2>
              <button onClick={() => setIsLegendOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--text-secondary)' }}>
              <div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Types d'évaluation (Session 1)</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                  <li><strong style={{ color: '#ef4444' }}>AC</strong> : Épreuve <strong>Avec</strong> Convocation</li>
                  <li><strong style={{ color: '#34d399' }}>SC</strong> : Épreuve <strong>Sans</strong> Convocation</li>
                  <li><strong>A</strong> : Autre</li>
                </ul>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Natures de l'évaluation</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                  <li><strong>ET</strong> : Écrit sur table</li>
                  <li><strong>PE</strong> : Production écrite</li>
                  <li><strong>PT</strong> : Évaluation des pratiques techniques</li>
                  <li><strong>QC</strong> : Questionnaire à choix multiples</li>
                </ul>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Natures d'enseignement</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                  <li><strong>CM</strong> : Cours Magistral</li>
                  <li><strong>TD</strong> : Travaux Dirigés</li>
                  <li><strong>TP</strong> : Travaux Pratiques</li>
                </ul>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button onClick={() => setIsLegendOpen(false)} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}