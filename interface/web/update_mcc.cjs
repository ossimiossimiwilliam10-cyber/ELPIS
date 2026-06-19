const fs = require('fs');
const file = 'c:/Users/User/Desktop/ELPIS/espoir_cours.json';
let cours = JSON.parse(fs.readFileSync(file, 'utf8'));

// Dictionnaire des évaluations MCC S3
const mccMap = {
  "Anglais Lansad - Semestre impair": [{ nom: "Évaluation", coefficient: 1, note: null }],
  "Allemand Lansad - Semestre impair": [{ nom: "Évaluation", coefficient: 1, note: null }],
  "Algèbre": [{ nom: "Écrit 1", coefficient: 1, note: null }, { nom: "Écrit 2", coefficient: 1, note: null }],
  "Analyse": [{ nom: "Écrit 1", coefficient: 1, note: null }, { nom: "Écrit 2", coefficient: 1, note: null }],
  "Architecture des systèmes d'exploitation": [
    { nom: "Écrit 1", coefficient: 1, note: null },
    { nom: "Écrit 2", coefficient: 1, note: null },
    { nom: "Examen de TP", coefficient: 1, note: null }
  ],
  "Programmation": [
    { nom: "Écrit 1", coefficient: 1, note: null },
    { nom: "Écrit 2", coefficient: 1, note: null },
    { nom: "Épreuve pratique", coefficient: 0.8, note: null },
    { nom: "QCM + Rapport TP", coefficient: 0.2, note: null }
  ],
  "Électromagnétisme": [{ nom: "Écrit 1", coefficient: 1, note: null }, { nom: "Écrit 2", coefficient: 1, note: null }],
  "Introduction aux systèmes électroniques": [
    { nom: "Écrit 1", coefficient: 1, note: null },
    { nom: "Écrit 2", coefficient: 1, note: null },
    { nom: "Examen de TP", coefficient: 1, note: null }
  ],
  "Mécanique du solide": [
    { nom: "Ecrit", coefficient: 3, note: null },
    { nom: "Participation TD", coefficient: 1, note: null }
  ],
  "Construction mécanique": [
    { nom: "CC = ET", coefficient: 1, note: null },
    { nom: "CC Formatif TP", coefficient: 1, note: null }
  ],
  "Signal et technologie en santé (Santé)": [
    { nom: "CC1", coefficient: 0.25, note: null },
    { nom: "CC2", coefficient: 0.25, note: null },
    { nom: "CC3", coefficient: 0.5, note: null }
  ],
  "Aspects médicaux-légaux en santé (Santé)": [
    { nom: "CC1", coefficient: 0.3, note: null },
    { nom: "CC2", coefficient: 0.7, note: null }
  ]
};

// 1. Ajouter L1 si elle n'existe pas
const hasL1 = cours.licences.some(l => l.nom.includes('Licence 1'));
if (!hasL1) {
  cours.licences.unshift({
    nom: "Licence 1 Sciences pour la Santé",
    semestres: [
      {
        nom: "Semestre 1",
        ues: []
      },
      {
        nom: "Semestre 2",
        ues: []
      }
    ]
  });
}

// 2. Transformer notes en evaluations
cours.licences.forEach(l => {
  l.semestres?.forEach(s => {
    s.ues?.forEach(u => {
      u.matieres?.forEach(m => {
        if (m.notes) delete m.notes; // supprimer l'ancien tableau plat
        
        // Assigner les évaluations depuis la MCC si disponible
        if (mccMap[m.nom]) {
          m.evaluations = JSON.parse(JSON.stringify(mccMap[m.nom])); // clone
        } else {
          // Fallback générique
          m.evaluations = [{ nom: "Note", coefficient: 1, note: null }];
        }
      });
    });
  });
});

fs.writeFileSync(file, JSON.stringify(cours, null, 2));
console.log('Done mapping evaluations.');
