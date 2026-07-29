const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

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

const findMatiere = (nom) => {
  return matieres.find(m => m.nom.toLowerCase().includes(nom.toLowerCase()) || 
    (nom === "Architecture des systèmes d'exploitation" && m.nom.toLowerCase().includes('exploitation')) ||
    (nom === "Electromagnétisme" && m.nom.toLowerCase().includes('magnétisme')) ||
    (nom === "Construction mécanique" && m.nom.toLowerCase().includes('construction mécanique')) ||
    (nom === "Mécanique du solide" && m.nom.toLowerCase().includes('mécanique du solide'))
  );
};

db.transaction(() => {
  // 1. Create CMs for Mécanique du solide
  const matMeca = findMatiere('Mécanique du solide');
  if (matMeca) {
    const existing = db.prepare(`SELECT count(*) as c FROM cours_cm WHERE matiere_id = ?`).get(matMeca.id).c;
    if (existing === 0) {
      const insertCM = db.prepare(`INSERT INTO cours_cm (id, titre, jActuel, easeFactor, repetitions, matiere_id) VALUES (?, ?, 0, 2.5, 0, ?)`);
      for (let i = 1; i <= 4; i++) {
        insertCM.run(crypto.randomUUID(), `CM ${i}`, matMeca.id);
      }
      console.log('Created 4 CMs for Mécanique du solide');
    }
  }

  // 2. Update dates for CMs
  const datesCM = [
    { nom: 'Introduction aux systèmes électroniques', cm: 'CM 2', date: '2026-09-14' },
    { nom: 'Analyse', cm: 'CM 2', date: '2026-09-16' },
    { nom: 'Algèbre', cm: 'CM 2', date: '2026-09-16' },
    { nom: 'Construction mécanique', cm: 'CM 2', date: '2026-09-18' },
    { nom: 'Mécanique du solide', cm: 'CM 1', date: '2026-09-18' }
  ];

  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 3. Handle TDs
  // First, ensure TDs exist for Programmation and Archi
  const syllabusTD = {
    'Programmation': 5,
    "Architecture des systèmes d'exploitation": 5
  };

  const insertTD = db.prepare(`INSERT INTO exercices (id, type, titre, nombrePratiques, tempsMoyen, difficulte, difficulteInitiale, matiere_id) VALUES (?, 'TD', ?, 0, 0, 'Normale', 'Normale', ?)`);
  for (const [key, val] of Object.entries(syllabusTD)) {
    const mat = findMatiere(key);
    if (mat) {
      const existing = db.prepare(`SELECT count(*) as c FROM exercices WHERE type='TD' AND matiere_id = ?`).get(mat.id).c;
      if (existing === 0) {
        for (let i = 1; i <= val; i++) {
          insertTD.run(crypto.randomUUID(), `TD ${i}`, mat.id);
        }
        console.log(`Created ${val} TDs for ${key}`);
      }
    }
  }

  // 4. Update dates for TDs
  const datesTD = [
    { nom: 'Programmation', td: 'TD 1', date: '2026-09-14' },
    { nom: "Architecture des systèmes d'exploitation", td: 'TD 1', date: '2026-09-16' },
    { nom: 'Programmation', td: 'TD 2', date: '2026-09-16' }
  ];

  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${mat.nom} ${d.td} to ${d.date} - Changes: ${info.changes}`);
    }
  }

})();

console.log('Finished updating week 2 schedule.');
