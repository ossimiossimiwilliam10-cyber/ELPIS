const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// Get matieres
const matieres = db.prepare(`
  SELECT m.id, m.nom 
  FROM matieres m 
  JOIN ues u ON m.ue_id = u.id 
  JOIN semestres s ON u.semestre_id = s.id 
  JOIN licences l ON s.licence_id = l.id 
  WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
`).all();

const dates = [
  { nom: 'Introduction aux systèmes électroniques', cm: 'CM 1', date: '2026-09-08' },
  { nom: 'Programmation', cm: 'CM 1', date: '2026-09-08' },
  { nom: 'Electromagnétisme', cm: 'CM 1', date: '2026-09-08' },
  { nom: 'Algèbre', cm: 'CM 1', date: '2026-09-09' },
  { nom: 'Analyse', cm: 'CM 1', date: '2026-09-09' },
  { nom: 'Programmation', cm: 'CM 2', date: '2026-09-10' },
  { nom: "Architecture des systèmes d'exploitation", cm: 'CM 1', date: '2026-09-10' },
  { nom: 'Construction mécanique', cm: 'CM 1', date: '2026-09-10' },
  { nom: "Architecture des systèmes d'exploitation", cm: 'CM 2', date: '2026-09-11' }
];

const updateCM = db.prepare(`
  UPDATE cours_cm 
  SET dateCM = ? 
  WHERE titre = ? AND matiere_id = ?
`);

db.transaction(() => {
  for (const d of dates) {
    let mat = matieres.find(m => m.nom.toLowerCase().includes(d.nom.toLowerCase()) || 
      (d.nom === "Architecture des systèmes d'exploitation" && m.nom.toLowerCase().includes('exploitation')) ||
      (d.nom === "Electromagnétisme" && m.nom.toLowerCase().includes('magnétisme')) ||
      (d.nom === "Construction mécanique" && m.nom.toLowerCase().includes('mécanique'))
    );
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    } else {
      console.log(`Matiere not found for ${d.nom}`);
    }
  }
})();

console.log('Finished updating dates for week 1.');
