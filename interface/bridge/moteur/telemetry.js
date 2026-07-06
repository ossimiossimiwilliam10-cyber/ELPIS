const fs = require('fs');
const path = require('path');
const { getDb } = require('../mongoAdapter');

const TELEMETRY_FILE = path.join(__dirname, '..', '..', 'data', 'telemetry.json');

// Initialiser le fichier si non existant
if (!fs.existsSync(TELEMETRY_FILE)) {
  fs.mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify({ sessions: [], actions: [] }, null, 2), 'utf-8');
}

/**
 * Enregistre une session complétée avec le contexte de l'IA (Priors vs Posteriors)
 */
async function logSession(sessionData, aiStateBefore, aiStateAfter) {
  try {
    const data = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf-8'));

    const entry = {
      timestamp: new Date().toISOString(),
      type: 'session_completed',
      matiere: sessionData.matiere,
      duree: sessionData.dureeMinutes,
      score: sessionData.scoreObtenu,
      ai_context: {
        before: aiStateBefore, // ex: projectedScore avant la session
        after: aiStateAfter    // ex: projectedScore après la session
      }
    };

    data.sessions.push(entry);
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf-8');

    // Tentative de push asynchrone vers Mongo si dispo (Fire and forget)
    const db = getDb();
    if (db) {
      db.collection('telemetry_sessions').insertOne(entry).catch(err => console.error("Erreur Mongo Télémétrie:", err));
    }

  } catch (error) {
    console.error("Erreur d'écriture de télémétrie session:", error);
  }
}

/**
 * Enregistre une interaction avec les recommandations (Accepter, Ignorer, Skip)
 */
async function logRecommendationAction(actionType, taskContext) {
  try {
    const data = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf-8'));

    const entry = {
      timestamp: new Date().toISOString(),
      type: 'recommendation_action',
      action: actionType, // 'accepted', 'ignored', 'skipped'
      task_context: taskContext // ex: { matiere: 'Maths', isExploration: true, prioScore: 8.5 }
    };

    data.actions.push(entry);
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf-8');

    const db = getDb();
    if (db) {
      db.collection('telemetry_actions').insertOne(entry).catch(err => console.error("Erreur Mongo Télémétrie:", err));
    }

  } catch (error) {
    console.error("Erreur d'écriture de télémétrie action:", error);
  }
}

module.exports = {
  logSession,
  logRecommendationAction
};
