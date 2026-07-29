const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// Get matieres
let matieres = db.prepare(`
  SELECT m.id, m.nom, u.id as ue_id
  FROM matieres m 
  JOIN ues u ON m.ue_id = u.id 
  JOIN semestres s ON u.semestre_id = s.id 
  JOIN licences l ON s.licence_id = l.id 
  WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
`).all();

// Find an UE id to attach new matieres
const ueTransversaleId = matieres[0]?.ue_id;

const findMatiere = (nom) => {
  return matieres.find(m => m.nom.toLowerCase().includes(nom.toLowerCase()) || 
    (nom === "Architecture des systèmes d'exploitation" && m.nom.toLowerCase().includes('exploitation')) ||
    (nom === "Electromagnétisme" && m.nom.toLowerCase().includes('magnétisme')) ||
    (nom === "Construction mécanique" && m.nom.toLowerCase().includes('construction mécanique')) ||
    (nom === "Sciences pour la santé" && m.nom.toLowerCase().includes('santé')) ||
    (nom === "Langues" && (m.nom.toLowerCase().includes('anglais') || m.nom.toLowerCase().includes('langue')))
  );
};

db.transaction(() => {
  // 1. Add new subjects if not exist
  const insertMatiere = db.prepare(`INSERT INTO matieres (id, nom, ue_id) VALUES (?, ?, ?)`);
  
  if (!findMatiere("Sciences pour la santé")) {
    insertMatiere.run(crypto.randomUUID(), "Sciences pour la Santé", ueTransversaleId);
    console.log("Added subject Sciences pour la Santé");
  }
  
  if (!findMatiere("Langues")) {
    insertMatiere.run(crypto.randomUUID(), "Anglais / Allemand", ueTransversaleId);
    console.log("Added subject Anglais / Allemand");
  }

  // Refresh matieres list
  matieres = db.prepare(`
    SELECT m.id, m.nom, u.id as ue_id
    FROM matieres m 
    JOIN ues u ON m.ue_id = u.id 
    JOIN semestres s ON u.semestre_id = s.id 
    JOIN licences l ON s.licence_id = l.id 
    WHERE s.nom LIKE '%Semestre 3%' AND l.nom LIKE '%Licence 2%'
  `).all();

  // 2. Construction Mécanique additional CMs (4 and 5)
  const matCMec = findMatiere('Construction mécanique');
  if (matCMec) {
    const existing = db.prepare(`SELECT count(*) as c FROM cours_cm WHERE matiere_id = ?`).get(matCMec.id).c;
    if (existing === 3) {
      const insertCM = db.prepare(`INSERT INTO cours_cm (id, titre, jActuel, easeFactor, repetitions, matiere_id) VALUES (?, ?, 0, 2.5, 0, ?)`);
      insertCM.run(crypto.randomUUID(), `CM 4`, matCMec.id);
      insertCM.run(crypto.randomUUID(), `CM 5`, matCMec.id);
      console.log('Created CM 4 and 5 for Construction Mécanique');
    }
  }

  // 3. Update dates for CMs
  const datesCM = [
    { nom: 'Electromagnétisme', cm: 'CM 2', date: '2026-09-22' },
    { nom: 'Analyse', cm: 'CM 3', date: '2026-09-23' },
    { nom: 'Algèbre', cm: 'CM 3', date: '2026-09-23' },
    { nom: 'Construction mécanique', cm: 'CM 3', date: '2026-09-23' },
    { nom: 'Construction mécanique', cm: 'CM 4', date: '2026-09-25' },
    { nom: 'Construction mécanique', cm: 'CM 5', date: '2026-09-25' },
    { nom: 'Mécanique du solide', cm: 'CM 2', date: '2026-09-25' }
  ];

  const updateCM = db.prepare(`UPDATE cours_cm SET dateCM = ? WHERE titre = ? AND matiere_id = ?`);
  for (const d of datesCM) {
    const mat = findMatiere(d.nom);
    if(mat) {
      const info = updateCM.run(d.date, d.cm, mat.id);
      console.log(`Updated ${mat.nom} ${d.cm} to ${d.date} - Changes: ${info.changes}`);
    }
  }

  // 4. Handle TDs creation (Intro Sys Elec, Sciences pour la Santé, Langues)
  const syllabusTD = {
    'Introduction aux systèmes électroniques': 5,
    "Sciences pour la santé": 5, // Estimated
    "Langues": 10
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

  // 5. Update dates for TDs
  const datesTD = [
    { nom: 'Introduction aux systèmes électroniques', td: 'TD 1', date: '2026-09-21' },
    { nom: "Langues", td: 'TD 1', date: '2026-09-22' },
    { nom: "Architecture des systèmes d'exploitation", td: 'TD 2', date: '2026-09-23' },
    { nom: "Sciences pour la santé", td: 'TD 1', date: '2026-09-23' }
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

console.log('Finished updating week 3 schedule.');
