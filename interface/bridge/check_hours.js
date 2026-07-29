const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath);

const matieres = db.prepare(`
  SELECT m.id, m.nom, m.dateExamen
  FROM matieres m 
  JOIN ues u ON m.ue_id = u.id 
  JOIN semestres s ON u.semestre_id = s.id 
  JOIN licences l ON s.licence_id = l.id 
  WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
`).all();

console.log("=== HEURES Semestre 3 ===");
for (const m of matieres) {
  const exercices = db.prepare("SELECT type, dateDebut, dateFin FROM exercices WHERE matiere_id=?").all(m.id);
  
  let hours = { CM: 0, TD: 0, TP: 0 };
  for (let ex of exercices) {
      if (hours[ex.type] !== undefined) {
          const start = new Date(ex.dateDebut);
          const end = new Date(ex.dateFin);
          const diff = (end - start) / 3600000;
          hours[ex.type] += diff;
      }
  }
  
  console.log(`- **${m.nom}** : ${hours.CM}h CM, ${hours.TD}h TD, ${hours.TP}h TP`);
}
