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

const ensureExercices = (matName, type, count) => {
  const mat = findMatiere(matName);
  if (!mat) return;
  const existing = db.prepare(`SELECT count(*) as c FROM exercices WHERE type=? AND matiere_id = ?`).get(type, mat.id).c;
  if (existing < count) {
    const insert = db.prepare(`INSERT INTO exercices (id, type, titre, nombrePratiques, tempsMoyen, difficulte, difficulteInitiale, matiere_id) VALUES (?, ?, ?, 0, 0, 'Normale', 'Normale', ?)`);
    for (let i = existing + 1; i <= count; i++) {
      insert.run(crypto.randomUUID(), type, `${type} ${i}`, mat.id);
    }
    console.log(`Created ${count - existing} ${type}s for ${matName}`);
  }
};

db.transaction(() => {
  // 1. Update Exam Dates
  updateExamDate("Architecture des systèmes d'exploitation", "2026-12-03");

  // 2. Ensure structures exist
  ensureExercices("Algèbre", "TP", 6);
  ensureExercices("Analyse", "TP", 6);

  // 3. Update Dates for CMs
  const datesCM = [
    { nom: "Electromagnétisme", cm: 'CM 6', date: '2026-11-30' },
    { nom: "Mécanique du solide", cm: 'CM 6', date: '2026-12-03' }
  ];
  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${d.nom} ${d.cm} to ${d.date}`);
    }
  }

  // 4. Update Dates for TDs
  const datesTD = [
    { nom: 'Introduction aux Systèmes Electroniques', td: 'TD 5', date: '2026-11-30' },
    { nom: 'Langues', td: 'TD 10', date: '2026-12-01' },
    { nom: 'Electromagnétisme', td: 'TD 5', date: '2026-12-03' }
  ];
  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${d.nom} ${d.td} to ${d.date}`);
    }
  }

  // 5. Update Dates for TPs
  const datesTP = [
    { nom: 'Construction Mécanique', tp: 'TP 3', date: '2026-12-01' },
    { nom: 'Algèbre', tp: 'TP 4', date: '2026-12-02' },
    { nom: 'Analyse', tp: 'TP 4', date: '2026-12-02' }
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

console.log('Finished updating week 13 schedule.');
