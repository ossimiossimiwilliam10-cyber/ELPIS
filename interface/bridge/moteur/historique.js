const { db } = require('../db/setup');
const crypto = require('crypto');

function loadHistorique() {
  try {
    const rows = db.prepare('SELECT * FROM historique ORDER BY timestamp ASC').all();
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      titre: r.titre,
      matiere: r.matiere,
      action: r.action,
      timestamp: r.timestamp,
      dureeMinutes: r.dureeMinutes
    }));
  } catch (err) {
    console.error("Erreur lecture historique:", err.message);
    return [];
  }
}

function saveHistorique(historiqueData) {
  try {
    const trimmed = historiqueData.length > 10000 ? historiqueData.slice(historiqueData.length - 10000) : historiqueData;

    const tx = db.transaction((entries) => {
      db.exec('DELETE FROM historique');
      const stmt = db.prepare('INSERT INTO historique (id, type, titre, matiere, action, timestamp, dureeMinutes) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const entry of entries) {
        stmt.run(
          entry.id || crypto.randomUUID(),
          entry.type || '',
          entry.titre || null,
          entry.matiere || '',
          entry.action || null,
          entry.timestamp || new Date().toISOString(),
          entry.dureeMinutes || null
        );
      }
    });

    tx(trimmed);
    return trimmed;
  } catch (err) {
    console.error("Erreur sauvegarde historique:", err.message);
    return false;
  }
}

function clearHistorique() {
    try {
        db.exec('DELETE FROM historique');
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
  loadHistorique,
  saveHistorique,
  clearHistorique
};
