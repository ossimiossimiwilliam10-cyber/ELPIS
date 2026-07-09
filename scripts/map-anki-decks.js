/**
 * ELPIS — map-anki-decks.js
 * ==========================
 * Utilitaire de mapping matières ELPIS ↔ decks Anki.
 *
 * Usage:
 *   node scripts/map-anki-decks.js              # Affiche le mapping (read-only)
 *   node scripts/map-anki-decks.js --interactif # Mode interactif : l'utilisateur choisit
 *   node scripts/map-anki-decks.js --save       # Sauvegarde auto (matchs exacts/longest)
 *   node scripts/map-anki-decks.js --json       # Sortie JSON pour intégration
 *   node scripts/map-anki-decks.js --help       # Aide
 *
 * Mode interactif (--interactif ou -i) :
 *   Pour chaque matière, l'utilisateur voit :
 *     - Le nom de la matière
 *     - Le deck auto-détecté (s'il existe)
 *     - La liste numérotée des decks Anki disponibles
 *   Actions possibles :
 *     [Entrée] = accepter la suggestion
 *     [numéro] = choisir un autre deck dans la liste
 *     [s]      = passer (pas de deck pour cette matière)
 *     [nom]    = taper le nom exact d'un deck
 *
 * Prérequis : Anki doit être lancé avec AnkiConnect installé.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

// ---------------------------------------------------------------------------
// Mini AnkiConnect client
// ---------------------------------------------------------------------------

function ankiRequest(action, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, version: 6, params });
    const req = http.request({
      hostname: '127.0.0.1', port: 8765, method: 'POST',
      agent: false,
      timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(body);
          if (p.error) reject(new Error(p.error));
          else resolve(p.result);
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Matching intelligent
// ---------------------------------------------------------------------------

function findBestDeckMatch(subjectName, explicitDeckName, deckNames) {
  if (explicitDeckName && explicitDeckName.trim()) {
    const found = deckNames.find(d => d.toLowerCase() === explicitDeckName.trim().toLowerCase());
    if (found) return { deckName: found, method: 'explicit' };
  }
  const exact = deckNames.find(d => d.toLowerCase() === subjectName.toLowerCase());
  if (exact) return { deckName: exact, method: 'exact' };

  // Préférer les decks où le sujet apparaît comme dernier segment après ::
  const subjLower = subjectName.toLowerCase();
  const lastSegmentMatch = deckNames
    .filter(d => {
      const segments = d.split('::');
      return segments.length > 0 && segments[segments.length - 1].toLowerCase() === subjLower;
    })
    .sort((a, b) => a.length - b.length);
  if (lastSegmentMatch.length > 0) return { deckName: lastSegmentMatch[0], method: 'segment' };

  // Fallback : le deck le plus court contenant le sujet
  const candidates = deckNames
    .filter(d => d.toLowerCase().includes(subjLower))
    .sort((a, b) => a.length - b.length);
  if (candidates.length > 0) return { deckName: candidates[0], method: 'longest' };

  return { deckName: null, method: 'none' };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.join(__dirname, '..');
const COURS_PATH = path.join(ROOT, 'data', 'espoir_cours.json');

const args = process.argv.slice(2);
const shouldSave = args.includes('--save');
const jsonOutput = args.includes('--json');
const interactive = args.includes('--interactif') || args.includes('-i');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
ELPIS — map-anki-decks.js
==========================
Usage:
  node scripts/map-anki-decks.js              Affiche le mapping (read-only)
  node scripts/map-anki-decks.js --interactif Mode interactif (choix par matière)
  node scripts/map-anki-decks.js --save       Sauvegarde auto (matchs exacts/longest)
  node scripts/map-anki-decks.js --json       Sortie JSON
  node scripts/map-anki-decks.js --help       Cette aide

Mode interactif :
  Pour chaque matière sans mapping explicite :
    - La suggestion auto est affichée
    - La liste des decks Anki est numérotée
    - [Entrée] = accepter, [n°] = choisir, [s] = passer, [texte] = nom de deck

Prérequis : Anki lancé avec AnkiConnect (port 8765).
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectSubjects(coursData) {
  const subjects = [];
  for (const l of (coursData.licences || [])) {
    for (const s of (l.semestres || [])) {
      for (const u of (s.ues || [])) {
        for (const m of (u.matieres || [])) {
          if (m.nom) subjects.push({
            nom: m.nom,
            ankiDeckName: m.ankiDeckName || null,
            ue: u.nom || '?',
            semestre: s.nom || '?',
            _matiereObj: m,
            _ueObj: u,
            _semestreObj: s,
            _licenceObj: l
          });
        }
      }
    }
  }
  return subjects;
}

function saveCoursData(coursData) {
  const tmpPath = COURS_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(coursData, null, 4), 'utf8');
  if (fs.existsSync(COURS_PATH)) fs.unlinkSync(COURS_PATH);
  fs.renameSync(tmpPath, COURS_PATH);
}

function shortenDeckName(name, maxLen) {
  if (!name || name.length <= maxLen) return name;
  // Pour les decks hiérarchiques, montrer les 2 derniers segments
  const segments = name.split('::');
  if (segments.length > 2) {
    return '...::' + segments.slice(-2).join('::');
  }
  return name.substring(0, maxLen - 3) + '...';
}

// ---------------------------------------------------------------------------
// Mode interactif
// ---------------------------------------------------------------------------

async function interactiveMode(subjects, deckNames) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n🎯 MODE INTERACTIF — Mapping Matières ↔ Decks Anki');
  console.log('   [Entrée] = accepter la suggestion');
  console.log('   [1-99]   = choisir un deck dans la liste');
  console.log('   [s]      = passer (pas de deck)');
  console.log('   [texte]  = taper le nom exact du deck');
  console.log('   [q]      = quitter et sauvegarder\n');

  // Afficher la liste des decks une fois pour référence
  console.log('📋 Decks Anki disponibles :');
  deckNames.forEach((d, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${shortenDeckName(d, 70)}`);
  });
  console.log();

  let mapped = 0;
  let skipped = 0;
  const alreadyExplicit = subjects.filter(s => s.ankiDeckName);

  if (alreadyExplicit.length > 0) {
    console.log(`🔒 ${alreadyExplicit.length} matières déjà mappées (seront ignorées) :`);
    alreadyExplicit.forEach(s => console.log(`   - ${s.nom} → "${s.ankiDeckName}"`));
    console.log();
  }

  // Filtrer : seulement les matières sans mapping explicite
  const toMap = subjects.filter(s => !s.ankiDeckName);

  for (let idx = 0; idx < toMap.length; idx++) {
    const subj = toMap[idx];
    const match = findBestDeckMatch(subj.nom, null, deckNames);

    console.log(`\n━━━ ${idx + 1}/${toMap.length} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📚 ${subj.nom}`);
    console.log(`   Semestre: ${subj.semestre}  |  UE: ${subj.ue}`);

    if (match.deckName) {
      console.log(`   💡 Suggestion auto : "${shortenDeckName(match.deckName, 60)}" [méthode: ${match.method}]`);
    } else {
      console.log(`   ⚠️  Aucune suggestion automatique`);
    }

    const answer = await question(`   → Choix [Entrée=${match.deckName ? 'accepter' : 'passer'}] : `);

    if (answer.toLowerCase() === 'q') {
      console.log('   ⏹️  Quit. Sauvegarde en cours...');
      break;
    }

    if (answer === '') {
      // Entrée : accepter la suggestion ou passer
      if (match.deckName) {
        subj._matiereObj.ankiDeckName = match.deckName;
        console.log(`   ✅ Mappé → "${shortenDeckName(match.deckName, 50)}"`);
        mapped++;
      } else {
        console.log(`   ⏭️  Passé`);
        skipped++;
      }
      continue;
    }

    if (answer.toLowerCase() === 's') {
      console.log(`   ⏭️  Passé`);
      skipped++;
      continue;
    }

    // Essayer d'interpréter comme un numéro de deck
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= deckNames.length) {
      const chosenDeck = deckNames[num - 1];
      subj._matiereObj.ankiDeckName = chosenDeck;
      console.log(`   ✅ Mappé → "${shortenDeckName(chosenDeck, 50)}"`);
      mapped++;
      continue;
    }

    // Sinon, traiter comme un nom de deck tapé manuellement
    // Vérifier si ce nom existe (insensible à la casse)
    const found = deckNames.find(d => d.toLowerCase() === answer.toLowerCase());
    if (found) {
      subj._matiereObj.ankiDeckName = found;
      console.log(`   ✅ Mappé → "${shortenDeckName(found, 50)}"`);
      mapped++;
    } else {
      // Le deck n'existe pas encore — on stocke quand même le nom
      console.log(`   ⚠️  Le deck "${answer}" n'existe pas encore dans Anki.`);
      const confirm = await question(`   → Enregistrer quand même ? [o/N] : `);
      if (confirm.toLowerCase() === 'o' || confirm.toLowerCase() === 'oui') {
        subj._matiereObj.ankiDeckName = answer;
        console.log(`   ✅ Mappé → "${answer}" (sera effectif quand le deck existera)`);
        mapped++;
      } else {
        console.log(`   ⏭️  Passé`);
        skipped++;
      }
    }
  }

  rl.close();

  // Sauvegarder les mappings dans espoir_cours.json
  console.log(`\n💾 Sauvegarde dans espoir_cours.json...`);
  const freshData = JSON.parse(fs.readFileSync(COURS_PATH, 'utf8'));
  const subjectMap = new Map();
  for (const subj of [...alreadyExplicit, ...toMap]) {
    subjectMap.set(subj.nom, subj._matiereObj.ankiDeckName);
  }
  for (const l of freshData.licences) {
    for (const s of l.semestres || []) {
      for (const u of s.ues || []) {
        for (const m of u.matieres || []) {
          if (m.nom && subjectMap.has(m.nom)) {
            const val = subjectMap.get(m.nom);
            if (val) m.ankiDeckName = val;
          }
        }
      }
    }
  }
  saveCoursData(freshData);

  console.log(`\n📊 Résultat : ${mapped} mappées, ${skipped} passées, ${alreadyExplicit.length} déjà explicites.`);
  console.log(`   → ${mapped + alreadyExplicit.length}/${subjects.length} matières ont un ankiDeckName.\n`);
}

// ---------------------------------------------------------------------------
// Mode standard (affichage)
// ---------------------------------------------------------------------------

async function standardMode(subjects, deckNames) {
  const results = [];
  const deckUsage = {};

  for (const subj of subjects) {
    const match = findBestDeckMatch(subj.nom, subj.ankiDeckName, deckNames);
    results.push({ ...subj, matchedDeck: match.deckName, method: match.method });

    if (match.deckName) {
      if (!deckUsage[match.deckName]) deckUsage[match.deckName] = [];
      deckUsage[match.deckName].push(subj.nom);
    }
  }

  const collisions = Object.entries(deckUsage).filter(([_, subs]) => subs.length > 1);
  const unmatched = results.filter(r => !r.matchedDeck);
  const alreadyExplicit = results.filter(r => r.ankiDeckName);

  if (jsonOutput) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalSubjects: subjects.length,
      totalDecks: deckNames.length,
      explicitMappings: alreadyExplicit.length,
      unmatched: unmatched.length,
      collisions: collisions.length,
      results: results.map(r => ({
        subject: r.nom,
        explicitDeck: r.ankiDeckName,
        matchedDeck: r.matchedDeck,
        method: r.method,
        semestre: r.semestre,
        ue: r.ue
      })),
      collisions: collisions.map(([deck, subs]) => ({ deck, subjects: subs })),
      allDecks: deckNames
    }, null, 2));
    return;
  }

  const methodIcon = { explicit: '🔒', exact: '✅', segment: '🎯', longest: '🔍', none: '❌' };

  console.log('─'.repeat(80));
  console.log('  Statut  Matière                                     → Deck Anki');
  console.log('─'.repeat(80));

  for (const r of results) {
    const icon = methodIcon[r.method] || '❓';
    const name = r.nom.padEnd(42).substring(0, 42);
    const deck = shortenDeckName(r.matchedDeck || '(aucun deck trouvé)', 38);
    const existing = r.ankiDeckName ? ` [explicite: "${shortenDeckName(r.ankiDeckName, 25)}"]` : '';

    if (r.method === 'none') {
      console.log(`  ${icon}  \x1b[31m${name}\x1b[0m → \x1b[31m${deck}\x1b[0m${existing}`);
    } else if (r.method === 'longest') {
      console.log(`  ${icon}  \x1b[33m${name}\x1b[0m → \x1b[33m${deck}\x1b[0m${existing}`);
    } else {
      console.log(`  ${icon}  ${name} → ${deck}${existing}`);
    }
  }

  console.log('─'.repeat(80));
  console.log(`\n📊 Résumé :`);
  console.log(`   🔒 Explicites (ankiDeckName défini) : ${alreadyExplicit.length}`);
  console.log(`   ✅ Matchs exacts                    : ${results.filter(r => r.method === 'exact').length}`);
  console.log(`   🎯 Matchs par segment (dernier ::)  : ${results.filter(r => r.method === 'segment').length}`);
  console.log(`   🔍 Matchs par chevauchement         : ${results.filter(r => r.method === 'longest').length}`);
  console.log(`   ❌ Aucun match                      : ${unmatched.length}`);

  if (collisions.length > 0) {
    console.log(`\n⚠️  COLLISIONS (${collisions.length}) :`);
    for (const [deck, subs] of collisions) {
      console.log(`   "${shortenDeckName(deck, 50)}" ← ${subs.join(', ')}`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\n❌ SANS DECK (${unmatched.length}) — utilise --interactif pour les mapper`);
  }

  if (!shouldSave) {
    console.log('\n💡 Lance avec --interactif pour choisir toi-même les mappings');
    console.log('   ou --save pour sauvegarder les matchs automatiques.\n');
  }

  // --save
  if (shouldSave) {
    let saved = 0;
    for (const subj of subjects) {
      if (subj.ankiDeckName) continue;
      const match = findBestDeckMatch(subj.nom, null, deckNames);
      if ((match.method === 'exact' || match.method === 'segment') && match.deckName) {
        subj._matiereObj.ankiDeckName = match.deckName;
        saved++;
      }
    }

    const coursData = JSON.parse(fs.readFileSync(COURS_PATH, 'utf8'));
    const subjectMap = new Map();
    for (const subj of subjects) {
      if (subj._matiereObj.ankiDeckName) subjectMap.set(subj.nom, subj._matiereObj.ankiDeckName);
    }
    for (const l of coursData.licences) {
      for (const s of l.semestres || []) {
        for (const u of s.ues || []) {
          for (const m of u.matieres || []) {
            if (m.nom && subjectMap.has(m.nom)) {
              m.ankiDeckName = subjectMap.get(m.nom);
            }
          }
        }
      }
    }
    saveCoursData(coursData);
    console.log(`💾 ${saved} mappings automatiques sauvegardés.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  ELPIS — Mapping Matières ↔ Decks Anki              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(COURS_PATH)) {
    console.error('❌ Fichier introuvable:', COURS_PATH);
    process.exit(1);
  }
  const coursData = JSON.parse(fs.readFileSync(COURS_PATH, 'utf8'));
  const subjects = collectSubjects(coursData);
  console.log(`📚 ${subjects.length} matières chargées`);

  console.log('🔌 Connexion à AnkiConnect...');
  let deckNames;
  try {
    deckNames = await ankiRequest('deckNames');
    console.log(`📋 ${deckNames.length} decks Anki trouvés\n`);
  } catch (e) {
    console.error(`❌ AnkiConnect: ${e.message}`);
    process.exit(1);
  }

  if (interactive) {
    await interactiveMode(subjects, deckNames);
  } else {
    await standardMode(subjects, deckNames);
  }
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
