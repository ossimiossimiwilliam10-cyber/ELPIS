const Database = require('better-sqlite3');
const path = require('path');

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
    (nom === "STS" && m.nom.toLowerCase().includes('signal et technologie en santé')) ||
    (nom === "Construction Mécanique" && m.nom.toLowerCase().includes('construction mécanique'))
  );
};

const updateExamDate = (matName, newDate) => {
  const mat = findMatiere(matName);
  if (!mat) return;
  
  let dates = [];
  if (mat.dateExamen) {
    if (mat.dateExamen.startsWith('[')) {
      dates = JSON.parse(mat.dateExamen);
    } else {
      dates = [mat.dateExamen];
    }
  }
  
  if (!dates.includes(newDate)) {
    dates.push(newDate);
    db.prepare(`UPDATE matieres SET dateExamen = ? WHERE id = ?`).run(JSON.stringify(dates), mat.id);
    console.log(`Updated exam date for ${matName} to include ${newDate}`);
  }
};

db.transaction(() => {
  // 1. Update Exam Dates
  updateExamDate("Programmation", "2026-10-20");
  updateExamDate("Architecture des systèmes d'exploitation", "2026-10-23");
  updateExamDate("Introduction aux Systèmes Electroniques", "2026-10-23");

  // 2. TDs dates
  const datesTD = [
    { nom: 'Construction Mécanique', td: 'TD 2', date: '2026-10-20' },
    { nom: 'STS', td: 'TD 3', date: '2026-10-21' },
    { nom: 'Mécanique du solide', td: 'TD 2', date: '2026-10-22' },
    { nom: 'Mécanique du solide', td: 'TD 3', date: '2026-10-22' }
  ];
  
  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${mat.nom} ${d.td} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 3. TPs dates
  const datesTP = [
    { nom: 'Analyse', tp: 'TP 3', date: '2026-10-21' },
    { nom: 'Algèbre', tp: 'TP 3', date: '2026-10-21' }
  ];
  
  const updateTP = db.prepare(`UPDATE exercices SET dateTP = ? WHERE type = 'TP' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTP) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTP.run(d.date, d.tp, mat.id);
      console.log(`Updated TP ${mat.nom} ${d.tp} to ${d.date} - Changes: ${info.changes}`);
    }
  }

})();

console.log('Finished updating week 7 schedule.');
