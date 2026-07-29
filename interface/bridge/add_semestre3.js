const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

function generateId() {
  return crypto.randomUUID();
}

function run() {
  const licences = db.prepare('SELECT id, nom FROM licences').all();
  let licenceId;
  
  if (licences.length === 0) {
    licenceId = generateId();
    db.prepare('INSERT INTO licences (id, nom) VALUES (?, ?)').run(licenceId, "Licence 2 SPI");
    console.log("Création de la Licence 2 SPI");
  } else {
    licenceId = licences[0].id;
    console.log("Utilisation de la licence existante:", licences[0].nom);
  }

  const semId = generateId();
  db.prepare('INSERT INTO semestres (id, nom, licence_id) VALUES (?, ?, ?)').run(semId, "Semestre 3", licenceId);

  const ues = [
    {
      nom: "UE 1 - Semestre 3 - Langues",
      ects: 3,
      matieres: [
        { nom: "Allemand Lansad - Semestre impair", coef: 1, evals: [{ nom: "Evaluation", type: "SC", coefficient: 1 }] },
        { nom: "Anglais Lansad - Semestre impair", coef: 1, evals: [{ nom: "Evaluation", type: "SC", coefficient: 1 }] }
      ]
    },
    {
      nom: "UE 2 - Semestre 3 - Mathématiques pour l'ingénieur",
      ects: 6,
      matieres: [
        { nom: "Algèbre", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] },
        { nom: "Analyse", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] }
      ]
    },
    {
      nom: "UE 3 - Semestre 3 - Informatique",
      ects: 6,
      matieres: [
        { nom: "Architecture des systèmes d'exploitation", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1}, {nom:"Examen de TP", type:"AC", coefficient:1} ] },
        { nom: "Programmation", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1}, {nom:"Épreuve pratique", type:"AC", coefficient:0.8}, {nom:"QCM + Rapport de TP", type:"SC", coefficient:0.2} ] }
      ]
    },
    {
      nom: "UE 4 - Semestre 3 - Sciences pour l'ingénieur 1 (orientation génie électrique)",
      ects: 6,
      matieres: [
        { nom: "Électromagnétisme", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] }
      ]
    }
  ];

  const insertUE = db.prepare('INSERT INTO ues (id, nom, ects, semestre_id) VALUES (?, ?, ?, ?)');
  const insertMat = db.prepare('INSERT INTO matieres (id, nom, coef, ue_id, evaluations) VALUES (?, ?, ?, ?, ?)');

  db.transaction(() => {
    for (const ue of ues) {
      const ueId = generateId();
      insertUE.run(ueId, ue.nom, ue.ects, semId);
      
      for (const mat of ue.matieres) {
        const matId = generateId();
        const evalsStr = JSON.stringify(mat.evals.map(e => ({
          nom: e.nom,
          type: e.type,
          coefficient: e.coefficient,
          note: null,
          statut: 'present'
        })));
        insertMat.run(matId, mat.nom, mat.coef, ueId, evalsStr);
      }
    }
  })();

  console.log("Semestre 3 injecté avec succès !");
}

run();
