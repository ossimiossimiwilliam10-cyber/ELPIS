#!/usr/bin/env node
/**
 * Remise à zéro complète d'ELPIS — état « première utilisation ».
 *
 * Vide toutes les tables de data/elpis.sqlite : cursus, cours, exercices, historique,
 * configuration et projets. L'application redémarre comme au tout premier lancement.
 *
 * Une sauvegarde horodatée est écrite dans backups/ avant toute suppression, et le
 * script refuse d'agir sans confirmation explicite.
 *
 *   node scripts/reset-app.js            # montre ce qui serait supprimé, ne touche à rien
 *   node scripts/reset-app.js --confirm  # effectue la remise à zéro
 *
 * ⚠️ Le navigateur conserve sa propre copie (RxDB/IndexedDB, localStorage). Après ce
 * script, vider les données du site dans le navigateur, sinon l'ancien contenu est
 * resynchronisé au prochain chargement. La marche à suivre est rappelée en fin
 * d'exécution.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '..');

// better-sqlite3 est une dépendance du bridge, pas de la racine : on résout depuis là.
const bridgeRequire = createRequire(path.join(ROOT, 'interface', 'bridge', 'package.json'));
const Database = bridgeRequire('better-sqlite3');
const DB_PATH = path.join(ROOT, 'data', 'elpis.sqlite');
const BACKUP_DIR = path.join(ROOT, 'backups');

const TABLES = [
  'exercices', 'cours_cm', 'matieres', 'ues', 'semestres', 'licences',
  'historique', 'config', 'projets',
];

/** Horodatage compact YYYYMMDD_HHMMSS pour nommer la sauvegarde. */
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function main() {
  const confirmed = process.argv.includes('--confirm');

  if (!fs.existsSync(DB_PATH)) {
    console.log(`Aucune base à réinitialiser (${DB_PATH} est absent).`);
    console.log('L\'application est déjà dans son état de première utilisation.');
    return;
  }

  const db = new Database(DB_PATH);

  console.log('Contenu actuel de la base :');
  let total = 0;
  for (const table of TABLES) {
    try {
      const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      total += n;
      console.log(`  ${table.padEnd(12)} ${n}`);
    } catch {
      console.log(`  ${table.padEnd(12)} (table absente)`);
    }
  }

  if (total === 0) {
    console.log('\nLa base est déjà vide. Rien à faire.');
    db.close();
    return;
  }

  if (!confirmed) {
    console.log(`\n${total} enregistrements seraient supprimés.`);
    console.log('Relancez avec --confirm pour effectuer la remise à zéro :');
    console.log('  node scripts/reset-app.js --confirm');
    db.close();
    return;
  }

  // Sauvegarde avant suppression — l'API backup gère le mode WAL correctement.
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `elpis_avant_reset_${stamp()}.db`);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`\nSauvegarde écrite : ${path.relative(ROOT, backupPath)}`);

  // Suppression dans une transaction, enfants avant parents (clés étrangères).
  const wipe = db.transaction(() => {
    for (const table of TABLES) {
      try {
        db.exec(`DELETE FROM ${table}`);
      } catch (err) {
        console.warn(`  ! ${table} : ${err.message}`);
      }
    }
  });
  wipe();

  db.exec('VACUUM');
  db.close();

  console.log('Base vidée. ELPIS démarrera en état de première utilisation.');
  console.log('\nÉtape restante, côté navigateur :');
  console.log('  ouvrir ELPIS → F12 → Application → Effacer les données du site');
  console.log('  (sans quoi la copie locale RxDB restaure l\'ancien contenu)');
}

main();
