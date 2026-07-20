const fs = require('fs');
const path = require('path');

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
        before: aiStateBefore,
        after: aiStateAfter
      }
    };

    data.sessions.push(entry);
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
      action: actionType,
      task_context: taskContext
    };

    data.actions.push(entry);
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Erreur d'écriture de télémétrie action:", error);
  }
}

module.exports = {
  logSession,
  logRecommendationAction
};