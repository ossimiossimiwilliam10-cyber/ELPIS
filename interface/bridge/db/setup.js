const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const PROD_DB_PATH = path.join(DB_DIR, 'elpis.sqlite');

// Les suites de tests vident les tables (DELETE FROM ...) dans leurs hooks. Sans
// aiguillage automatique, un simple `npm test` détruit les données réelles de
// l'utilisateur. On bascule donc d'office sur une base jetable dès qu'un lanceur de
// tests est détecté, sans dépendre d'une variable d'environnement à ne pas oublier.
const isTestEnv = Boolean(
  process.env.VITEST ||
  process.env.JEST_WORKER_ID ||
  process.env.NODE_ENV === 'test'
);

// Vitest exécute les fichiers de tests en parallèle. Une base unique partagée ferait
// apparaître les fixtures d'une suite dans les résultats d'une autre : chaque worker
// obtient donc son propre fichier.
const testDbName = `elpis.test.${process.env.VITEST_WORKER_ID || process.env.JEST_WORKER_ID || '0'}.sqlite`;

const DB_PATH = process.env.TEST_DB_PATH
  || (isTestEnv ? path.join(DB_DIR, testDbName) : PROD_DB_PATH);

// Filet de sécurité : même avec un TEST_DB_PATH explicite, on refuse de laisser une
// exécution de tests s'attaquer à la base de production.
if (isTestEnv && path.resolve(DB_PATH) === path.resolve(PROD_DB_PATH)) {
  throw new Error(
    "Refus d'exécuter les tests sur la base de production (data/elpis.sqlite). " +
    "Laissez TEST_DB_PATH vide ou pointez-la vers une base jetable."
  );
}

function initDb() {
  const db = new Database(DB_PATH, { verbose: null });

  db.pragma('journal_mode = WAL'); // Better performance and concurrency
  db.pragma('busy_timeout = 5000'); // Retry on lock for 5s (prevents SQLITE_BUSY)
  db.pragma('foreign_keys = ON'); // Enforce referential integrity

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS licences (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS semestres (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      dateFin TEXT,
      licence_id TEXT,
      FOREIGN KEY(licence_id) REFERENCES licences(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ues (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      ects REAL,
      semestre_id TEXT,
      FOREIGN KEY(semestre_id) REFERENCES semestres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matieres (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      coef REAL,
      ects REAL,
      dateExamen TEXT,
      ankiDeckName TEXT,
      evaluations TEXT,
      notebookLMLink TEXT,
      cm_h INTEGER,
      td_h INTEGER,
      tp_h INTEGER,
      synergies TEXT,
      ue_id TEXT,
      FOREIGN KEY(ue_id) REFERENCES ues(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cours_cm (
      id TEXT PRIMARY KEY,
      titre TEXT NOT NULL,
      dateCM TEXT,
      derniereRevision TEXT,
      prochaineRevisionDate TEXT,
      jActuel INTEGER,
      tempsMoyen REAL,
      fichePdfPath TEXT,
      pdfPath TEXT,
      pdfPaths TEXT, -- JSON array
      fsrsCard TEXT, -- JSON FSRS data
      rappels TEXT, -- JSON : questions de recuperation active
      ankiDeck TEXT, -- sous-deck Anki auquel ce cours est rattache
      easeFactor REAL,
      repetitions INTEGER,
      nombreRevisionsTemps INTEGER,
      matiere_id TEXT,
      FOREIGN KEY(matiere_id) REFERENCES matieres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercices (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'TD', 'TP', 'ANNALE'
      titre TEXT NOT NULL,
      dernierePratique TEXT,
      dateTP TEXT,
      datePrevue TEXT,
      nombrePratiques INTEGER,
      tempsMoyen REAL,
      tempsMoyenEtapes TEXT, -- JSON array
      nombreRevisionsEtapes TEXT, -- JSON array, une mesure par étape
      pdfPath TEXT,
      pdfPaths TEXT, -- JSON array
      page INTEGER,
      difficulte TEXT,
      difficulteInitiale TEXT,
      derniereNote REAL,
      notes TEXT, -- JSON array
      nombreRevisionsTemps INTEGER,
      matiere_id TEXT,
      FOREIGN KEY(matiere_id) REFERENCES matieres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS historique (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      titre TEXT,
      matiere TEXT NOT NULL,
      action TEXT,
      timestamp TEXT NOT NULL,
      dureeMinutes REAL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT -- JSON
    );

    CREATE TABLE IF NOT EXISTS projets (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      matiere TEXT,
      deadline TEXT,
      status TEXT,
      progress REAL,
      priority TEXT
    );
  `);

  appliquerMigrations(db);
  return db;
}

/**
 * Colonnes ajoutées après la création initiale du schéma.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table existante : toute
 * colonne ajoutée plus tard manquait donc aux bases déjà en service, y compris
 * celles des tests. Chaque entrée est appliquée une fois, silencieusement si
 * elle est déjà là.
 */
const MIGRATIONS = [
  { table: 'cours_cm', colonne: 'rappels', type: 'TEXT' },
  { table: 'cours_cm', colonne: 'ankiDeck', type: 'TEXT' },
  // Sans ce compteur, `moyenneGlissante` recevait toujours zéro mesure et
  // remplaçait la moyenne par la dernière valeur : l'estimation de durée d'une
  // étape de TP ne convergeait jamais, elle suivait la dernière séance.
  { table: 'exercices', colonne: 'nombreRevisionsEtapes', type: 'TEXT' },
  /*
   * La table des projets datait d'un modèle abandonné : elle attendait `nom`,
   * `status`, `progress`, quand la page en produit `titre`, `dateFin` et une
   * liste de `phases`. L'enregistrement échouait donc sur la contrainte NOT
   * NULL de `nom`, et aucun projet ne pouvait exister.
   */
  { table: 'projets', colonne: 'titre', type: 'TEXT' },
  { table: 'projets', colonne: 'dateFin', type: 'TEXT' },
  { table: 'projets', colonne: 'phases', type: 'TEXT' },
];

/*
 * Colonnes retirées.
 *
 * `targetGrade` et `targetRank` venaient d'un modèle où l'on déclarait une
 * moyenne et un rang visés. Le régime hebdomadaire d'`objectifs.js` — quatre,
 * cinq ou six jours par semaine — les a remplacés, mais les colonnes étaient
 * restées, tout comme les clés de configuration. Aucun calcul ne les lisait, et
 * aucun champ de l'interface ne permettait de les modifier : elles ne faisaient
 * que laisser croire à un réglage qui n'existait plus.
 */
const COLONNES_RETIREES = [
  { table: 'licences', colonne: 'targetGrade' },
  { table: 'licences', colonne: 'targetRank' },
];

function appliquerMigrations(db) {
  for (const { table, colonne, type } of MIGRATIONS) {
    const existe = db.prepare(`PRAGMA table_info(${table})`).all()
      .some(c => c.name === colonne);
    if (!existe) db.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type}`);
  }

  for (const { table, colonne } of COLONNES_RETIREES) {
    const existe = db.prepare(`PRAGMA table_info(${table})`).all()
      .some(c => c.name === colonne);
    // `DROP COLUMN` demande SQLite 3.35 ; une base plus ancienne garderait la
    // colonne sans dommage, puisque plus personne ne l'écrit ni ne la lit.
    if (existe) {
      try { db.exec(`ALTER TABLE ${table} DROP COLUMN ${colonne}`); } catch { /* colonne laissée en place */ }
    }
  }
}

// Ensure the db is initialized when imported
const dbInstance = initDb();

module.exports = { db: dbInstance, DB_PATH };
