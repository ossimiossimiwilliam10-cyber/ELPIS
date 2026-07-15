const express = require('express');
const router = express.Router();
const { loadCours, saveCours } = require('../moteur/cours');
const { syncToMongo } = require('../mongoAdapter');
const { syncAnkiRetention, extractSubjectNames, fetchDeckNames } = require('../moteur/ankiSync');


// GET Anki decks
router.get('/decks', async (req, res, next) => {
  try {
    const decks = await fetchDeckNames();
    res.json({ success: true, decks });
  } catch (err) {
    next(err);
  }
});

// POST Anki sync
router.post('/sync', async (req, res, next) => {
  try {
    const coursData = loadCours();
    
    // Extraction des matières et leurs mappings
    const subjects = extractSubjectNames(coursData);
    
    // Lancement de la synchronisation avancée
    const ankiStats = await syncAnkiRetention(subjects, 365);
    
    if (ankiStats.success) {
       coursData._globalAnkiStats = ankiStats;
       saveCours(coursData);
       syncToMongo('cours', coursData).catch(err => {
         console.error("Erreur syncToMongo (cours via anki):", err.message);
       });

       res.json({ success: true, message: `Synchronisation réussie (${Object.keys(ankiStats.retentionBySubject || {}).length} matières mises à jour)` });
    } else {
       res.status(500).json({ error: ankiStats.message || ankiStats.error });
    }
  } catch (err) {
    next(err);
  }
});

// GET Anki Stats for Today
router.get('/today-stats', async (req, res, next) => {
  try {
    const coursData = loadCours();
    const subjects = extractSubjectNames(coursData);
    const ankiStats = await syncAnkiRetention(subjects, 1);
    res.json(ankiStats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
