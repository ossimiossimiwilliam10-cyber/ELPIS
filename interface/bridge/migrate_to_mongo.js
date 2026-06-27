const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Mettez votre chaîne de connexion MongoDB ici
const MONGODB_URI = process.argv[2];

if (!MONGODB_URI) {
  console.error("❌ Veuillez fournir l'URI MongoDB en argument.");
  console.log("👉 Exemple : node migrate_to_mongo.js 'mongodb+srv://user:pass@cluster.mongodb.net/elpis_db'");
  process.exit(1);
}

const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'espoir_config.json');
const COURS_FILE = path.join(ROOT_DIR, 'data', 'espoir_cours.json');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'data', 'espoir_historique.json');

async function migrate() {
  console.log("⏳ Connexion à MongoDB...");
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('elpis_db');
    console.log("✅ Connecté !");

    // Upload Config
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      await db.collection('app_data').updateOne(
        { type: 'config' },
        { $set: { data: configData, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log("✅ Configuration synchronisée.");
    }

    // Upload Cours
    if (fs.existsSync(COURS_FILE)) {
      const coursData = JSON.parse(fs.readFileSync(COURS_FILE, 'utf8'));
      await db.collection('app_data').updateOne(
        { type: 'cours' },
        { $set: { data: coursData, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log("✅ Cours synchronisés.");
    }

    // Upload Historique
    if (fs.existsSync(HISTORIQUE_FILE)) {
      const histData = JSON.parse(fs.readFileSync(HISTORIQUE_FILE, 'utf8'));
      await db.collection('app_data').updateOne(
        { type: 'historique' },
        { $set: { data: histData, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log("✅ Historique synchronisé.");
    }

    console.log("🎉 Migration terminée avec succès !");
  } catch (err) {
    console.error("❌ Erreur pendant la migration :", err);
  } finally {
    await client.close();
  }
}

migrate();
