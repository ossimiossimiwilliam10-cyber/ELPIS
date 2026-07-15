const express = require('express');
const router = express.Router();
const { loadCours } = require('../moteur/cours');
const { genererRapportQuotidien, genererTacheSpecifique } = require('../moteur/orchestrateur');
const { CONFIG_PATH } = require('../moteur/config');
const { COURS_PATH } = require('../moteur/cours');

const orchestratorCache = new Map();
const CACHE_TTL_MS = 60000;

// GET orchestrator report
router.get('/', async (req, res, next) => {
  try {
    const extraTime = parseInt(req.query.extraTime) || 0;
    const fillGap = req.query.fillGap === 'true';
    const now = Date.now();

    let ankiStats = null;
    try {
        const coursData = loadCours();
        if (coursData._globalAnkiStats) {
           ankiStats = coursData._globalAnkiStats;
        }
    } catch (err) {
        console.error("Erreur lecture _globalAnkiStats :", err.message);
    }

    const ankiKey = ankiStats && ankiStats.success ? JSON.stringify(ankiStats.retentionBySubject || {}) : 'none';
    const cacheKey = `${global.dbVersion || 0}_${extraTime}_${fillGap}_${ankiKey}`;

    let cacheEntry = orchestratorCache.get(cacheKey);
    let cacheValid = cacheEntry && (now - cacheEntry.timestamp) < CACHE_TTL_MS;

    const rapport = cacheValid
      ? cacheEntry.rapport
      : genererRapportQuotidien(extraTime, fillGap, ankiStats);

    if (!cacheValid) {
      orchestratorCache.set(cacheKey, {
        rapport,
        timestamp: now
      });
    }

    // Nettoyage périodique des vieilles entrées
    for (const [key, entry] of orchestratorCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        orchestratorCache.delete(key);
      }
    }
    
    // Assigner les métadonnées globales au rapport final
    if (rapport && rapport.intelligence && ankiStats && ankiStats.success && ankiStats.retentionRate !== null) {
        rapport.intelligence.fsrs_real_retention = ankiStats.retentionRate;
        rapport.intelligence.fsrs_retention_by_subject = ankiStats.retentionBySubject;
        rapport.intelligence.fsrs_unmatched_subjects = ankiStats.unmatchedSubjects || [];
        rapport.intelligence.fsrs_deck_mappings = ankiStats.deckMappings || [];
    }

    res.json(rapport);
  } catch (err) {
    next(err);
  }
});

// POST force-task
router.post('/force-task', (req, res, next) => {
  try {
    const options = {
      matiere: req.body.matiere || 'all',
      type: req.body.type || 'all',
      dureeMin: parseInt(req.body.dureeMin) || 0
    };

    const task = genererTacheSpecifique(CONFIG_PATH, COURS_PATH, options);
    if (!task) {
      return res.status(404).json({ error: "Aucune tâche trouvée pour ces critères." });
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
