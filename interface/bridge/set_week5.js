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
    (nom === "STS" && m.nom.toLowerCase().includes('signal et technologie en santé')) ||
    (nom === "AMLS" && m.nom.toLowerCase().includes('aspects médicaux-légaux'))
  );
};

db.transaction(() => {
  // 1. Update Exam Dates for Santé (STS and AMLS)
  const matSTS = findMatiere("STS");
  if (matSTS) {
    db.prepare(`UPDATE matieres SET dateExamen = ? WHERE id = ?`).run(JSON.stringify(["2026-10-05"]), matSTS.id);
    console.log("Updated exam date for STS");
  }
  const matAMLS = findMatiere("AMLS");
  if (matAMLS) {
    db.prepare(`UPDATE matieres SET dateExamen = ? WHERE id = ?`).run(JSON.stringify(["2026-10-05"]), matAMLS.id);
    console.log("Updated exam date for AMLS");
  }

  // 2. CM Archi OS (Add CM 6)
  const matArchi = findMatiere("Architecture des systèmes d'exploitation");
  if (matArchi) {
    const existing = db.prepare(`SELECT count(*) as c FROM cours_cm WHERE matiere_id = ?`).get(matArchi.id).c;
    if (existing === 5) {
      db.prepare(`INSERT INTO cours_cm (id, titre, jActuel, easeFactor, repetitions, matiere_id) VALUES (?, ?, 0, 2.5, 0, ?)`).run(crypto.randomUUID(), `CM 6`, matArchi.id);
      console.log('Created CM 6 for Archi');
    }
  }

  // Update CM dates
  const datesCM = [
    { nom: "Architecture des systèmes d'exploitation", cm: 'CM 6', date: '2026-10-08' },
    { nom: "Mécanique du solide", cm: 'CM 3', date: '2026-10-09' }
  ];
  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 3. TDs Creation
  const syllabusTD = {
    'Electromagnétisme': 7
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

  // Update dates for TDs
  const datesTD = [
    { nom: 'Introduction aux systèmes électroniques', td: 'TD 2', date: '2026-10-05' },
    { nom: 'Electromagnétisme', td: 'TD 1', date: '2026-10-06' },
    { nom: 'Langues', td: 'TD 3', date: '2026-10-06' },
    { nom: "Architecture des systèmes d'exploitation", td: 'TD 4', date: '2026-10-08' }
  ];
  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${mat.nom} ${d.td} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 4. TPs Creation
  const syllabusTP = {
    'Algèbre': 6,
    'Analyse': 6
  };
  const insertTP = db.prepare(`INSERT INTO exercices (id, type, titre, nombrePratiques, tempsMoyen, difficulte, difficulteInitiale, matiere_id) VALUES (?, 'TP', ?, 0, 0, 'Normale', 'Normale', ?)`);
  for (const [key, val] of Object.entries(syllabusTP)) {
    const mat = findMatiere(key);
    if (mat) {
      const existingTP = db.prepare(`SELECT count(*) as c FROM exercices WHERE type='TP' AND matiere_id = ?`).get(mat.id).c;
      if (existingTP === 0) {
        for (let i = 1; i <= val; i++) {
          insertTP.run(crypto.randomUUID(), `TP ${i}`, mat.id);
        }
        console.log(`Created ${val} TPs for ${key}`);
      }
    }
  }

  // Update dates for TPs
  const datesTP = [
    { nom: 'Programmation', tp: 'TP 2', date: '2026-10-06' },
    { nom: 'Algèbre', tp: 'TP 1', date: '2026-10-07' },
    { nom: 'Analyse', tp: 'TP 1', date: '2026-10-07' }
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

console.log('Finished updating week 5 schedule.');
