const { MongoClient } = require('mongodb');
const { saveConfig } = require('./moteur/config');
const { saveCours } = require('./moteur/cours');
const { saveHistorique } = require('./moteur/historique');
require('dotenv').config();

let client;
let db;

async function initMongo() {
  if (!process.env.MONGODB_URI) {
    console.log("⚠️  Aucune variable MONGODB_URI trouvée. ELPIS tournera en mode local (SQLite).");
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

async function syncFromMongoToLocal() {
  if (!db) return;

  try {
    console.log("📥  Synchronisation des données Cloud vers Local...");

    const configDoc = await db.collection('app_data').findOne({ type: 'config' });
    if (configDoc && configDoc.data && Object.keys(configDoc.data).length > 0) {
      saveConfig(configDoc.data);
    }

    const coursDoc = await db.collection('app_data').findOne({ type: 'cours' });
    if (coursDoc && coursDoc.data && coursDoc.data.licences) {
      saveCours(coursDoc.data);
    }

    const histDoc = await db.collection('app_data').findOne({ type: 'historique' });
    if (histDoc && histDoc.data && Array.isArray(histDoc.data)) {
      saveHistorique(histDoc.data);
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
