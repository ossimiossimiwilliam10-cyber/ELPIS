const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig, validateConfigSchema } = require('../moteur/config');
const { controleVersion, incrementerVersion } = require('../moteur/versions');

// Annonce la version courante en lecture, refuse une ecriture fondee sur
// une version perimee. Voir moteur/versions.js.
router.use(controleVersion('config', loadConfig));

// GET current config
router.get('/', (req, res, next) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// POST update config
router.post('/', (req, res, next) => {
  try {
    if (!validateConfigSchema(req.body)) {
      return res.status(400).json({ 
        error: "Données de configuration invalides."
      });
    }
    const success = saveConfig(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde configuration." });
    }
    global.dbVersion = (global.dbVersion || 0) + 1;
    res.json({ success: true, message: "Configuration mise à jour.", version: incrementerVersion('config') });
  } catch (err) {
    next(err);
  }
});

// POST skip rest day
router.post('/skip-rest', (req, res, next) => {
  try {
    const cfg = loadConfig();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    if (!cfg.skippedRestDays) cfg.skippedRestDays = [];
    if (!cfg.skippedRestDays.includes(todayStr)) {
      cfg.skippedRestDays.push(todayStr);
      saveConfig(cfg);
      global.dbVersion = (global.dbVersion || 0) + 1;
    }
    res.json({ success: true, message: "Jour de repos ignoré.", version: incrementerVersion('config') });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
