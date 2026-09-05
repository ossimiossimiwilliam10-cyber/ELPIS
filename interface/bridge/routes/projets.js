const express = require('express');
const router = express.Router();
const { loadProjets, saveProjets } = require('../moteur/projets');
const { controleVersion, incrementerVersion } = require('../moteur/versions');

// Annonce la version courante en lecture, refuse une ecriture fondee sur
// une version perimee. Voir moteur/versions.js.
router.use(controleVersion('projets', loadProjets));

// GET projets
router.get('/', (req, res, next) => {
  try {
    const projets = loadProjets();
    res.json(projets);
  } catch (err) {
    next(err);
  }
});

// POST projets
router.post('/', (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Les projets doivent être un tableau." });
    }
    const success = saveProjets(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde des projets." });
    }
    res.json({ success: true, message: "Projets mis à jour.", version: incrementerVersion('projets') });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
