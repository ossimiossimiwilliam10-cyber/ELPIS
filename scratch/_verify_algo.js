const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BRIDGE = path.join(ROOT, 'interface', 'bridge', 'moteur');

const { genererRapportQuotidien, genererTacheSpecifique } = require(path.join(BRIDGE, 'orchestrateur'));
const { getPrioScore, getDifficultyMultiplier, getSubjectExamBoost } = require(path.join(BRIDGE, 'scoring'));
const { loadCours } = require(path.join(BRIDGE, 'cours'));
const { loadConfig } = require(path.join(BRIDGE, 'config'));
const {
  buildExamUrgencyMap, buildRemainingWeightMap, buildCompensationMap,
  buildVelocityMap, buildCognitiveLoadMap, buildProjectedScoreMap,
  buildProjectedScoreDetailMap, buildTimeOptimizationMap,
  buildSynergyMap, buildWorkloadForecast, detectBurnoutRisk,
  getMatiereAverage
} = require(path.join(BRIDGE, 'intelligence'));

console.log('=== VERIFICATION ALGORITHMIQUE ELPIS ===\n');

// 1. Generate daily report
console.log('--- 1. Rapport quotidien ---');
try {
  const r = genererRapportQuotidien(
    path.join(ROOT, 'data', 'espoir_config.json'),
    path.join(ROOT, 'data', 'espoir_cours.json'),
    0, false
  );
  console.log('Statut:', r.statut);
  console.log('Tâches générées:', r.tachesDuJour ? r.tachesDuJour.length : 0);
  console.log('Temps requis:', r.tempsRequisMin, 'min / Dispo:', r.tempsDispoMin, 'min');
  console.log('Temps déjà travaillé:', r.tempsDejaTravailleMin || 0, 'min');
  console.log('Fixed commitments:', r.fixedCommitmentsMin || 0, 'min');
  
  if (r.tachesDuJour && r.tachesDuJour.length > 0) {
    console.log('\nPremières tâches:');
    r.tachesDuJour.slice(0, 8).forEach(t => {
      console.log(`  [${t.type}] ${t.matiere} - ${t.titre} (${t.dureeMinutes}min, prio=${typeof t.prio === 'number' ? t.prio.toFixed(3) : t.prio}, moment=${t.moment})`);
    });
  }
  
  // Check intelligence maps
  if (r.intelligence) {
    console.log('\nCartes d\'intelligence:');
    for (const [key, val] of Object.entries(r.intelligence)) {
      const count = val && typeof val === 'object' ? Object.keys(val).length : 'N/A';
      console.log(`  ${key}: ${count} entrées`);
    }
  }
} catch(e) {
  console.error('ERREUR:', e.message);
  console.error(e.stack);
}

// 2. Check specific task generation
console.log('\n--- 2. Tâche spécifique ---');
try {
  const task = genererTacheSpecifique(
    path.join(ROOT, 'data', 'espoir_config.json'),
    path.join(ROOT, 'data', 'espoir_cours.json'),
    { matiere: 'all', type: 'all', dureeMin: 30 }
  );
  if (task) {
    const prioStr = typeof task.prio === 'number' ? task.prio.toFixed(3) : task.prio;
    console.log(`Généré: [${task.type}] ${task.matiere} - ${task.titre} (${task.dureeMinutes}min, prio=${prioStr})`);
  } else {
    console.log('Aucune tâche générée');
  }
} catch(e) {
  console.error('ERREUR:', e.message);
}

// 3. Test edge cases with the scoring module
console.log('\n--- 3. Scoring edge cases ---');

console.log('Difficulty multipliers:');
['difficile','assez_difficile','moyen','facile','tres_facile',undefined].forEach(d => {
  console.log(`  ${d || 'default'}: ${getDifficultyMultiplier(d)}`);
});

console.log('\ngetPrioScore edge cases:');
const baseEx = { nombrePratiques: 0, difficulte: 'moyen' };
console.log('  New exercise (0 practices, medium):', getPrioScore(baseEx, {}, 'Test', {}, {}).toFixed(3));

