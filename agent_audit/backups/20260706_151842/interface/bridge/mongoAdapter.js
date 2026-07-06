const { MongoClient } = require('mongodb');
const fs = require('fs');
require('dotenv').config();

let client;
let db;

async function initMongo() {
  if (!process.env.MONGODB_URI) {
    console.log("⚠️  Aucune variable MONGODB_URI trouvée. ELPIS tournera en mode local (fichiers).");
    return false;
  }
  
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('elpis_db');
    console.log("✅  Connecté avec succès à MongoDB Cloud !");
    return true;
  } catch (err) {
    console.error("❌  Erreur de connexion à MongoDB :", err.message);
    return false;
  }
}

async function syncFromMongoToLocal(CONFIG_FILE, COURS_FILE, HISTORIQUE_FILE) {
  if (!db) return;

  try {
    console.log("📥  Synchronisation des données Cloud vers Local...");
    
    const configDoc = await db.collection('app_data').findOne({ type: 'config' });
    if (configDoc && configDoc.data) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configDoc.data, null, 4), 'utf8');
    }
    
    const coursDoc = await db.collection('app_data').findOne({ type: 'cours' });
    if (coursDoc && coursDoc.data) {
      fs.writeFileSync(COURS_FILE, JSON.stringify(coursDoc.data, null, 4), 'utf8');
    }
    
    const histDoc = await db.collection('app_data').findOne({ type: 'historique' });
    if (histDoc && histDoc.data) {
      fs.writeFileSync(HISTORIQUE_FILE, JSON.stringify(histDoc.data, null, 4), 'utf8');
    }
    
    console.log("✅  Synchronisation initiale terminée.");
  } catch (err) {
    console.error("❌  Erreur lors de la synchronisation initiale MongoDB:", err.message);
  }
}

async function syncToMongo(type, data) {
  if (!db) return;
  
  try {
    await db.collection('app_data').updateOne(
      { type: type },
      { $set: { data: data, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`❌  Erreur de sauvegarde MongoDB pour [${type}]:`, err.message);
  }
}

const getDb = () => db;

module.exports = { initMongo, syncFromMongoToLocal, syncToMongo, getDb };
