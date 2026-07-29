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

console.log("=== Bilan du Semestre 3 ===");
for (const m of matieres) {
  const cms = db.prepare("SELECT count(*) as c FROM exercices WHERE type='CM' AND matiere_id=?").get(m.id).c;
  const tds = db.prepare("SELECT count(*) as c FROM exercices WHERE type='TD' AND matiere_id=?").get(m.id).c;
  const tps = db.prepare("SELECT count(*) as c FROM exercices WHERE type='TP' AND matiere_id=?").get(m.id).c;
  
  let dates = m.dateExamen ? JSON.parse(m.dateExamen).join(', ') : 'Aucune';
  
  console.log(`- **${m.nom}** : ${cms} CMs, ${tds} TDs, ${tps} TPs (Examens: ${dates})`);
}
