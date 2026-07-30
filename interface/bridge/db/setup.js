const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.TEST_DB_PATH || path.join(DB_DIR, 'elpis.sqlite');

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
      archived INTEGER DEFAULT 0,
      targetGrade REAL,
      targetRank REAL
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

  return db;
}

// Ensure the db is initialized when imported
const dbInstance = initDb();

module.exports = { db: dbInstance, DB_PATH };
