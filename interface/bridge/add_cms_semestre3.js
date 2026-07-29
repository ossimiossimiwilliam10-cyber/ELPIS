const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// Update config table for studyStartDate
try {
  db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('studyStartDate', '"2026-09-07"')`).run();
} catch (e) {
  console.log("Config error", e);
}

// Get all matieres for S3 (by joining ues -> semestres -> licences)
const s3Matieres = db.prepare(`
  SELECT m.id, m.nom, u.nom as ue_nom 
  FROM matieres m
  JOIN ues u ON m.ue_id = u.id
  JOIN semestres s ON u.semestre_id = s.id
  JOIN licences l ON s.licence_id = l.id
  WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
`).all();

console.log(s3Matieres.map(m => m.nom));

const syllabus = {
  'Introduction aux systèmes électroniques': 4,
  'Programmation': 6,
  'Electromagnétisme': 7,
  'Algèbre': 5,
  'Analyse': 5,
  "Architecture des systèmes d'exploitation": 5,
  'Construction Mécanique': 3
};

const insertCM = db.prepare(`
  INSERT INTO cours_cm (id, titre, jActuel, easeFactor, repetitions, matiere_id)
  VALUES (?, ?, 0, 2.5, 0, ?)
`);

db.transaction(() => {
  for (const m of s3Matieres) {
    let target = null;
    for (const [key, val] of Object.entries(syllabus)) {
      if (m.nom.toLowerCase().includes(key.toLowerCase()) || 
         (key === 'Electromagnétisme' && m.nom.toLowerCase().includes('magnétisme')) ||
         (key === "Architecture des systèmes d'exploitation" && m.nom.toLowerCase().includes('exploitation'))) {
        target = val;
        break;
      }
    }
    
    if (target) {
      console.log(`Injecting ${target} CMs for ${m.nom}`);
      // Clear existing first
      db.prepare(`DELETE FROM cours_cm WHERE matiere_id = ?`).run(m.id);
      
      for (let i = 1; i <= target; i++) {
        insertCM.run(crypto.randomUUID(), `CM ${i}`, m.id);
      }
    }
  }
})();

console.log("Done.");