const practicedEx = { nombrePratiques: 10, difficulte: 'moyen' };
console.log('  Well-practiced (10 practices, medium):', getPrioScore(practicedEx, {}, 'Test', {}, {}).toFixed(3));

const hardEx = { nombrePratiques: 0, difficulte: 'difficile' };
console.log('  New hard exercise:', getPrioScore(hardEx, {}, 'Test', {}, {}).toFixed(3));

// 4. Test intelligence module
console.log('\n--- 4. Intelligence maps ---');

const crs = loadCours(path.join(ROOT, 'data', 'espoir_cours.json'));
const cfg = loadConfig(path.join(ROOT, 'data', 'espoir_config.json'));
const historique = [];
try {
  const histPath = path.join(ROOT, 'data', 'espoir_historique.json');
  if (fs.existsSync(histPath)) {
    historique.push(...JSON.parse(fs.readFileSync(histPath, 'utf8')));
  }
} catch(e) {}

const examUrgency = buildExamUrgencyMap(crs);
console.log('Exam urgency map:', Object.keys(examUrgency).length, 'subjects');
for (const [k, v] of Object.entries(examUrgency).slice(0, 5)) {
  console.log(`  ${k}: multiplier=${v.multiplier}, days=${v.daysToExam}`);
}

const remainingWeight = buildRemainingWeightMap(crs);
console.log('Remaining weight map:', Object.keys(remainingWeight).length, 'subjects');

const compensation = buildCompensationMap(crs);
console.log('Compensation map:', Object.keys(compensation).length, 'subjects');
const compensables = Object.values(compensation).filter(c => c.compensable);
console.log('  Compensable subjects:', compensables.length);

const velocity = buildVelocityMap(crs, historique, cfg);
console.log('Velocity map:', Object.keys(velocity).length, 'subjects');
for (const [k, v] of Object.entries(velocity).slice(0, 3)) {
  console.log(`  ${k}: mastered=${v.masteredCMs}/${v.totalCMs}, stability=${v.stabilityDays}d, retention=${v.estimatedRetention}, trend=${v.velocityTrend}`);
}

const cognitiveLoad = buildCognitiveLoadMap(crs);
console.log('Cognitive load map:', Object.keys(cognitiveLoad).length, 'subjects');
const loads = {};
for (const v of Object.values(cognitiveLoad)) {
  loads[v.cognitiveLoad] = (loads[v.cognitiveLoad] || 0) + 1;
}
console.log('  Distribution:', loads);

const projectedDetail = buildProjectedScoreDetailMap(crs, velocity);
console.log('Projected score detail:', Object.keys(projectedDetail).length, 'subjects');
for (const [k, v] of Object.entries(projectedDetail).slice(0, 3)) {
  console.log(`  ${k}: projected=${v.projected}, CI=[${v.ci_lower}-${v.ci_upper}], trend=${v.trend}, anomalies=${v.anomalyFlags?.length || 0}`);
}

const timeOpt = buildTimeOptimizationMap(historique, cfg);
console.log('Time optimization:', timeOpt.chronotype, 'peak:', timeOpt.peakStart + 'h-' + timeOpt.peakEnd + 'h');

const synergy = buildSynergyMap(crs);
console.log('Synergy map:', Object.keys(synergy).length, 'subjects with synergies');
for (const [k, v] of Object.entries(synergy).slice(0, 3)) {
  console.log(`  ${k}: ${v.length} synergies (top: ${v[0]?.matiere} score=${v[0]?.score})`);
}

const workload = buildWorkloadForecast(historique, cfg);
console.log('Workload forecast:', workload.length, 'days');
workload.slice(0, 3).forEach(w => {
  console.log(`  ${w.date}: ${w.forecastMinutes}min [${w.ci_lower}-${w.ci_upper}]`);
});

const burnout = detectBurnoutRisk(cfg, historique);
console.log('Burnout risk:', burnout.riskLevel, burnout.shouldForceRest ? '(FORCE REST)' : '');
console.log('  Days without rest:', burnout.daysWithoutRest);
console.log('  Avg daily (7d):', Math.round(burnout.avgDailyMinutes), 'min');
console.log('  Late sessions:', burnout.lateSessionCount);

console.log('\n=== VÉRIFICATION TERMINÉE ===');
