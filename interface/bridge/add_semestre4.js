const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

function generateId() {
  return crypto.randomUUID();
}

function run() {
  const licence = db.prepare('SELECT id FROM licences WHERE nom = ?').get('Licence 2 SPI');
  if (!licence) {
    console.error("Erreur : Licence 2 SPI introuvable !");
    return;
  }
  const licenceId = licence.id;

  const semId = generateId();
  db.prepare('INSERT INTO semestres (id, nom, licence_id) VALUES (?, ?, ?)').run(semId, "Semestre 4", licenceId);

  const ues = [
    {
      nom: "UE 1 - Semestre 4 - Langues",
      ects: 3,
      matieres: [
        { nom: "Anglais Lansad - Semestre pair", coef: 1, evals: [{ nom: "Evaluation", type: "SC", coefficient: 1 }] }
      ]
    },
    {
      nom: "UE 2 - Semestre 4 - Mathématiques pour l'ingénieur 2",
      ects: 3,
      matieres: [
        { nom: "Fonctions à plusieurs variables réelles", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] }
      ]
    },
    {
      nom: "UE 3 - Semestre 4 - Thermodynamique",
      ects: 3,
      matieres: [
        { nom: "Thermodynamique et thermique", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] }
      ]
    },
    {
      nom: "UE 4 - Semestre 4 - Génie électrique",
      ects: 6,
      matieres: [
        { nom: "Série et transformée de Fourier", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] },
        { nom: "Électrotechnique", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] }
      ]
    },
    {
      nom: "UE 5 - Semestre 4 - Matériaux et procédés",
      ects: 6,
      matieres: [
        { nom: "Matériaux", coef: 1, evals: [ {nom:"Écrit 1", type:"AC", coefficient:1}, {nom:"Écrit 2", type:"AC", coefficient:1} ] },
        { nom: "Procédés de fabrication, technologies d'assemblage et métrologie", coef: 1, evals: [ {nom:"Écrit", type:"AC", coefficient:1}, {nom:"Rapports de TP", type:"SC", coefficient:1} ] }
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

  console.log("Semestre 4 (21 ECTS) injecté avec succès !");
}

run();
