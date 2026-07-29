const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

const matieres = db.prepare(`
  SELECT m.id, m.nom, m.dateExamen, u.id as ue_id
  FROM matieres m 
  JOIN ues u ON m.ue_id = u.id 
  JOIN semestres s ON u.semestre_id = s.id 
  JOIN licences l ON s.licence_id = l.id 
  WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
`).all();

const findMatiere = (nom) => {
  return matieres.find(m => m.nom.toLowerCase().includes(nom.toLowerCase()) || 
    (nom === "Architecture des systèmes d'exploitation" && m.nom.toLowerCase().includes('exploitation')) ||
    (nom === "Introduction aux Systèmes Electroniques" && m.nom.toLowerCase().includes('introduction aux systèmes électroniques')) ||
    (nom === "Construction Mécanique" && m.nom.toLowerCase().includes('construction mécanique')) ||
    (nom === "Electromagnétisme" && m.nom.toLowerCase().includes('magnétisme')) ||
    (nom === "Langues" && (m.nom.toLowerCase().includes('anglais') || m.nom.toLowerCase().includes('langue')))
  );
};

db.transaction(() => {
  // 1. Update Dates for TDs
  const datesTD = [
    { nom: 'Electromagnétisme', td: 'TD 6', date: '2026-12-07' },
    { nom: 'Programmation', td: 'TD 4', date: '2026-12-08' },
    { nom: 'Mécanique du solide', td: 'TD 6', date: '2026-12-10' }
  ];
  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${d.nom} ${d.td} to ${d.date}`);
    }
  }

  // 2. Update Dates for TPs
  const datesTP = [
    { nom: 'Introduction aux Systèmes Electroniques', tp: 'TP 3', date: '2026-12-07' },
    { nom: 'Algèbre', tp: 'TP 5', date: '2026-12-09' },
    { nom: 'Analyse', tp: 'TP 5', date: '2026-12-09' }
  ];
  const updateTP = db.prepare(`UPDATE exercices SET dateTP = ? WHERE type = 'TP' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTP) {
    const mat = findMatiere(d.nom);
    if(mat) {
      updateTP.run(d.date, d.tp, mat.id);
      console.log(`Updated TP ${d.nom} ${d.tp} to ${d.date}`);
    }
  }

})();

console.log('Finished updating week 14 schedule.');
