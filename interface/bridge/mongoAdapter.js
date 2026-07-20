// mongoAdapter.js — désactivé, ELPIS tourne en 100% local (SQLite)
// Conservé comme stub pour éviter les erreurs d'import résiduelles.

function getDb() { return null; }
async function initMongo() { return false; }
async function syncFromMongoToLocal() {}
async function syncToMongo() {}

module.exports = { initMongo, syncFromMongoToLocal, syncToMongo, getDb };
