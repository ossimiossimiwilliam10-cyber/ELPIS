const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

function generateId() {
  return crypto.randomUUID();
}

function run() {
  const s4 = db.prepare('SELECT id FROM semestres WHERE nom = ?').get('Semestre 4');
  if (!s4) {
    console.error("Erreur : Semestre 4 introuvable !");
    return;
  }
  const semId = s4.id;

  const insertUE = db.prepare('INSERT INTO ues (id, nom, ects, semestre_id) VALUES (?, ?, ?, ?)');
  const insertMat = db.prepare('INSERT INTO matieres (id, nom, coef, ue_id, evaluations) VALUES (?, ?, ?, ?, ?)');

  db.transaction(() => {
    const ueOption = {
      nom: "UE 6 - Semestre 4 - Option (A : Génie électrique)",
      ects: 3,
      matieres: [
        { nom: "A : Génie électrique - Systèmes électroniques", coef: 1, evals: [
          {nom:"Écrit 1", type:"AC", coefficient:1},
          {nom:"Écrit 2", type:"AC", coefficient:1},
          {nom:"Examen de TP", type:"AC", coefficient:1}
        ]},
        { nom: "A : Génie électrique - Micro-électronique", coef: 1, evals: [
          {nom:"Écrit 1", type:"AC", coefficient:1},
          {nom:"Écrit 2", type:"AC", coefficient:1},
          {nom:"Écrit 3", type:"AC", coefficient:1}
        ]}
      ]
    };

    const ueId = generateId();
    insertUE.run(ueId, ueOption.nom, ueOption.ects, semId);
    
    for (const mat of ueOption.matieres) {
      const matId = generateId();
      const evalsStr = JSON.stringify(mat.evals.map(e => ({
        nom: e.nom, type: e.type, coefficient: e.coefficient, note: null, statut: 'present'
      })));
      insertMat.run(matId, mat.nom, mat.coef, ueId, evalsStr);
    }
  })();

  console.log("UE 6 (Option A) injectée avec succès !");
}

run();
