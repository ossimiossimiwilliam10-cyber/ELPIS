// Smoke test for intelligence v3
const {
  buildProjectedScoreDetailMap, buildVelocityMap, buildTimeOptimizationMap,
  buildSynergyMap, buildWorkloadForecast, buildExamUrgencyMap, buildCognitiveLoadMap,
  buildCompensationMap, buildRemainingWeightMap, getMatiereAverage, detectBurnoutRisk,
  detectAnomalyZScore, linearRegression, recencyWeightedMean, sampleStdDev
} = require('../interface/bridge/moteur/intelligence');

const { getPrioScore, getSubjectExamBoost, getAdaptiveWeight } = require('../interface/bridge/moteur/scoring');

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? '✓' : '✗', label, '→', JSON.stringify(actual));
  if (!ok) { console.log('  expected:', JSON.stringify(expected)); failures++; }
}

// 1. linearRegression
const reg = linearRegression([0,1,2,3,4], [10,11,12,13,14]);
check('linearRegression slope', reg.slope, 1);
check('linearRegression intercept', reg.intercept, 10);

// 2. recencyWeightedMean
const now = Date.now();
const rwm = recencyWeightedMean([10,12,15], [now, now-86400000, now-86400000*30], 60);
check('recencyWeightedMean has mean', rwm.mean !== null, true);

// 3. sampleStdDev
const std = sampleStdDev([10,12,14,16,18]);
check('sampleStdDev > 0', std > 0, true);

// 4. detectAnomalyZScore
const anomaly = detectAnomalyZScore([10,11,12,11,10], 20);
check('detectAnomalyZScore true on outlier', anomaly, true);

// 5. buildTimeOptimizationMap
const fakeHist = [
  { timestamp: '2026-07-01T08:00:00', dureeMinutes: 60 },
  { timestamp: '2026-07-02T08:30:00', dureeMinutes: 45 },
  { timestamp: '2026-07-03T09:00:00', dureeMinutes: 90 },
  { timestamp: '2026-07-04T08:00:00', dureeMinutes: 30 },
  { timestamp: '2026-07-05T07:30:00', dureeMinutes: 60 }
];
const chrono = buildTimeOptimizationMap(fakeHist);
check('chronotype detected', chrono.chronotype, 'morning_lark');

// 6. buildSynergyMap
const fakeCrs = {
  licences: [{ semestres: [{ ues: [{ matieres: [
    { nom: 'Physique', listeCM: [{ titre: 'Mécanique Newtonienne' }, { titre: 'Ondes et Vibrations' }] },
    { nom: 'Maths', listeCM: [{ titre: 'Mécanique Analytique' }, { titre: 'Équations Différentielles' }] },
    { nom: 'Anglais', listeCM: [{ titre: 'Business English' }, { titre: 'TOEIC Preparation' }] }
  ]}]}]}]
};
const syn = buildSynergyMap(fakeCrs);
check('synergy Physique->Maths exists', syn['Physique'] && syn['Physique'].length > 0, true);

// 7. buildWorkloadForecast
const fakeHist2 = [
  { timestamp: '2026-06-25T10:00:00', dureeMinutes: 180 },
  { timestamp: '2026-06-26T10:00:00', dureeMinutes: 210 },
  { timestamp: '2026-06-27T10:00:00', dureeMinutes: 160 },
  { timestamp: '2026-06-28T10:00:00', dureeMinutes: 190 },
  { timestamp: '2026-06-29T10:00:00', dureeMinutes: 200 }
];
const fc = buildWorkloadForecast(fakeHist2);
check('workloadForecast has 7 entries', fc.length, 7);
check('workloadForecast has ci_lower', fc[0].ci_lower !== undefined, true);

// 8. getAdaptiveWeight
const weights = getAdaptiveWeight({}, [
  { matiere: 'Maths', noteObtenue: 15, coefficient: 3 },
  { matiere: 'Physique', noteObtenue: 14, coefficient: 2 },
  { matiere: 'Maths', noteObtenue: 16, coefficient: 3 }
]);
check('adaptiveWeights exploration reduced', weights.exploration < 0.15, true);

// 9. buildProjectedScoreDetailMap
const fakeCrs2 = {
  licences: [{ semestres: [{ ues: [{ matieres: [
    { nom: 'Maths', coefficient: 3, evaluations: [
      { note: 12, coefficient: 1, date: '2026-06-01' },
      { note: 14, coefficient: 1, date: '2026-06-15' },
      { note: 15, coefficient: 2, date: '2026-07-01' }
    ], listeCM: [{ easeFactor: 2.8, repetitions: 5 }], listeAnnales: [], listeTD: [] }
  ]}]}]}]
};
const psd = buildProjectedScoreDetailMap(fakeCrs2, {});
check('projectedScore has projected', psd['Maths'].projected !== undefined, true);
check('projectedScore has ci_lower', psd['Maths'].ci_lower !== undefined, true);
check('projectedScore has ci_upper', psd['Maths'].ci_upper !== undefined, true);
check('projectedScore has trend', psd['Maths'].trend !== undefined, true);
check('projectedScore has sampleSize', psd['Maths'].sampleSize, 3);

console.log('\n' + (failures === 0 ? '✅ All smoke tests passed' : `❌ ${failures} test(s) failed`));
process.exit(failures > 0 ? 1 : 0);
