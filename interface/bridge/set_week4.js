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
    (nom === "Construction mécanique" && m.nom.toLowerCase().includes('construction mécanique')) ||
    (nom === "Sciences pour la santé" && m.nom.toLowerCase().includes('santé')) ||
    (nom === "Langues" && (m.nom.toLowerCase().includes('anglais') || m.nom.toLowerCase().includes('langue'))) ||
    (nom === "Mécanique du solide" && m.nom.toLowerCase().includes('solide'))
  );
};

db.transaction(() => {
  // 1. Update Exam Date for Archi
  const matArchi = findMatiere("Architecture des systèmes d'exploitation");
  if (matArchi) {
    db.prepare(`UPDATE matieres SET dateExamen = ? WHERE id = ?`).run(JSON.stringify(["2026-10-02"]), matArchi.id);
    console.log("Updated exam date for Archi");
  }

  // 2. Update CM dates
  const datesCM = [
    { nom: 'Electromagnétisme', cm: 'CM 3', date: '2026-10-01' },
    { nom: "Architecture des systèmes d'exploitation", cm: 'CM 5', date: '2026-10-02' }
  ];

  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 3. Handle TDs creation (Analyse: 4, Algèbre: 2, Construction Méc: 2, Méca solide: 6)
  const syllabusTD = {
    'Analyse': 4,
    'Algèbre': 2,
    'Construction mécanique': 2,
    'Mécanique du solide': 6
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

  // 4. Handle TPs creation (Programmation: 3)
  const matProg = findMatiere("Programmation");
  if (matProg) {
    const existingTP = db.prepare(`SELECT count(*) as c FROM exercices WHERE type='TP' AND matiere_id = ?`).get(matProg.id).c;
    if (existingTP === 0) {
      const insertTP = db.prepare(`INSERT INTO exercices (id, type, titre, nombrePratiques, tempsMoyen, difficulte, difficulteInitiale, matiere_id) VALUES (?, 'TP', ?, 0, 0, 'Normale', 'Normale', ?)`);
      for (let i = 1; i <= 3; i++) {
        insertTP.run(crypto.randomUUID(), `TP ${i}`, matProg.id);
      }
      console.log(`Created 3 TPs for Programmation`);
    }
  }

  // 5. Update dates for TDs
  const datesTD = [
    { nom: 'Langues', td: 'TD 2', date: '2026-09-29' },
    { nom: 'Construction mécanique', td: 'TD 1', date: '2026-09-29' },
    { nom: "Architecture des systèmes d'exploitation", td: 'TD 3', date: '2026-09-30' },
    { nom: 'Analyse', td: 'TD 1', date: '2026-09-30' },
    { nom: 'Algèbre', td: 'TD 1', date: '2026-09-30' },
    { nom: 'Analyse', td: 'TD 2', date: '2026-09-30' },
    { nom: 'Sciences pour la santé', td: 'TD 2', date: '2026-09-30' },
    { nom: 'Mécanique du solide', td: 'TD 1', date: '2026-10-01' }
  ];

  const updateTD = db.prepare(`UPDATE exercices SET datePrevue = ? WHERE type = 'TD' AND titre = ? AND matiere_id = ?`);
  for (const d of datesTD) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateTD.run(d.date, d.td, mat.id);
      console.log(`Updated TD ${mat.nom} ${d.td} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 6. Update date for TP
  if (matProg) {
    const info = db.prepare(`UPDATE exercices SET dateTP = ? WHERE type = 'TP' AND titre = ? AND matiere_id = ?`).run('2026-09-28', 'TP 1', matProg.id);
    console.log(`Updated TP Programmation TP 1 to 2026-09-28 - Changes: ${info.changes}`);
  }

})();

console.log('Finished updating week 4 schedule.');
