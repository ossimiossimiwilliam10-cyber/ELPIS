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
    const ue7 = {
      nom: "UE 7 - Préparation à l'admission en santé",
      ects: 6,
      matieres: [
        { nom: "Traitements en santé (Santé)", coef: 1, evals: [
          {nom:"CC1", type:"SC", coefficient:0.3},
          {nom:"CC2", type:"AC", coefficient:0.7}
        ]},
        { nom: "Sciences humaines et sociales (SHS)", coef: 1, evals: [
          {nom:"CC1", type:"AC", coefficient:0.3},
          {nom:"CC2 (Synthèse)", type:"SC", coefficient:0.4},
          {nom:"CC3 (Exposé oral)", type:"SC", coefficient:0.3}
        ]},
        { nom: "Projet professionnel personnalisé (PPP)", coef: 1, evals: [
          {nom:"Portfolio", type:"SC", coefficient:0.7},
          {nom:"Présentation Projet", type:"SC", coefficient:0.3}
        ]}
      ]
    };

    const ueId = generateId();
    insertUE.run(ueId, ue7.nom, ue7.ects, semId);
    
    for (const mat of ue7.matieres) {
      const matId = generateId();
      const evalsStr = JSON.stringify(mat.evals.map(e => ({
        nom: e.nom, type: e.type, coefficient: e.coefficient, note: null, statut: 'present'
      })));
      insertMat.run(matId, mat.nom, mat.coef, ueId, evalsStr);
    }
  })();

  console.log("UE 7 injectée avec succès ! (30 ECTS atteints)");
}

run();
