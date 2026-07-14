const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const filePath = path.join(ROOT, 'interface', 'bridge', 'moteur', 'orchestrateur.js');
let content = fs.readFileSync(filePath, 'utf8');

// --- Fix E: Remove dead variable newCMCountPerSemester ---
content = content.replace(
  '      let matiereIndexDansSemestre = 0;\r\n      let newCMCountPerSemester = 0;\r\n      for (const ue of (s.ues || [])) {',
  '      let matiereIndexDansSemestre = 0;\r\n      for (const ue of (s.ues || [])) {'
);

// --- Fix: Add bypassInterleaving to buildTaskPools params ---
content = content.replace(
  '  matieresDejaTravaillees = new Set(), nouvellesMatieres = new Set()\r\n}) {',
  '  matieresDejaTravaillees = new Set(), nouvellesMatieres = new Set(),\r\n  bypassInterleaving = false\r\n}) {'
);

// --- Fix: Add licenceIdx/semestreIdx tracking + _semestreId to pool items ---
// Replace the licence loop to add index tracking
content = content.replace(
  '  for (const l of (crs.licences || [])) {\r\n    if (l.archived) continue;\r\n    for (const s of (l.semestres || [])) {\r\n      if (s.archived) continue;',
  '  let licenceIdx = 0;\r\n  for (const l of (crs.licences || [])) {\r\n    if (l.archived) { licenceIdx++; continue; }\r\n    let semestreIdx = 0;\r\n    for (const s of (l.semestres || [])) {\r\n      if (s.archived) { semestreIdx++; continue; }'
);

// Close the semester loop with increment
content = content.replace(
  '      }\r\n    }\r\n  }\r\n  return { poolCM, poolTD, poolTP, poolAnnales };',
  '      }\r\n      semestreIdx++;\r\n    }\r\n    licenceIdx++;\r\n  }\r\n  return { poolCM, poolTD, poolTP, poolAnnales };'
);

// Add _semestreId to poolCM.push
content = content.replace(
  '              poolCM.push({\r\n                matiere: m.nom,\r\n                type: "CM",',
  '              poolCM.push({\r\n                _semestreId: `L${licenceIdx}-S${semestreIdx}`,\r\n                matiere: m.nom,\r\n                type: "CM",'
);

// Add _semestreId to poolTD.push
content = content.replace(
  '            poolTD.push({\r\n              matiere: m.nom,\r\n              type: "TD",',
  '            poolTD.push({\r\n              _semestreId: `L${licenceIdx}-S${semestreIdx}`,\r\n              matiere: m.nom,\r\n              type: "TD",'
);

// Add _semestreId to poolTP.push
content = content.replace(
  '            poolTP.push({\r\n              matiere: m.nom,\r\n              type: "TP",',
  '            poolTP.push({\r\n              _semestreId: `L${licenceIdx}-S${semestreIdx}`,\r\n              matiere: m.nom,\r\n              type: "TP",'
);

// Add _semestreId to poolAnnales.push
content = content.replace(
  '              poolAnnales.push({\r\n                matiere: m.nom,\r\n                type: "ANNALE",',
  '              poolAnnales.push({\r\n                _semestreId: `L${licenceIdx}-S${semestreIdx}`,\r\n                matiere: m.nom,\r\n                type: "ANNALE",'
);

// --- Fix B: Use bypassInterleaving in activePourExercices ---
content = content.replace(
  '          let activePourExercices = ((matiereIndexDansSemestre % 2) === parityJour);',
  '          let activePourExercices = bypassInterleaving || ((matiereIndexDansSemestre % 2) === parityJour);'
);

// --- Fix A: per-semester new CM tracking in appendFromPool ---
content = content.replace(
  '  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;\r\n  let newCMAdded = 0;\r\n  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {\r\n    for (const item of pool) {\r\n      if (item.isNew && !fillGap && newCMAdded >= maxNewCMPerSemester && item.matiere !== guaranteedSubject) continue;',
  '  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;\r\n  const newCMPerSemestre = {};\r\n  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {\r\n    for (const item of pool) {\r\n      if (item.isNew && !fillGap) {\r\n        const semKey = item._semestreId || \'__global\';\r\n        if ((newCMPerSemestre[semKey] || 0) >= maxNewCMPerSemester && item.matiere !== guaranteedSubject) continue;\r\n      }'
);

// Fix the increment part
content = content.replace(
  '          if (item.isNew) newCMAdded++;',
  '          if (item.isNew) {\r\n            const semKey = item._semestreId || \'__global\';\r\n            newCMPerSemestre[semKey] = (newCMPerSemestre[semKey] || 0) + 1;\r\n          }'
);

// --- Fix B: genererTacheSpecifique ---
// Add bypassInterleaving and compute real parity
content = content.replace(
  '    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday: new Set(), fillGap: false, now, parityJour: 0',
  '    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday: new Set(), fillGap: false, now, parityJour: new Date().getDay() % 2, bypassInterleaving: true'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('orchestrateur.js: all fixes applied successfully');

// Now fix intelligence.js
const intelPath = path.join(ROOT, 'interface', 'bridge', 'moteur', 'intelligence.js');
let intel = fs.readFileSync(intelPath, 'utf8');

// --- Fix D: Bayesian prior precision adaptive ---
intel = intel.replace(
  '          const priorPrecision = 2.5; // Ajusté de 1.0 à 2.5 pour donner plus de poids à l\'historique réel',
  '          const priorPrecision = 1.0 + gradeSeries.length * 0.5; // Adaptatif : plus d\'évaluations = plus de précision'
);

// --- Fix F: First residual in buildWorkloadForecast ---
intel = intel.replace(
  '  const residuals = values.map((v, i) => v - (fitted[i - 1] || v));',
  '  const residuals = values.slice(1).map((v, i) => v - fitted[i]);'
);

fs.writeFileSync(intelPath, intel, 'utf8');
console.log('intelligence.js: all fixes applied successfully');

console.log('\nAll patches applied.');
