import { useState } from 'react';
import useStore from './store';
import { produce } from 'immer';
import EditableLabel from './components/cours/EditableLabel';
import InfoTooltip from './components/InfoTooltip';
import ConfirmModal from './components/ConfirmModal';
import { moyenneMatiere, moyenneUE, moyenneSemestre, formaterMoyenne, mentionPour, conformiteUE, MIN_NOTES_PAR_UE, DEFAILLANT } from './utils/bulletin';
import LigneEvaluation from './components/bulletin/LigneEvaluation';
import { TitrePage, Texte, Bouton, Pastille, EtatVide } from './components/ui';

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
  const [deleteEvalConfirm, setDeleteEvalConfirm] = useState(null);

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
    // Premier lancement : « Aucun cours configuré » laissait l'utilisateur
    // sans la moindre indication sur la marche à suivre.
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }} aria-hidden="true">📝</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Aucune note à afficher</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Le bulletin se construit à partir de ton cursus : crée tes licences, tes UE
          et tes matières, puis reviens y saisir tes évaluations.
        </p>
        <button className="btn-primary" onClick={() => useStore.getState().setActiveTab('cours')} style={{ padding: '0.9rem 1.8rem' }}>
          📚 Ouvrir la Bibliothèque
        </button>
      </div>
    );
  }

  const currentLicenceIndex = activeLicenceIndex < activeConfig.licences.length ? activeLicenceIndex : 0;
  const licence = activeConfig.licences[currentLicenceIndex];

  /*
   * Un semestre est terminé s'il est archivé ou si sa date de fin est passée.
   * Même règle que `isSemesterArchived` côté moteur, décalage de nuit compris.
   */
  const semestreTermine = (sem) => {
    if (!sem) return false;
    if (sem.archived) return true;
    if (!sem.dateFin) return false;
    const fin = new Date(sem.dateFin);
    if (Number.isNaN(fin.getTime())) return false;
    const maintenant = new Date();
    maintenant.setHours(maintenant.getHours() - 4);
    return fin < maintenant;
  };

  const ues = [];
  licence.semestres?.forEach((sem, semIndex) => {
    sem.ues?.forEach((ue, ueIndex) => {
      ues.push({ ...ue, semIndex, ueIndex, semNom: sem.nom, semestreTermine: semestreTermine(sem) });
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
    setDeleteEvalConfirm({ semIndex, ueIndex, matIndex, evalIndex });
  };

  const handleConfirmDeleteEval = () => {
    if (!deleteEvalConfirm) return;
    const { semIndex, ueIndex, matIndex, evalIndex } = deleteEvalConfirm;
    mutateConfig(draft => {
      draft.licences[currentLicenceIndex].semestres[semIndex].ues[ueIndex].matieres[matIndex].evaluations.splice(evalIndex, 1);
    });
    setDeleteEvalConfirm(null);
  };

  // Les règles de calcul vivent dans `utils/bulletin.js` : elles étaient
  // recopiées à quatre endroits de cette page, avec des divergences qui
  // produisaient des NaN dès qu'une évaluation était marquée défaillante.
  const getSubjectAverage = moyenneMatiere;

  const semesterAverages = (licence.semestres || []).map(sem => ({
    nom: sem.nom,
    avg: formaterMoyenne(moyenneSemestre(sem).moyenne),
  }));

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
  // Les points de jury restent des points : bornés, et la moyenne finale ne peut
  // sortir de l'échelle sur 20 — sans quoi une saisie de « 50 » affichait une
  // mention imaginaire.
  const pointsJuryBornes = Math.max(0, Math.min(5, parseFloat(pointsJury) || 0));
  let globalAvgWithJury = baseGlobalAvg !== null
    ? Math.min(20, baseGlobalAvg + pointsJuryBornes).toFixed(2)
    : '--';
  let globalAvg = baseGlobalAvg !== null ? baseGlobalAvg.toFixed(2) : '--';
  let deugAvg = deugCount > 0 ? (deugSum / deugCount).toFixed(2) : '--';

  const mention = globalAvgWithJury !== '--' ? mentionPour(parseFloat(globalAvgWithJury)) : '';

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
        if (!sem) return { avg: null, totalECTS: 0, isCompensated: false, ues: [] };

        const detail = moyenneSemestre(sem);
        return {
          // Une défaillance n'est pas une note : la remonter telle quelle
          // évitera qu'elle soit comparée à 10 ou multipliée par des ECTS.
          avg: detail.moyenne === DEFAILLANT ? null : detail.moyenne,
          defaillant: detail.defaillant,
          totalECTS: detail.ectsTotal,
          isCompensated: detail.compense,
          ues: detail.ues.map(u => ({
            nom: u.nom,
            ueAvg: u.moyenne,
            isUeValidated: u.validee,
            ects: u.ects,
            isUeDispense: u.dispense,
          })),
        };
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

  /** Classe de couleur d'une moyenne : acquise, insuffisante, ou sans note. */
  const tonMoyenne = (valeur) => {
    if (valeur === '--' || valeur === null || valeur === undefined) return 'est-vide';
    if (valeur === 'DEF') return 'est-insuffisante';
    return parseFloat(valeur) >= 10 ? 'est-acquise' : 'est-insuffisante';
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: 'var(--esp-8)' }}>

      {/* ---------- Moyenne générale ---------- */}
      <header className="el-rang el-rang--entre" style={{ marginBottom: 'var(--esp-5)', alignItems: 'flex-start' }}>
        <TitrePage>Bulletin</TitrePage>
        <div className="el-rang el-rang--serre">
          <Bouton
            variante={isSimulationMode ? 'primaire' : 'secondaire'}
            onClick={toggleSimulationMode}
            title="Modifier des notes sans rien enregistrer, pour voir l'effet sur la moyenne"
          >
            {isSimulationMode ? '● Simulation en cours' : 'Simuler'}
          </Bouton>
          <Bouton variante="fantome" onClick={() => setIsLegendOpen(true)} title="Légende des modalités de contrôle">
            Légende
          </Bouton>
        </div>
      </header>

      {isSimulationMode && (
        <div className="el-carte el-carte--compacte" style={{ marginBottom: 'var(--esp-4)', borderColor: 'var(--attention)' }}>
          <Texte petit>
            Mode simulation : tes modifications ne sont pas enregistrées. Quitte le mode pour revenir aux notes réelles.
          </Texte>
        </div>
      )}

      <section className="bulletin-bandeau">
        <div className="bulletin-bandeau__principal">
          <div className="el-surtitre">Moyenne générale de la licence</div>
          <div className={`bulletin-bandeau__moyenne ${tonMoyenne(globalAvgWithJury)}`}>
            {globalAvgWithJury}<span className="bulletin-bandeau__sur">/20</span>
          </div>
          {mention && <Pastille ton={mention === 'Ajourné' ? 'danger' : 'succes'}>Mention {mention}</Pastille>}

          <div className="bulletin-jury" style={{ marginTop: 'var(--esp-3)' }}>
            <label htmlFor="points-jury">Points de jury</label>
            <input
              id="points-jury"
              type="number" step="0.01" min="0" max="5"
              className="el-champ"
              value={pointsJury}
              onChange={(e) => setPointsJury(e.target.value)}
              aria-label="Points de jury (0 à 5)"
              title="Points accordés par le jury, plafonnés à 5"
            />
          </div>
        </div>

        <div className="bulletin-bandeau__mesures">
          <div className="bulletin-mesure">
            <b>{globalAvg}</b>
            <span>sans le jury</span>
          </div>
          <div className="bulletin-mesure">
            <b>{deugAvg}</b>
            <span>DEUG</span>
          </div>
          <div className="bulletin-mesure">
            <b style={{ color: statusColor }}>{totalAcquiredECTS}</b>
            <span>ECTS acquis</span>
          </div>
        </div>
      </section>

      {/* ---------- Statut de l'année ---------- */}
      <div className="el-carte el-carte--compacte" style={{ marginBottom: 'var(--esp-5)' }}>
        <div className="el-rang el-rang--entre">
          <div>
            <div className="el-surtitre">Statut de l'année</div>
            <div style={{ color: statusColor, fontWeight: 'var(--graisse-forte)', fontSize: 'var(--texte-lg)', marginTop: 'var(--esp-1)' }}>
              {statusAJAC}
            </div>
          </div>
          <Texte doux petit style={{ maxWidth: '42ch', textAlign: 'right' }}>
            L'AJAC autorise le passage avec au moins 24 ECTS par semestre.
          </Texte>
        </div>
      </div>

      {/* ---------- Semestres ---------- */}
      {semesterAverages.length > 0 && (
        <div className="bulletin-semestres">
          {semesterAverages.map((sem, idx) => (
            <div key={`sem-${idx}`} className="bulletin-semestre">
              <div className="bulletin-semestre__nom">{sem.nom}</div>
              <div className={`bulletin-semestre__valeur ${tonMoyenne(sem.avg)}`}>{sem.avg}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- UE ---------- */}
      {ues.length === 0 && (
        <EtatVide
          icone="📘"
          titre="Aucune UE dans cette licence"
          texte="Ajoute tes unités d'enseignement dans la Bibliothèque : le bulletin s'appuie sur elles pour calculer tes moyennes."
          actions={<Bouton variante="primaire" onClick={() => useStore.getState().setActiveTab('cours')}>Ouvrir la Bibliothèque</Bouton>}
        />
      )}

      {ues.map((ue, idx) => {
        const ueAverage = formaterMoyenne(moyenneUE(ue).moyenne);
        const replie = expandedUEs[idx];
        const conformite = conformiteUE(ue);
        /*
         * Une UE passait en « acquise, notes verrouillées » dès que sa moyenne
         * franchissait 10 — sur une seule note au besoin. La capitalisation est
         * pourtant prononcée par le jury en fin d'année, jamais en cours de
         * semestre. On exige donc que son évaluation soit achevée au sens du
         * règlement, sauf si tu as déclaré l’UE acquise toi-même : les années
         * précédentes se saisissent d'une seule moyenne récapitulative.
         */
        /*
         * Le critère précédent — au moins trois notes conformes au règlement —
         * était trop faible : trois notes sont le minimum exigé de
         * l'université, pas la preuve que l'évaluation est close. Un semestre
         * garni de trois notes par matière voyait toutes ses UE verrouillées
         * dès le mois d’août, examens encore à venir. La capitalisation est
         * prononcée par le jury en fin d'année.
         */
        const capitalisee = ue.acquise === true || ue.dispense === true
          || (capitalisedUEs.has(ue.nom) && ue.semestreTermine);
        const verrouillee = capitalisee && !unlockedUEs.has(ue.nom);

        return (
          <article key={`ue-${idx}`} className="bulletin-ue">
            <button
              type="button"
              className="bulletin-ue__entete"
              onClick={() => toggleUE(idx)}
              aria-expanded={!replie}
            >
              <div className="bulletin-ue__identite">
                <div className="bulletin-ue__semestre">{ue.semNom}</div>
                <h2 className="bulletin-ue__nom">
                  {ue.nom} {capitalisee && <span title={verrouillee ? 'UE acquise, notes verrouillées' : 'UE acquise, déverrouillée'}>{verrouillee ? '🔒' : '🔓'}</span>}
                </h2>
              </div>

              {(() => {
                if (ueAverage === '--' || ueAverage === 'DEF' || parseFloat(ueAverage) >= 10) return null;
                // Moyenne du semestre recalculée en direct, pour que le mode
                // simulation reflète immédiatement une note modifiée.
                const compensable = moyenneSemestre(licence.semestres[ue.semIndex]).compense;
                return (
                  <Pastille ton={compensable ? 'succes' : 'danger'}>
                    {compensable ? 'Compensable' : 'Non compensable'}
                  </Pastille>
                );
              })()}

              <span className={`bulletin-ue__moyenne ${tonMoyenne(ueAverage)}`}>
                {ueAverage === '--' ? 'Pas de note' : ueAverage === 'DEF' ? '⚠️ Défaillant' : `${ueAverage} / 20`}
              </span>

              <span className="bulletin-ue__chevron" aria-hidden="true">{replie ? '▸' : '▾'}</span>
            </button>

            {!replie && (
              <div className="bulletin-ue__corps">
                {capitalisee && (
                  <div className="bulletin-ue__capitalisee">
                    <div style={{ flex: 1 }}>
                      <strong>{verrouillee ? '🔒' : '🔓'} UE acquise</strong>
                      <Texte doux petit>Ses notes sont verrouillées : elle est définitivement validée.</Texte>
                    </div>
                    {verrouillee ? (
                      <Bouton onClick={() => setUnlockedUEs(prev => new Set(prev).add(ue.nom))}>Déverrouiller</Bouton>
                    ) : (
                      <Bouton variante="primaire" onClick={() => { const s = new Set(unlockedUEs); s.delete(ue.nom); setUnlockedUEs(s); }}>Reverrouiller</Bouton>
                    )}
                  </div>
                )}

                {!capitalisee && conformite.nbNotes > 0 && !conformite.conforme && (
                  <div className="bulletin-ue__provisoire" role="note">
                    <span className="bulletin-ue__provisoire-icone" aria-hidden="true">◔</span>
                    <div>
                      <strong>Moyenne provisoire</strong>
                      <Texte doux petit>
                        {conformite.sousLeMinimum
                          ? `Cette UE ne compte que ${conformite.nbNotes} note${conformite.nbNotes > 1 ? "s" : ""} sur les ${MIN_NOTES_PAR_UE} attendues.`
                          : `Une seule épreuve pèse ${Math.round(conformite.partMax * 100)} % de cette moyenne.`}
                        {" "}
                        Le règlement prévoit au moins {MIN_NOTES_PAR_UE} notes par UE, dont aucune
                        ne dépasse 50 % du total. Lis ce chiffre comme une tendance, pas comme un résultat.
                      </Texte>
                    </div>
                  </div>
                )}
                {(() => {
                  const sommeCoefsUE = ue.matieres?.reduce(
                    (acc, m) => acc + (m.dispense ? 0 : (m.coefficient !== undefined ? Number(m.coefficient) : 1)), 0
                  ) || 1;

                  return ue.matieres?.map((matiere, matIndex) => {
                    const dispensee = matiere.dispense === true;
                    const moyenne = moyenneMatiere(matiere.evaluations);
                    const coef = matiere.coefficient !== undefined ? Number(matiere.coefficient) : 1;
                    const sommeCoefsEval = matiere.evaluations?.reduce((acc, e) => acc + (Number(e.coefficient) || 0), 0) || 1;
                    const projete = intelligence?.projectedScoreMap?.[(matiere.nom || '').toLowerCase().trim()];

                    return (
                      <div key={`mat-${matIndex}`} className={`bulletin-matiere${dispensee ? ' est-dispensee' : ''}`}>
                        <div className="bulletin-matiere__entete">
                          <span className="bulletin-matiere__nom">{matiere.nom}</span>
                          {dispensee && <Pastille ton="succes">Dispensé</Pastille>}
                          {projete !== undefined && !dispensee && (
                            <Pastille ton="accent" title="Score projeté par l'analyse de tes résultats">
                              Projeté {projete}/20
                            </Pastille>
                          )}
                          <span className="bulletin-matiere__moyenne">
                            {/* `moyenne` peut valoir 'DEF' : appeler toFixed dessus
                                faisait tomber toute la page. */}
                            {moyenne === DEFAILLANT ? 'DEF' : moyenne !== null ? `${formaterMoyenne(moyenne)} / 20` : '—'}
                          </span>
                        </div>

                        <div className="bulletin-evaluations">
                          {matiere.evaluations?.map((ev, evIndex) => {
                            const coefEval = Number(ev.coefficient) || 0;
                            // Poids de cette seule note dans l'UE entière.
                            const poids = (coefEval / sommeCoefsEval) * (coef / sommeCoefsUE);

                            return (
                              <LigneEvaluation
                                key={`ev-${evIndex}`}
                                evaluation={ev}
                                verrouillee={verrouillee}
                                horsRegle={poids > 0.5}
                                poidsDansUE={poids}
                                onRenommer={(v) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, 'nom', v)}
                                onChangerChamp={(champ, v) => handleUpdateEvalField(ue.semIndex, ue.ueIndex, matIndex, evIndex, champ, v)}
                                onChangerNote={(v) => handleUpdateNote(ue.semIndex, ue.ueIndex, matIndex, evIndex, v)}
                                onSupprimer={() => handleDeleteEval(ue.semIndex, ue.ueIndex, matIndex, evIndex)}
                              />
                            );
                          })}

                          <button
                            type="button"
                            className="evaluation__ajouter"
                            disabled={verrouillee}
                            onClick={() => handleAddEval(ue.semIndex, ue.ueIndex, matIndex)}
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
          </article>
        );
      })}

      <ConfirmModal
        isOpen={deleteEvalConfirm !== null}
        title="Supprimer l'épreuve"
        message="Supprimer cette épreuve et sa note du bulletin ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={handleConfirmDeleteEval}
        onCancel={() => setDeleteEvalConfirm(null)}
      />

      {isLegendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Légende des modalités de contrôle"
          onClick={(e) => { if (e.target === e.currentTarget) setIsLegendOpen(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--esp-4)'
          }}
        >
          <div className="el-carte" style={{ maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="el-rang el-rang--entre" style={{ marginBottom: 'var(--esp-4)' }}>
              <h2 className="el-titre-section">Légende des modalités</h2>
              <Bouton variante="fantome" onClick={() => setIsLegendOpen(false)} aria-label="Fermer la légende">✕</Bouton>
            </div>

            <div className="el-pile">
              <div>
                <div className="el-surtitre">Type d'épreuve</div>
                <Texte petit doux><b>AC</b> — avec convocation : la présence est obligatoire et contrôlée.</Texte>
                <Texte petit doux><b>SC</b> — sans convocation : évaluation intégrée au cours.</Texte>
              </div>
              <div>
                <div className="el-surtitre">Statut de présence</div>
                <Texte petit doux><b>Neutralisée</b> — absence justifiée : l'épreuve ne compte pas dans la moyenne.</Texte>
                <Texte petit doux><b>Défaillant</b> — absence injustifiée : elle bloque le calcul de l'UE entière.</Texte>
              </div>
              <div>
                <div className="el-surtitre">Compensation</div>
                <Texte petit doux>
                  Une UE sous 10 reste acquise si la moyenne du semestre atteint 10.
                  Une UE acquise est capitalisée : ses notes se verrouillent.
                </Texte>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
