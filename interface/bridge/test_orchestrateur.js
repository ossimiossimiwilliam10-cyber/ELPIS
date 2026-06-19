// Tests unitaires pour le moteur ELPIS — exécuté avec Node.js directement
// Usage : node interface/bridge/test_orchestrateur.js

const {
  buildExamUrgencyMap,
  getTodayString,
  detectBurnoutRisk,
  buildVelocityMap,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildProjectedScoreMap,
  buildCognitiveLoadMap
} = require('./moteur/intelligence');
const { getPrioScore, getSubjectExamBoost, getDifficultyMultiplier } = require('./moteur/scoring');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

let passed = 0, failed = 0, skipped = 0;
function test(name, fn) {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${name}`); passed++; }
  catch (e) { console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); failed++; }
}
function skip(name, fn) {
  console.log(`  \x1b[33m⚠\x1b[0m ${name} (skipped)`);
  skipped++;
}

console.log('\n=== Tests ELPIS — Moteur ===\n');

// ============================================================
// INTELLIGENCE
// ============================================================

// --- buildExamUrgencyMap ---
test('buildExamUrgencyMap: empty courses → empty map', () => {
  const map = buildExamUrgencyMap({ licences: [] });
  if (Object.keys(map).length !== 0) throw new Error('Expected empty map');
});

test('buildExamUrgencyMap: null courses → {}', () => {
  const map = buildExamUrgencyMap(null);
  if (typeof map !== 'object' || Object.keys(map).length !== 0) throw new Error('Expected {}');
});

// --- detectBurnoutRisk ---
test('detectBurnoutRisk: normal usage → none', () => {
  // Simuler des repos récents (2 repos dans les 7 derniers jours)
  const today = new Date();
  const restDays = [];
  for (let i = 1; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 3);
    restDays.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }
  const cfg = { restDays, bedtime: '23:00' };
  const historique = [
    { timestamp: new Date().toISOString(), dureeMinutes: 60, type: 'CM' }
  ];
  const risk = detectBurnoutRisk(cfg, historique);
  if (risk.riskLevel !== 'none') throw new Error(`Expected none, got ${risk.riskLevel}`);
  if (risk.shouldForceRest) throw new Error('Should not force rest');
});

test('detectBurnoutRisk: 14+ jours sans repos + >6h/jour → high', () => {
  const cfg = { restDays: [], bedtime: '23:00' };
  const historique = [];
  const today = new Date();
  // Simuler 14 jours de sessions longues
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // 7h de travail chaque jour = 420 min/jour pendant 7j → avg ~420min/j
    if (i < 7) {
      historique.push({ timestamp: d.toISOString(), dureeMinutes: 420, type: 'CM' });
    }
  }
  const risk = detectBurnoutRisk(cfg, historique);
  if (risk.riskLevel !== 'high') throw new Error(`Expected high, got ${risk.riskLevel} (${risk.reason})`);
  if (!risk.shouldForceRest) throw new Error('Should force rest: ' + risk.reason);
});

test('detectBurnoutRisk: repos récent → no risk', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
  const cfg = { restDays: [yesterdayStr], bedtime: '23:00' };
  const historique = Array(10).fill({ timestamp: today.toISOString(), dureeMinutes: 500, type: 'CM' });
  const risk = detectBurnoutRisk(cfg, historique);
  // A pris un repos hier → daysWithoutRest <= 1
  if (risk.riskLevel === 'high') throw new Error('Should not be high after recent rest');
});

// --- getTodayString ---
test('getTodayString: format YYYY-MM-DD', () => {
  const today = getTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`Invalid format: ${today}`);
});

test('getTodayString: uses local time with -4h grace period', () => {
  const d = new Date();
  d.setHours(d.getHours() - 4);
  const manual = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const actual = getTodayString();
  if (manual !== actual) throw new Error(`Mismatch: expected ${manual}, got ${actual}`);
});

// --- buildProjectedScoreMap (Axe 11) ---
test('buildProjectedScoreMap: returns empty map for null cours', () => {
  const map = buildProjectedScoreMap(null, {});
  if (typeof map !== 'object' || Object.keys(map).length !== 0) throw new Error('Expected {}');
});

test('buildProjectedScoreMap: base score ~10 for new subject', () => {
  const crs = {
    licences: [{
      nom: 'Test',
      semestres: [{
        ues: [{
          nom: 'UE1',
          matieres: [{
            nom: 'Maths',
            evaluations: [],
            listeCM: [],
            listeTD: [],
            listeTP: [],
            listeAnnales: []
          }]
        }]
      }]
    }]
  };
  const map = buildProjectedScoreMap(crs, {});
  if (typeof map['Maths'] !== 'number') throw new Error('Maths should have a score');
  if (map['Maths'] < 0 || map['Maths'] > 20) throw new Error(`Score out of range: ${map['Maths']}`);
});

test('buildProjectedScoreMap: mastery increases score via velocityMap', () => {
  const crs = {
    licences: [{
      nom: 'Test',
      semestres: [{
        ues: [{
          nom: 'UE1',
          matieres: [{
            nom: 'Physique',
            evaluations: [],
            listeCM: [{ titre: 'CM1' }, { titre: 'CM2' }],
            listeTD: [],
            listeTP: [],
            listeAnnales: []
          }]
        }]
      }]
    }]
  };
  // 100% mastery → masteryMod = (1.0 - 0.5) * 6 = +3
  const velocityMap = { 'Physique': { totalCMs: 2, masteredCMs: 2, totalStudyMinutes: 120 } };
  const map = buildProjectedScoreMap(crs, velocityMap);
  // Base 10 + mastery 3 = ~13
  if (map['Physique'] < 11) throw new Error(`Expected >= 11 with full mastery, got ${map['Physique']}`);
});

test('buildProjectedScoreMap: past grades affect base score', () => {
  const crs = {
    licences: [{
      nom: 'Test',
      semestres: [{
        ues: [{
          nom: 'UE1',
          matieres: [{
            nom: 'Chimie',
            evaluations: [{ note: 16, coefficient: 1 }, { note: 14, coefficient: 1 }],
            listeCM: [],
            listeTD: [],
            listeTP: [],
            listeAnnales: []
          }]
        }]
      }]
    }]
  };
  const map = buildProjectedScoreMap(crs, {});
  // Average of [16, 14] = 15 as base score
  if (map['Chimie'] < 14) throw new Error(`Expected >= 14 with good grades, got ${map['Chimie']}`);
  if (map['Chimie'] > 17) throw new Error(`Expected <= 17, got ${map['Chimie']}`);
});

// ============================================================
// SCORING
// ============================================================

// --- getPrioScore ---
test('getPrioScore: unpracticed exercise → 1.0', () => {
  const ex = { nombrePratiques: 0, difficulte: 'moyen' };
  const score = getPrioScore(ex, null, null);
  if (Math.abs(score - 1.0) > 0.001) throw new Error(`Expected 1.0, got ${score}`);
});

test('getPrioScore: difficile > tres_facile', () => {
  const hard = { nombrePratiques: 0, difficulte: 'difficile' };
  const easy = { nombrePratiques: 0, difficulte: 'tres_facile' };
  if (getPrioScore(hard, null, null) <= getPrioScore(easy, null, null))
    throw new Error('Difficile should have higher priority');
});

test('getPrioScore: exam urgency boost applied', () => {
  const ex = { nombrePratiques: 0, difficulte: 'moyen' };
  const urgencyMap = { 'algèbre': { multiplier: 3.0, daysToExam: 2 } };
  const score = getPrioScore(ex, urgencyMap, 'Algèbre');
  if (Math.abs(score - 3.0) > 0.01) throw new Error(`Expected ~3.0, got ${score}`);
});

test('getPrioScore: Annale veille d\'examen écrase tout (Mission 3)', () => {
  // Simuler une Annale la veille d'un examen : urgence 3.0x + coeff 3 → boost forcé
  const ex = { nombrePratiques: 0, difficulte: 'moyen' };
  const urgencyMap = { 'maths': { multiplier: 3.0, daysToExam: 1 } };
  const matiere = { nom: 'Maths', coefficient: 3, evaluations: [] };

  // Priorité Annale la veille
  const annalePrio = getPrioScore(ex, urgencyMap, matiere, null, null);

  // Priorité d'un CM normal sans urgence (comparaison)
  const cmEx = { nombrePratiques: 0, difficulte: 'moyen' };
  const cmPrio = getPrioScore(cmEx, null, 'Histoire');

  if (annalePrio <= cmPrio) throw new Error(`Annale veille (${annalePrio}) devrait écraser CM normal (${cmPrio})`);
  if (annalePrio < 3.0) throw new Error(`Annale veille devrait avoir prio >= 3.0, got ${annalePrio}`);
});

// --- getSubjectExamBoost ---
test('getSubjectExamBoost: null matiere → boost 1.0', () => {
  const r = getSubjectExamBoost(null, {});
  if (r.boost !== 1.0) throw new Error(`Expected 1.0, got ${r.boost}`);
});

test('getSubjectExamBoost: coeff 3 + exam ≤14j force boost', () => {
  const matiere = { nom: 'Algèbre', coefficient: 3 };
  const urgencyMap = { 'algèbre': { multiplier: 1.5, daysToExam: 10 } };
  const r = getSubjectExamBoost(matiere, urgencyMap);
  if (r.boost <= 1.5) throw new Error(`Expected > 1.5, got ${r.boost}`);
});

test('getSubjectExamBoost: fuzzy name match', () => {
  const matiere = { nom: 'Algèbre Linéaire', coefficient: 1 };
  const urgencyMap = { 'algèbre': { multiplier: 3.0, daysToExam: 2 } };
  const r = getSubjectExamBoost(matiere, urgencyMap);
  if (r.boost <= 1.0) throw new Error(`Expected boost > 1.0, got ${r.boost}`);
});

// --- getDifficultyMultiplier ---
test('getDifficultyMultiplier: mapping correct', () => {
  if (getDifficultyMultiplier('difficile') !== 1.5) throw new Error('difficile should be 1.5');
  if (getDifficultyMultiplier('tres_facile') !== 0.5) throw new Error('tres_facile should be 0.5');
  if (getDifficultyMultiplier('inconnu') !== 1.0) throw new Error('unknown should default to 1.0');
});

// ============================================================
// ORCHESTRATEUR (scheduler)
// ============================================================

const path = require('path');
const cfgPath = path.join(__dirname, '..', '..', 'espoir_config.json');
const crsPath = path.join(__dirname, '..', '..', 'espoir_cours.json');
const fs = require('fs');

const hasData = fs.existsSync(cfgPath) && fs.existsSync(crsPath);

if (!hasData) {
  skip('genererRapportQuotidien: no data files → skipped');
} else {
  test('genererRapportQuotidien: returns valid structure', () => {
    const r = genererRapportQuotidien(cfgPath, crsPath, 0);
    if (!r || typeof r !== 'object') throw new Error('Should return object');
    ['statut', 'tachesDuJour', 'tempsRequisMin', 'tempsDispoMin'].forEach(f => {
      if (!r.hasOwnProperty(f)) throw new Error(`Missing field: ${f}`);
    });
    if (!Array.isArray(r.tachesDuJour)) throw new Error('tachesDuJour should be array');
    if (!['OK', 'SURCHARGE', 'REPOS'].includes(r.statut)) throw new Error(`Invalid statut: ${r.statut}`);
  });

  test('genererRapportQuotidien: extraTime increases dispo', () => {
    const r0 = genererRapportQuotidien(cfgPath, crsPath, 0);
    const r60 = genererRapportQuotidien(cfgPath, crsPath, 60);
    if (r0.statut === 'REPOS') { skip('extraTime test skipped: rest day'); return; }
    if (r60.tempsDispoMin <= r0.tempsDispoMin) throw new Error('Extra time should increase dispo');
  });

  test('genererRapportQuotidien: intelligence field present', () => {
    const r = genererRapportQuotidien(cfgPath, crsPath, 0);
    if (!r.intelligence) throw new Error('Missing intelligence field');
    const keys = ['compensationMap', 'remainingWeightMap', 'velocityMap', 'cognitiveLoadMap', 'burnoutRisk', 'projectedScoreMap'];
    keys.forEach(k => {
      if (!r.intelligence.hasOwnProperty(k)) throw new Error(`Missing intelligence.${k}`);
    });
  });

  test('genererRapportQuotidien: burnoutRisk has required fields', () => {
    const r = genererRapportQuotidien(cfgPath, crsPath, 0);
    const br = r.intelligence.burnoutRisk;
    ['riskLevel', 'shouldForceRest', 'reason', 'daysWithoutRest', 'avgDailyMinutes'].forEach(f => {
      if (!br.hasOwnProperty(f)) throw new Error(`Missing burnoutRisk.${f}`);
    });
  });
}

// ============================================================
// RÉSULTAT
// ============================================================
console.log(`\n\x1b[1m${passed} passed, ${failed} failed, ${skipped} skipped\x1b[0m`);
process.exit(failed > 0 ? 1 : 0);
