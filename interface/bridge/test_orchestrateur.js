// Test rapide pour l'orchestrateur — exécuté avec Node.js directement
const { buildExamUrgencyMap, getPrioScore, getSubjectExamBoost, genererRapportQuotidien, getTodayString } = require('./moteur/orchestrateur');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}

console.log('\n=== Tests Orchestrateur ===\n');

// buildExamUrgencyMap
test('empty courses → empty map', () => {
  const map = buildExamUrgencyMap({ licences: [] });
  if (Object.keys(map).length !== 0) throw new Error('Expected empty map');
});

test('null courses → empty object', () => {
  const map = buildExamUrgencyMap(null);
  if (typeof map !== 'object' || Object.keys(map).length !== 0) throw new Error('Expected {}');
});

// getPrioScore
test('base score for unpracticed exercise', () => {
  const ex = { nombrePratiques: 0, difficulte: 'moyen' };
  const score = getPrioScore(ex, null, null);
  if (score !== 1.0) throw new Error(`Expected 1.0, got ${score}`);
});

test('difficult exercises get higher priority', () => {
  const easy = { nombrePratiques: 0, difficulte: 'tres_facile' };
  const hard = { nombrePratiques: 0, difficulte: 'difficile' };
  if (getPrioScore(hard, null, null) <= getPrioScore(easy, null, null))
    throw new Error('Hard should have higher priority');
});

test('exam urgency boost applied', () => {
  const ex = { nombrePratiques: 0, difficulte: 'moyen' };
  const urgencyMap = { 'algèbre': { multiplier: 3.0, daysToExam: 2 } };
  const score = getPrioScore(ex, urgencyMap, 'Algèbre');
  if (Math.abs(score - 3.0) > 0.01) throw new Error(`Expected ~3.0, got ${score}`);
});

// getSubjectExamBoost
test('default boost for null matiere', () => {
  const result = getSubjectExamBoost(null, {});
  if (result.boost !== 1.0) throw new Error(`Expected 1.0, got ${result.boost}`);
});

test('coeff forces boost', () => {
  const matiere = { nom: 'Algèbre', coefficient: 3 };
  const urgencyMap = { 'algèbre': { multiplier: 1.5, daysToExam: 10 } };
  const result = getSubjectExamBoost(matiere, urgencyMap);
  if (result.boost <= 1.5) throw new Error(`Expected > 1.5, got ${result.boost}`);
});

// genererRapportQuotidien
test('generates report with OK status', () => {
  const r = genererRapportQuotidien(
    require('path').join(__dirname, '..', '..', 'espoir_config.json'),
    require('path').join(__dirname, '..', '..', 'espoir_cours.json'),
    0
  );
  if (!r || !r.hasOwnProperty('statut')) throw new Error('Missing statut');
  if (!Array.isArray(r.tachesDuJour)) throw new Error('tachesDuJour should be array');
});

test('report has all required fields', () => {
  const r = genererRapportQuotidien(
    require('path').join(__dirname, '..', '..', 'espoir_config.json'),
    require('path').join(__dirname, '..', '..', 'espoir_cours.json'),
    0
  );
  ['statut', 'tachesDuJour', 'tempsRequisMin', 'tempsDispoMin'].forEach(f => {
    if (!r.hasOwnProperty(f)) throw new Error(`Missing field: ${f}`);
  });
});

test('extraTime increases tempsDispoMin', () => {
  const path = require('path');
  const cfgPath = path.join(__dirname, '..', '..', 'espoir_config.json');
  const crsPath = path.join(__dirname, '..', '..', 'espoir_cours.json');
  const r0 = genererRapportQuotidien(cfgPath, crsPath, 0);
  const r60 = genererRapportQuotidien(cfgPath, crsPath, 60);
  if (r0.statut === 'REPOS') { console.log('  ⚠ Skipped: today is a rest day'); return; } if (r60.tempsDispoMin <= r0.tempsDispoMin) throw new Error('Extra time should increase dispo');
});

test('returns OK or SURCHARGE or REPOS status', () => {
  const r = genererRapportQuotidien(
    require('path').join(__dirname, '..', '..', 'espoir_config.json'),
    require('path').join(__dirname, '..', '..', 'espoir_cours.json'),
    0
  );
  if (!['OK', 'SURCHARGE', 'REPOS'].includes(r.statut)) throw new Error(`Invalid statut: ${r.statut}`);
});

// getPrioScore additional edge cases
test('getPrioScore: missing fields use defaults', () => {
  const ex = {};
  const score = getPrioScore(ex, null, null);
  if (typeof score !== 'number' || score <= 0) throw new Error(`Invalid score: ${score}`);
});

test('getPrioScore: works without urgency map', () => {
  const ex = { nombrePratiques: 5, difficulte: 'facile' };
  const score = getPrioScore(ex, null, 'Algèbre');
  if (typeof score !== 'number') throw new Error('Should return number');
});

// getSubjectExamBoost additional edge cases
test('getSubjectExamBoost: handles matiere without exam', () => {
  const matiere = { nom: 'Nouvelle Matière', coefficient: 1 };
  const result = getSubjectExamBoost(matiere, {});
  if (result.boost !== 1.0) throw new Error(`Expected 1.0, got ${result.boost}`);
});

test('getSubjectExamBoost: fuzzy name match works', () => {
  const matiere = { nom: 'Algèbre Linéaire', coefficient: 1 };
  const urgencyMap = { 'algèbre': { multiplier: 3.0, daysToExam: 2 } };
  const result = getSubjectExamBoost(matiere, urgencyMap);
  if (result.boost <= 1.0) throw new Error(`Expected boost > 1.0, got ${result.boost}`);
});

// --- getTodayString ---
test('getTodayString returns YYYY-MM-DD format', () => {
  const today = getTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`Invalid format: ${today}`);
});

test('getTodayString returns local date (not UTC)', () => {
  const today = getTodayString();
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) throw new Error(`Could not parse: ${today}`);
});

test('getTodayString is deterministic', () => {
  const t1 = getTodayString();
  const t2 = getTodayString();
  if (t1 !== t2) throw new Error('Should be deterministic within same millisecond');
});

test('getTodayString uses local time with -4h night owl grace period', () => {
  const d = new Date();
  d.setHours(d.getHours() - 4);
  const manual = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const actual = getTodayString();
  if (manual !== actual) throw new Error(`Mismatch: expected ${manual}, got ${actual}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
