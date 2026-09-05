const express = require('express');
const router = express.Router();
const { loadHistorique, saveHistorique, clearHistorique } = require('../moteur/historique');
const { historiqueSchema } = require('../moteur/schemas');
const { controleVersion, incrementerVersion } = require('../moteur/versions');

// Annonce la version courante en lecture, refuse une ecriture fondee sur
// une version perimee. Voir moteur/versions.js.
router.use(controleVersion('historique', loadHistorique));

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
    res.json({ success: true, message: "Historique mis à jour.", version: incrementerVersion('historique') });
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
    res.json({ message: "Historique vidé", version: incrementerVersion('historique') });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
