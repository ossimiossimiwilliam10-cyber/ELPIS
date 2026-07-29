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
    (nom === "Construction Mécanique" && m.nom.toLowerCase().includes('construction mécanique')) ||
    (nom === "Electromagnétisme" && m.nom.toLowerCase().includes('magnétisme')) ||
    (nom === "Langues" && (m.nom.toLowerCase().includes('anglais') || m.nom.toLowerCase().includes('langue')))
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
  // 1. Update Exam Date
  updateExamDate("Construction Mécanique", "2027-01-18");

})();

console.log('Finished updating week 20 schedule.');
