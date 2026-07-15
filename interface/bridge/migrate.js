const fs = require('fs');
const path = require('path');
const { saveCours } = require('./moteur/cours');
const { saveConfig } = require('./moteur/config');
const { saveHistorique } = require('./moteur/historique');
const { saveProjets } = require('./moteur/projets');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const COURS_FILE = path.join(DATA_DIR, 'espoir_cours.json');
const CONFIG_FILE = path.join(DATA_DIR, 'espoir_config.json');
const HISTORIQUE_FILE = path.join(DATA_DIR, 'espoir_historique.json');
const PROJETS_FILE = path.join(DATA_DIR, 'espoir_projets.json'); // Might not exist

async function runMigration() {
  console.log("Démarrage de la migration JSON -> SQLite...");

  // Config
  if (fs.existsSync(CONFIG_FILE)) {
    const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    saveConfig(configData);
    console.log("✅ Configuration migrée.");
  }

  // Cours
  if (fs.existsSync(COURS_FILE)) {
    const coursData = JSON.parse(fs.readFileSync(COURS_FILE, 'utf8'));
    const res = saveCours(coursData);
    if (res) console.log("✅ Cours migrés.");
    else console.log("❌ Erreur validation cours.");
  }

  // Historique
  if (fs.existsSync(HISTORIQUE_FILE)) {
    const histData = JSON.parse(fs.readFileSync(HISTORIQUE_FILE, 'utf8'));
    saveHistorique(histData);
    console.log("✅ Historique migré.");
  }

  // Projets
  if (fs.existsSync(PROJETS_FILE)) {
    const projData = JSON.parse(fs.readFileSync(PROJETS_FILE, 'utf8'));
    saveProjets(projData);
    console.log("✅ Projets migrés.");
  }

  console.log("Migration terminée avec succès.");
}

runMigration().catch(console.error);
