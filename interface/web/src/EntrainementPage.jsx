import { useState, useMemo } from 'react';

function EntrainementPage({ coursConfig, onSave, saving }) {
  const [configLocal, setConfigLocal] = useState(coursConfig || { semestres: [] });

  // Récupération des exercices du jour
  const exercicesDuJour = useMemo(() => {
    let exosToReview = [];
    const todayStr = new Date().toISOString().split('T')[0];

    configLocal.semestres.forEach((s, sIndex) => {
      s.ues.forEach((u, uIndex) => {
        u.matieres.forEach((m, mIndex) => {
          
          const extractExos = (listeExos, type) => {
            if (!listeExos) return [];
            return listeExos
              .map((ex, exIndex) => ({
                ...ex, sIndex, uIndex, mIndex, exIndex, type, matiereNom: m.nom
              }))
              // Exclure ceux déjà faits aujourd'hui
              .filter(ex => ex.dernierePratique !== todayStr)
              // Trier par nombre de pratiques (les moins pratiqués en premier)
              // puis par date de dernière pratique
              .sort((a, b) => {
                if (a.nombrePratiques !== b.nombrePratiques) return a.nombrePratiques - b.nombrePratiques;
                return (a.dernierePratique || "0000").localeCompare(b.dernierePratique || "0000");
              });
          };

          const tds = extractExos(m.listeTD, 'TD');
          const tps = extractExos(m.listeTP, 'TP');

          // Prendre max 2 TD et 1 TP par matière par jour
          exosToReview.push(...tds.slice(0, 2));
          exosToReview.push(...tps.slice(0, 1));
        });
      });
    });

    return exosToReview;
  }, [configLocal]);

  const markAsDone = (exo) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newConf = { ...configLocal };
    
    const targetList = exo.type === 'TD' 
        ? newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTD 
        : newConf.semestres[exo.sIndex].ues[exo.uIndex].matieres[exo.mIndex].listeTP;

    targetList[exo.exIndex].dernierePratique = todayStr;
    targetList[exo.exIndex].nombrePratiques = (targetList[exo.exIndex].nombrePratiques || 0) + 1;
    
    setConfigLocal(newConf);
    onSave(newConf);
  };

  return (
    <div className="entrainement-page">
      <div className="cours-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <h2>🏋️ Entraînement Quotidien</h2>
        <span style={{color:'var(--text-secondary)'}}>{exercicesDuJour.length} exercices prévus aujourd'hui.</span>
      </div>

      {exercicesDuJour.length === 0 ? (
        <div className="card glass-panel" style={{textAlign:'center', padding:'3rem'}}>
          <h3>🎉 Tout est à jour !</h3>
          <p style={{color:'var(--text-secondary)'}}>Tu as complété tous tes exercices du jour ou aucun PDF n'a été scanné.</p>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1.5rem'}}>
          {exercicesDuJour.map((exo, i) => (
            <div key={i} className="card glass-panel" style={{borderTop:`4px solid ${exo.type==='TD' ? '#34D399' : '#FBBF24'}`}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                <span style={{background:'var(--bg-tertiary)', padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.8rem'}}>
                  {exo.matiereNom} ({exo.type})
                </span>
                <span style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                  Pratiqué {exo.nombrePratiques || 0} fois
                </span>
              </div>
              
              <h3 style={{margin:'0 0 1rem 0'}}>{exo.titre}</h3>
              
              <div style={{display:'flex', gap:'1rem'}}>
                <a 
                  href={`http://localhost:3001${exo.pdfSource}#page=${exo.page}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary"
                  style={{flex:1, textAlign:'center', textDecoration:'none', padding:'0.6rem'}}
                >
                  Ouvrir Page {exo.page}
                </a>
                
                <button 
                  onClick={() => markAsDone(exo)}
                  className="btn-secondary"
                  disabled={saving}
                  style={{background:'#10B981', color:'white', border:'none'}}
                >
                  ✓ Fait
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EntrainementPage;
