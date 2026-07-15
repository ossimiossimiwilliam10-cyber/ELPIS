const express = require('express');
const router = express.Router();
const { loadHistorique, saveHistorique, clearHistorique, historiqueSchema } = require('../moteur/historique');
const { syncToMongo } = require('../mongoAdapter');

// GET history
router.get('/', (req, res, next) => {
  try {
    const data = loadHistorique();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST update history
router.post('/', (req, res, next) => {
  try {
    const parseResult = historiqueSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "L'historique est invalide.",
        details: parseResult.error.errors 
      });
    }
    
    const saved = saveHistorique(req.body);
    if (!saved) {
      return res.status(500).json({ error: "Erreur sauvegarde historique." });
    }
    global.dbVersion = (global.dbVersion || 0) + 1;
    
    syncToMongo('historique', saved).catch(err => {
      console.error("Erreur syncToMongo (historique):", err.message);
    });
    res.json({ success: true, message: "Historique mis à jour." });
  } catch (err) {
    next(err);
  }
});

// POST clear history
router.post('/clear', (req, res, next) => {
  try {
    const success = clearHistorique();
    if (!success) {
      return res.status(500).json({ error: "Erreur lors de la suppression de l'historique." });
    }
    syncToMongo('historique', []).catch(err => {
      console.error("Erreur syncToMongo (historique):", err.message);
    });
    res.json({ message: "Historique vidé" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
