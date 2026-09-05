const express = require('express');
const router = express.Router();
const { loadCours, saveCours, validateCoursSchema } = require('../moteur/cours');
const { controleVersion, incrementerVersion } = require('../moteur/versions');

// Annonce la version courante en lecture, refuse une ecriture fondee sur
// une version perimee. Voir moteur/versions.js.
router.use(controleVersion('cours', loadCours));

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
    res.json({ success: true, message: "Cours mis à jour.", version: incrementerVersion('cours') });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
