const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

function generateId() {
  return crypto.randomUUID();
}

function run() {
  const s3 = db.prepare('SELECT id FROM semestres WHERE nom = ?').get('Semestre 3');
  if (!s3) {
    console.error("Erreur : Semestre 3 introuvable !");
    return;
  }
  const semId = s3.id;

  const ueSPI1 = db.prepare('SELECT id FROM ues WHERE nom LIKE ?').get("%Sciences pour l'ingénieur 1%");
  if (!ueSPI1) {
    console.error("Erreur : UE 4 SPI 1 introuvable !");
    return;
  }
  const ueSPI1Id = ueSPI1.id;

  const insertUE = db.prepare('INSERT INTO ues (id, nom, ects, semestre_id) VALUES (?, ?, ?, ?)');
  const insertMat = db.prepare('INSERT INTO matieres (id, nom, coef, ue_id, evaluations) VALUES (?, ?, ?, ?, ?)');

  db.transaction(() => {
    // 1. Ajouter "Introduction aux systèmes électroniques" dans UE SPI 1
    const matIntroE = {
      nom: "Introduction aux systèmes électroniques", coef: 1, evals: [
        {nom:"Écrit 1", type:"AC", coefficient:1},
        {nom:"Écrit 2", type:"AC", coefficient:1},
        {nom:"Examen de TP", type:"AC", coefficient:1}
      ]
    };
    const matIntroEId = generateId();
    const evalsIntroEStr = JSON.stringify(matIntroE.evals.map(e => ({
      nom: e.nom, type: e.type, coefficient: e.coefficient, note: null, statut: 'present'
    })));
    insertMat.run(matIntroEId, matIntroE.nom, matIntroE.coef, ueSPI1Id, evalsIntroEStr);

    // 2. Ajouter UE SPI 2
    const ueSPI2 = {
      nom: "UE 4 - Semestre 3 -Sciences pour l'ingénieur 2 (orientation génie mécanique)",
      ects: 6,
      matieres: [
        { nom: "Mécanique du solide", coef: 1, evals: [
          {nom:"Ecrit", type:"AC", coefficient:3},
          {nom:"Participation TD", type:"SC", coefficient:1}
        ]},
        { nom: "Construction mécanique", coef: 1, evals: [
          {nom:"CC = ET = Epreuve Terminale", type:"AC", coefficient:1},
          {nom:"CC Formatif des TP", type:"SC", coefficient:1}
        ]}
      ]
    };
    const ueSPI2Id = generateId();
    insertUE.run(ueSPI2Id, ueSPI2.nom, ueSPI2.ects, semId);
    
    for (const mat of ueSPI2.matieres) {
      const matId = generateId();
      const evalsStr = JSON.stringify(mat.evals.map(e => ({
        nom: e.nom, type: e.type, coefficient: e.coefficient, note: null, statut: 'present'
      })));
      insertMat.run(matId, mat.nom, mat.coef, ueSPI2Id, evalsStr);
    }

    // 3. Ajouter UE Santé
    const ueSante = {
      nom: "UE 5 - Semestre 3 - Santé",
      ects: 3,
      matieres: [
        { nom: "Signal et technologie en santé (Santé)", coef: 1, evals: [
          {nom:"CC1", type:"SC", coefficient:0.25},
          {nom:"CC2", type:"SC", coefficient:0.25},
          {nom:"CC3", type:"AC", coefficient:0.5}
        ]},
        { nom: "Aspects médicaux-légaux en santé (Santé)", coef: 1, evals: [
          {nom:"CC1", type:"SC", coefficient:0.3},
          {nom:"CC2", type:"AC", coefficient:0.7}
        ]}
      ]
    };
    const ueSanteId = generateId();
    insertUE.run(ueSanteId, ueSante.nom, ueSante.ects, semId);

    for (const mat of ueSante.matieres) {
      const matId = generateId();
      const evalsStr = JSON.stringify(mat.evals.map(e => ({
        nom: e.nom, type: e.type, coefficient: e.coefficient, note: null, statut: 'present'
      })));
      insertMat.run(matId, mat.nom, mat.coef, ueSanteId, evalsStr);
    }
  })();

  console.log("Suite du Semestre 3 injectée avec succès !");
}

run();
