const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

const matieres = db.prepare(`
  SELECT m.id, m.nom, u.id as ue_id
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
    (nom === "Langues" && (m.nom.toLowerCase().includes('anglais') || m.nom.toLowerCase().includes('langue'))) ||
    (nom === "Introduction aux Systèmes Electroniques" && m.nom.toLowerCase().includes('introduction aux systèmes électroniques'))
  );
};

db.transaction(() => {
  // 1. CM Archi OS (Add CM 7)
  const matArchi = findMatiere("Architecture des systèmes d'exploitation");
  if (matArchi) {
    const existing = db.prepare(`SELECT count(*) as c FROM cours_cm WHERE matiere_id = ?`).get(matArchi.id).c;
    if (existing === 6) {
      db.prepare(`INSERT INTO cours_cm (id, titre, jActuel, easeFactor, repetitions, matiere_id) VALUES (?, ?, 0, 2.5, 0, ?)`).run(crypto.randomUUID(), `CM 7`, matArchi.id);
      console.log('Created CM 7 for Archi');
    }
  }

  // Update CM dates
  const datesCM = [
    { nom: "Programmation", cm: 'CM 4', date: '2026-10-13' },
    { nom: "Architecture des systèmes d'exploitation", cm: 'CM 7', date: '2026-10-15' }
  ];
  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 2. TDs dates
  const datesTD = [
    { nom: "Architecture des systèmes d'exploitation", td: 'TD 5', date: '2026-10-12' },
    { nom: 'Electromagnétisme', td: 'TD 2', date: '2026-10-13' },
    { nom: 'Langues', td: 'TD 4', date: '2026-10-13' }
  ];
  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${mat.nom} ${d.td} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 3. TPs Creation for Intro Sys Elec
  const matIntroSysElec = findMatiere("Introduction aux Systèmes Electroniques");
  if (matIntroSysElec) {
    const existingTP = db.prepare(`SELECT count(*) as c FROM exercices WHERE type='TP' AND matiere_id = ?`).get(matIntroSysElec.id).c;
    if (existingTP === 0) {
      const insertTP = db.prepare(`INSERT INTO exercices (id, type, titre, nombrePratiques, tempsMoyen, difficulte, difficulteInitiale, matiere_id) VALUES (?, 'TP', ?, 0, 0, 'Normale', 'Normale', ?)`);
      for (let i = 1; i <= 3; i++) {
        insertTP.run(crypto.randomUUID(), `TP ${i}`, matIntroSysElec.id);
      }
      console.log(`Created 3 TPs for Introduction aux Systèmes Electroniques`);
    }
  }

  // Update dates for TPs
  const datesTP = [
    { nom: 'Introduction aux Systèmes Electroniques', tp: 'TP 1', date: '2026-10-14' },
    { nom: 'Analyse', tp: 'TP 2', date: '2026-10-15' },
    { nom: 'Algèbre', tp: 'TP 2', date: '2026-10-16' }
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

console.log('Finished updating week 6 schedule.');
