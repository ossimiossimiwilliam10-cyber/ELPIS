import { useState, useEffect } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';
import MarkdownModal from './MarkdownModal';
import ExerciceRow from './components/cours/ExerciceRow';
import { getApiUrl } from './utils/apiConfig';

export default function PreparationHebdoPage() {
  const { config, setConfig, coursConfig, setCoursConfig } = useStore();
  const [configLocal, setConfigLocal] = useState(coursConfig || { licences: [] });
  const [isSunday, setIsSunday] = useState(new Date().getDay() === 0);

  // Mémoriser toutes les matières existantes pour le menu déroulant
  const allMatieres = [];
  if (configLocal.licences) {
    configLocal.licences.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(ue => {
          ue.matieres?.forEach(m => {
            if (!allMatieres.includes(m.nom)) allMatieres.push(m.nom);
          });
        });
      });
    });
  }

  // MarkdownModal state
  const [mdModal, setMdModal] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });

  // Mettre à jour isSunday dynamiquement (au cas où la page reste ouverte)
  useEffect(() => {
    const check = () => setIsSunday(new Date().getDay() === 0);
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Resynchroniser le state local quand le store change
  const [prevCoursConfig, setPrevCoursConfig] = useState(null);
  if (coursConfig !== prevCoursConfig) {
    setPrevCoursConfig(coursConfig);
    if (coursConfig) setConfigLocal(coursConfig);
  }

  const mutateAndSave = (recipe) => {
    setConfigLocal(prev => {
      const newConf = produce(prev, recipe);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  // ─── Ajouter un exercice ───
  const addEx = (l, s, u, m, type) => {
    mutateAndSave(draft => {
      const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
      const template = {
        titre: type === 'Annale' ? 'Nouvelle Annale' : `Nouvel Exercice de ${type}`,
        dernierePratique: '',
        nombrePratiques: 0,
        notes: '',
        pdfPath: '',
        difficulteInitiale: type === 'Annale' ? 3 : 1,
      };
      if (type === 'TP') template.dateTP = '';

      if (type === 'TD') {
        if (!mat.listeTD) mat.listeTD = [];
        mat.listeTD.push(template);
      } else if (type === 'TP') {
        if (!mat.listeTP) mat.listeTP = [];
        mat.listeTP.push(template);
      } else if (type === 'Annale') {
        if (!mat.listeAnnales) mat.listeAnnales = [];
        mat.listeAnnales.push(template);
      }
    });
  };

  // ─── Supprimer un exercice ───
  const deleteEx = (l, s, u, m, type, exIndex) => {
    if (!window.confirm(`Supprimer cet exercice de ${type} ?`)) return;
    mutateAndSave(draft => {
      const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
      if (type === 'TD') mat.listeTD?.splice(exIndex, 1);
      else if (type === 'TP') mat.listeTP?.splice(exIndex, 1);
      else if (type === 'Annale') mat.listeAnnales?.splice(exIndex, 1);
    });
  };

  // ─── Upload PDF ───
  const handleUploadPdf = (l, s, u, m, type, exIndex) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) {
        alert("Ce fichier est trop volumineux. La limite est de 25 Mo.");
        return;
      }
      const formData = new FormData();
      formData.append('pdf', file);
      try {
        const res = await fetch(`${getApiUrl()}/upload/pdf`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          mutateAndSave(draft => {
            const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
            let liste;
            if (type === 'TD') liste = mat.listeTD;
            else if (type === 'TP') liste = mat.listeTP;
            else liste = mat.listeAnnales;
            if (liste && liste[exIndex]) liste[exIndex].pdfPath = data.url;
          });
        } else {
          alert("Erreur lors de l'upload : " + (data.error || 'inconnue'));
        }
      } catch (err) {
        console.error(err);
        alert("Erreur réseau lors de l'upload.");
      }
    };
    input.click();
  };

  // ─── Édition Markdown ───
  const openMarkdownModal = (l, s, u, m, type, exIndex, exercice) => {
    const listeKey = type === 'TD' ? 'listeTD' : type === 'TP' ? 'listeTP' : 'listeAnnales';
    setMdModal({
      isOpen: true,
      title: `Notes ${type} : ${exercice.titre}`,
      initialValue: exercice.notes || '',
      onSave: (val) => mutateAndSave(draft => {
        const liste = draft.licences[l].semestres[s].ues[u].matieres[m][listeKey];
        if (liste && liste[exIndex]) liste[exIndex].notes = val;
      }),
    });
  };

  // ─── Mise à jour d'un champ ───
  const updateExField = (l, s, u, m, type, exIndex, field, value) => {
    const listeKey = type === 'TD' ? 'listeTD' : type === 'TP' ? 'listeTP' : 'listeAnnales';
    mutateAndSave(draft => {
      const liste = draft.licences[l].semestres[s].ues[u].matieres[m][listeKey];
      if (liste && liste[exIndex]) liste[exIndex][field] = value;
    });
  };

  // ─── Calcul des matières à déficit ───
  const matieresADeficit = [];

  if (configLocal.licences) {
    configLocal.licences.forEach((licence, l) => {
      licence.semestres?.forEach((semestre, s) => {
        semestre.ues?.forEach((ue, u) => {
          ue.matieres?.forEach((matiere, m) => {
            const listeTD = matiere.listeTD || [];
            const listeTP = matiere.listeTP || [];
            const listeAnnales = matiere.listeAnnales || [];

            const unpracticedTD = listeTD.filter(item => (item.nombrePratiques || 0) === 0).length;
            const unpracticedTP = listeTP.filter(item => (item.nombrePratiques || 0) === 0).length;
            const unpracticedAnnales = listeAnnales.filter(item => (item.nombrePratiques || 0) === 0).length;

            const missingTD = Math.max(0, 7 - unpracticedTD);
            const missingTP = Math.max(0, 1 - unpracticedTP);
            const missingAnnales = Math.max(0, 1 - unpracticedAnnales);

            if (missingTD > 0 || missingTP > 0 || missingAnnales > 0 || unpracticedTD > 0 || unpracticedTP > 0 || unpracticedAnnales > 0) {
              matieresADeficit.push({
                l, s, u, m,
                nom: matiere.nom,
                pathName: `${licence.nom} > ${semestre.nom} > ${ue.nom}`,
                missingTD, missingTP, missingAnnales,
                unpracticedTD, unpracticedTP, unpracticedAnnales,
                // Références aux listes pour l'affichage inline
                listeTD, listeTP, listeAnnales,
              });
            }
          });
        });
      });
    });
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span>📅</span> Préparation Hebdomadaire
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Analysez l'état de votre réserve d'exercices. Complétez vos quotas de 7 TD, 1 TP et 1 Annale non pratiqués pour la semaine.
        </p>
      </div>

      {!isSunday && (
        <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem', color: '#fbbf24', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong>Ce n'est pas dimanche !</strong><br />
            Cet onglet est conçu pour votre rituel de planification du dimanche soir. Vous pouvez tout de même ajouter des exercices si nécessaire.
          </div>
        </div>
      )}

      {/* ─── Engagements Fixes de la Semaine ─── */}
      <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ margin: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f43f5e' }}>
          <span>⏰</span> Engagements de la Semaine
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Renseignez vos heures de cours, TP ou travail prévus. L'algorithme les déduira de votre temps libre et adaptera ses révisions.
        </p>

        <button
          onClick={() => setConfig({...config, fixedCommitments: [...(config?.fixedCommitments||[]), {day: 'Lundi', start: '08:00', end: '10:00', matiereLinked: ''}]})}
          style={{marginBottom: '1rem', padding: '0.6rem', background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
        >
          + Ajouter un Engagement
        </button>

        <div style={{display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
          {(config?.fixedCommitments || []).map((commitment, idx) => (
            <div key={idx} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px', flexWrap: 'wrap'}}>
              <select
                value={commitment.day}
                onChange={e => {
                  const newComs = [...(config?.fixedCommitments || [])];
                  newComs[idx].day = e.target.value;
                  setConfig({...config, fixedCommitments: newComs});
                }}
                style={{padding: '0.3rem', borderRadius: '4px', background: 'var(--bg-primary)', color: 'white', border: 'none'}}
              >
                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Tous les jours'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                type="time"
                value={commitment.start}
                onChange={e => {
                  const newComs = [...(config?.fixedCommitments || [])];
                  newComs[idx].start = e.target.value;
                  setConfig({...config, fixedCommitments: newComs});
                }}
                style={{padding: '0.3rem', borderRadius: '4px', background: 'var(--bg-primary)', color: 'white', border: 'none'}}
              />
              <span style={{color: 'var(--text-secondary)'}}>à</span>
              <input
                type="time"
                value={commitment.end}
                onChange={e => {
                  const newComs = [...(config?.fixedCommitments || [])];
                  newComs[idx].end = e.target.value;
                  setConfig({...config, fixedCommitments: newComs});
                }}
                style={{padding: '0.3rem', borderRadius: '4px', background: 'var(--bg-primary)', color: 'white', border: 'none'}}
              />

              {/* Dropdown Matière Liée */}
              <select
                value={commitment.matiereLinked || ''}
                onChange={e => {
                  const newComs = [...(config?.fixedCommitments || [])];
                  newComs[idx].matiereLinked = e.target.value;
                  setConfig({...config, fixedCommitments: newComs});
                }}
                style={{padding: '0.3rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', flexGrow: 1}}
              >
                <option value="">-- Aucune matière spécifique --</option>
                {allMatieres.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <button
                onClick={() => {
                  const newComs = config.fixedCommitments.filter((_, i) => i !== idx);
                  setConfig({...config, fixedCommitments: newComs});
                }}
                style={{background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem'}}
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {matieresADeficit.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--bg-tertiary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h3 style={{ margin: 0 }}>Tout est prêt pour la semaine !</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Toutes vos matières ont atteint leur réserve cible.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {matieresADeficit.map((mat) => (
            <motion.div
              key={`${mat.l}-${mat.s}-${mat.u}-${mat.m}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{mat.pathName}</div>
              <h3 style={{ margin: 0, marginBottom: '1.2rem', fontSize: '1.2rem', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '0.5rem' }}>{mat.nom}</h3>

              {/* ─── TD ─── */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>TD en réserve</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {mat.unpracticedTD}/7 {mat.missingTD > 0 && <span style={{ color: 'var(--danger-color)' }}>({mat.missingTD} manquants)</span>}
                    </div>
                  </div>
                  {mat.missingTD > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'TD')}>+ 1 TD</button>
                  ) : (
                    <span style={{ color: '#4ade80' }}>✅ OK</span>
                  )}
                </div>
                {/* Exercices TD existants (non pratiqués) */}
                <AnimatePresence>
                  {mat.listeTD
                    .map((ex, i) => ({ ex, i }))
                    .filter(({ ex }) => (ex.nombrePratiques || 0) === 0)
                    .map(({ ex, i }) => (
                      <motion.div
                        key={`td-${i}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ExerciceRow
                          exercice={ex}
                          type="TD"
                          onUpdate={(field, val) => updateExField(mat.l, mat.s, mat.u, mat.m, 'TD', i, field, val)}
                          onDelete={() => deleteEx(mat.l, mat.s, mat.u, mat.m, 'TD', i)}
                          onUploadPdf={() => handleUploadPdf(mat.l, mat.s, mat.u, mat.m, 'TD', i)}
                          onEditNotes={() => openMarkdownModal(mat.l, mat.s, mat.u, mat.m, 'TD', i, ex)}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>

              {/* ─── TP ─── */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>TP en réserve</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {mat.unpracticedTP}/1 {mat.missingTP > 0 && <span style={{ color: 'var(--danger-color)' }}>({mat.missingTP} manquants)</span>}
                    </div>
                  </div>
                  {mat.missingTP > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'TP')}>+ 1 TP</button>
                  ) : (
                    <span style={{ color: '#4ade80' }}>✅ OK</span>
                  )}
                </div>
                <AnimatePresence>
                  {mat.listeTP
                    .map((ex, i) => ({ ex, i }))
                    .filter(({ ex }) => (ex.nombrePratiques || 0) === 0)
                    .map(({ ex, i }) => (
                      <motion.div
                        key={`tp-${i}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ExerciceRow
                          exercice={ex}
                          type="TP"
                          onUpdate={(field, val) => updateExField(mat.l, mat.s, mat.u, mat.m, 'TP', i, field, val)}
                          onDelete={() => deleteEx(mat.l, mat.s, mat.u, mat.m, 'TP', i)}
                          onUploadPdf={() => handleUploadPdf(mat.l, mat.s, mat.u, mat.m, 'TP', i)}
                          onEditNotes={() => openMarkdownModal(mat.l, mat.s, mat.u, mat.m, 'TP', i, ex)}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>

              {/* ─── Annales ─── */}
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Annales en réserve</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {mat.unpracticedAnnales}/1 {mat.missingAnnales > 0 && <span style={{ color: 'var(--danger-color)' }}>({mat.missingAnnales} manquants)</span>}
                    </div>
                  </div>
                  {mat.missingAnnales > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'Annale')}>+ 1 Annale</button>
                  ) : (
                    <span style={{ color: '#4ade80' }}>✅ OK</span>
                  )}
                </div>
                <AnimatePresence>
                  {mat.listeAnnales
                    .map((ex, i) => ({ ex, i }))
                    .filter(({ ex }) => (ex.nombrePratiques || 0) === 0)
                    .map(({ ex, i }) => (
                      <motion.div
                        key={`annale-${i}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ExerciceRow
                          exercice={ex}
                          type="Annale"
                          onUpdate={(field, val) => updateExField(mat.l, mat.s, mat.u, mat.m, 'Annale', i, field, val)}
                          onDelete={() => deleteEx(mat.l, mat.s, mat.u, mat.m, 'Annale', i)}
                          onUploadPdf={() => handleUploadPdf(mat.l, mat.s, mat.u, mat.m, 'Annale', i)}
                          onEditNotes={() => openMarkdownModal(mat.l, mat.s, mat.u, mat.m, 'Annale', i, ex)}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── Markdown Modal ─── */}
      <MarkdownModal
        isOpen={mdModal.isOpen}
        title={mdModal.title}
        initialValue={mdModal.initialValue}
        onClose={() => setMdModal(prev => ({ ...prev, isOpen: false }))}
        onSave={(val) => {
          if (mdModal.onSave) mdModal.onSave(val);
        }}
      />
    </div>
  );
}
