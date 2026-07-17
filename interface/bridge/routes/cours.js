const express = require('express');
const router = express.Router();
const { loadCours, saveCours, validateCoursSchema } = require('../moteur/cours');
const { syncToMongo } = require('../mongoAdapter');

// GET current courses
router.get('/', (req, res, next) => {
  try {
    const cours = loadCours();
    res.json(cours);
  } catch (err) {
    next(err);
  }
});

// POST update courses
router.post('/', (req, res, next) => {
  try {
    if (!validateCoursSchema(req.body)) {
      return res.status(400).json({ 
        error: "Structure de cours invalide."
      });
    }
    const success = saveCours(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde." });
    }
    global.dbVersion = (global.dbVersion || 0) + 1;
    syncToMongo('cours', req.body).catch(err => {
      console.error("Erreur syncToMongo (cours):", err.message);
    });

    res.json({ success: true, message: "Cours mis à jour." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
