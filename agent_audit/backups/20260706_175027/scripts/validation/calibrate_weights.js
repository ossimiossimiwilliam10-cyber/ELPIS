const fs = require('fs');
const path = require('path');

// Mocks to avoid full backend loading
const intelligence = require('../../interface/bridge/moteur/intelligence');
const scoring = require('../../interface/bridge/moteur/scoring');

const datasetPath = path.resolve(__dirname, 'dataset.json');

if (!fs.existsSync(datasetPath)) {
  console.error("Dataset introuvable. Exécute d'abord generate_dataset.js");
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

console.log(`[Backtesting] Chargement de ${dataset.length} profils simulés...`);

let totalMSE = 0;
let evaluatedProfiles = 0;

// On va simuler l'analyse pour chaque étudiant
dataset.forEach(student => {
  const { id, profil, historique, crs, cfg } = student;
  
  // Test Axe 10 : Velocity Map
  const velocityMap = intelligence.buildVelocityMap(crs, historique, cfg);
  
  // Test Axe 11b : Projected Score Map
  // Dans l'intelligence v3, buildProjectedScoreMap existe (renvoie number)
  // ou buildProjectedScoreDetailMap (renvoie object) si dispo.
  // Faisons la projection
  const projectedScores = intelligence.buildProjectedScoreMap(crs, velocityMap);
  
  let profileMSE = 0;
  let countMatieres = 0;

  // Calcul d'erreur quadratique
  crs.licences[0].semestres[0].ues[0].matieres.forEach(m => {
    const projected = projectedScores[m.nom];
    const actualBaseGrade = m.evaluations[0].note;
    
    // Si c'est un procrastinateur, sa vraie note devrait chuter à cause du manque de rétention
    let expectedReal = actualBaseGrade;
    if (profil === 'Procrastinateur') expectedReal -= 2;
    if (profil === 'Bosseur') expectedReal += 1; // La rétention booste la performance

    const diff = projected - expectedReal;
    profileMSE += (diff * diff);
    countMatieres++;
  });

  if (countMatieres > 0) {
    profileMSE /= countMatieres;
    totalMSE += profileMSE;
    evaluatedProfiles++;
  }
  
  // Test Axe 12 : Burnout
  const burnoutRisk = intelligence.detectBurnoutRisk(cfg, historique);

  // Assertions qualitatives par profil
  if (profil === 'Procrastinateur' && burnoutRisk.riskLevel === 'none' && historique.length > 50) {
    console.warn(`[!] Le Cramming du procrastinateur (${id}) n'a pas été détecté comme risque de Burnout.`);
  }

  // Optionnel : tester getAdaptiveWeight sur les outcomes
  // Pour le test, on va supposer des notes récentes
  const recentOutcomes = [
    { matiere: 'Maths', prioriteAvant: 2.5, noteObtenue: 15, coefficient: 3 },
    { matiere: 'Info', prioriteAvant: 3.0, noteObtenue: 16, coefficient: 2 }
  ];
  const newWeights = scoring.getAdaptiveWeight({ exploration: 0.15, gradeDeficit: 1.0 }, recentOutcomes);
  // Un bosseur (moyenne > 13) devrait voir l'exploration baisser
  if (profil === 'Bosseur' && newWeights.exploration >= 0.15) {
     console.warn(`[!] L'exploration n'a pas baissé pour le bosseur (${id}).`);
  }

});

const globalMSE = totalMSE / evaluatedProfiles;
console.log(`\n=== Résultats de la Calibration ===`);
console.log(`Profils évalués : ${evaluatedProfiles}`);
console.log(`Erreur Quadratique Moyenne (MSE) de la projection : ${globalMSE.toFixed(3)}`);

if (globalMSE > 5) {
  console.log(`❌ Les poids bayésiens sont trop éloignés de la réalité (MSE trop élevée). Ajustement nécessaire.`);
} else {
  console.log(`✅ Les projections du modèle sont statistiquement valides par rapport au Dataset (MSE < 5).`);
}

// Nettoyage optionnel
// fs.unlinkSync(datasetPath);
