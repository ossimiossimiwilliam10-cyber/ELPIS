import { useState, useEffect } from 'react';
import { produce } from 'immer';
import { motion } from 'framer-motion';
import useStore from './store';

export default function PreparationHebdoPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const [configLocal, setConfigLocal] = useState(coursConfig || { licences: [] });
  const [isSunday, setIsSunday] = useState(new Date().getDay() === 0);

  useEffect(() => {
    if (coursConfig) setConfigLocal(coursConfig);
  }, [coursConfig]);

  const mutateAndSave = (recipe) => {
    setConfigLocal(prev => {
      const newConf = produce(prev, recipe);
      setCoursConfig(newConf);
      return newConf;
    });
  };

  const addEx = (l, s, u, m, type) => {
    mutateAndSave(draft => {
      const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
      if (type === 'TD') {
        if (!mat.listeTD) mat.listeTD = [];
        mat.listeTD.push({ titre: "Nouvel Exercice de TD", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
      } else if (type === 'TP') {
        if (!mat.listeTP) mat.listeTP = [];
        mat.listeTP.push({ titre: "Nouvel Exercice de TP", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
      } else if (type === 'Annale') {
        if (!mat.listeAnnales) mat.listeAnnales = [];
        mat.listeAnnales.push({ titre: "Nouvelle Annale", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
      }
    });
  };

  const matieresADeficit = [];

  if (configLocal.licences) {
    configLocal.licences.forEach((licence, l) => {
      licence.semestres?.forEach((semestre, s) => {
        semestre.ues?.forEach((ue, u) => {
          ue.matieres?.forEach((matiere, m) => {
            const unpracticedTD = (matiere.listeTD || []).filter(item => item.nombrePratiques === 0).length;
            const unpracticedTP = (matiere.listeTP || []).filter(item => item.nombrePratiques === 0).length;
            const unpracticedAnnales = (matiere.listeAnnales || []).filter(item => item.nombrePratiques === 0).length;

            const missingTD = Math.max(0, 7 - unpracticedTD);
            const missingTP = Math.max(0, 1 - unpracticedTP);
            const missingAnnales = Math.max(0, 1 - unpracticedAnnales);

            if (missingTD > 0 || missingTP > 0 || missingAnnales > 0) {
              matieresADeficit.push({
                l, s, u, m,
                nom: matiere.nom,
                pathName: `${licence.nom} > ${semestre.nom} > ${ue.nom}`,
                missingTD, missingTP, missingAnnales,
                unpracticedTD, unpracticedTP, unpracticedAnnales
              });
            }
          });
        });
      });
    });
  }

  return (
    <div className="page-container" style={{padding:'2rem'}}>
      <div style={{marginBottom:'2rem'}}>
        <h2 style={{margin:0, display:'flex', alignItems:'center', gap:'0.8rem'}}>
          <span>📅</span> Préparation Hebdomadaire
        </h2>
        <p style={{color:'var(--text-secondary)', marginTop:'0.5rem'}}>
          Analysez l'état de votre réserve d'exercices. Complétez vos quotas de 7 TD, 1 TP et 1 Annale non pratiqués pour la semaine.
        </p>
      </div>

      {!isSunday && (
        <div style={{background:'rgba(251, 191, 36, 0.1)', border:'1px solid rgba(251, 191, 36, 0.3)', borderRadius:'8px', padding:'1rem', marginBottom:'2rem', color:'#fbbf24', display:'flex', gap:'1rem', alignItems:'center'}}>
          <span style={{fontSize:'1.5rem'}}>⚠️</span>
          <div>
            <strong>Ce n'est pas dimanche !</strong><br/>
            Cet onglet est conçu pour votre rituel de planification du dimanche soir. Vous pouvez tout de même ajouter des exercices si nécessaire.
          </div>
        </div>
      )}

      {matieresADeficit.length === 0 ? (
        <div style={{textAlign:'center', padding:'4rem', background:'rgba(255,255,255,0.02)', borderRadius:'12px', border:'1px dashed var(--bg-tertiary)'}}>
          <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🎉</div>
          <h3 style={{margin:0}}>Tout est prêt pour la semaine !</h3>
          <p style={{color:'var(--text-secondary)'}}>Toutes vos matières ont atteint leur réserve cible.</p>
        </div>
      ) : (
        <div style={{display:'grid', gap:'1.5rem', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))'}}>
          {matieresADeficit.map((mat, idx) => (
            <motion.div 
              key={`${mat.l}-${mat.s}-${mat.u}-${mat.m}`}
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              style={{background:'rgba(15, 23, 42, 0.4)', borderRadius:'8px', padding:'1.5rem', border:'1px solid rgba(255,255,255,0.05)'}}
            >
              <div style={{fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'0.3rem'}}>{mat.pathName}</div>
              <h3 style={{margin:0, marginBottom:'1.5rem', fontSize:'1.2rem', borderBottom:'1px solid var(--bg-tertiary)', paddingBottom:'0.5rem'}}>{mat.nom}</h3>
              
              <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'bold'}}>TD en réserve</div>
                    <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                      {mat.unpracticedTD}/7 <span style={{color:'var(--danger-color)', marginLeft:'4px'}}>({mat.missingTD} manquants)</span>
                    </div>
                  </div>
                  {mat.missingTD > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'TD')}>+ 1 TD</button>
                  ) : (
                    <span style={{color:'#4ade80'}}>✅ OK</span>
                  )}
                </div>

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'bold'}}>TP en réserve</div>
                    <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                      {mat.unpracticedTP}/1 <span style={{color:'var(--danger-color)', marginLeft:'4px'}}>({mat.missingTP} manquants)</span>
                    </div>
                  </div>
                  {mat.missingTP > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'TP')}>+ 1 TP</button>
                  ) : (
                    <span style={{color:'#4ade80'}}>✅ OK</span>
                  )}
                </div>

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'bold'}}>Annales en réserve</div>
                    <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                      {mat.unpracticedAnnales}/1 <span style={{color:'var(--danger-color)', marginLeft:'4px'}}>({mat.missingAnnales} manquants)</span>
                    </div>
                  </div>
                  {mat.missingAnnales > 0 ? (
                    <button className="btn-secondary" onClick={() => addEx(mat.l, mat.s, mat.u, mat.m, 'Annale')}>+ 1 Annale</button>
                  ) : (
                    <span style={{color:'#4ade80'}}>✅ OK</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
