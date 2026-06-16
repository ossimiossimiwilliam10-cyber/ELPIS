const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { loadConfig, saveConfig } = require('./moteur/config');
const { loadCours, saveCours } = require('./moteur/cours');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ROOT_DIR = path.join(__dirname, '..', '..');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'espoir_historique.json');

// ===================== ROUTES =====================

// GET current config
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture configuration." });
  }
});

// POST update config
app.post('/api/config', (req, res) => {
  try {
    const success = saveConfig(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde configuration." });
    }
    res.json({ success: true, message: "Configuration mise à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// GET current courses
app.get('/api/cours', (req, res) => {
  try {
    const cours = loadCours();
    res.json(cours);
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture des cours." });
  }
});

// POST update courses
app.post('/api/cours', (req, res) => {
  try {
    const success = saveCours(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde des cours." });
    }
    res.json({ success: true, message: "Cours mis à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// GET history
app.get('/api/historique', (req, res) => {
  try {
    if (fs.existsSync(HISTORIQUE_FILE)) {
      const data = fs.readFileSync(HISTORIQUE_FILE, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture historique." });
  }
});

// POST update history
app.post('/api/historique', (req, res) => {
  try {
    fs.writeFileSync(HISTORIQUE_FILE, JSON.stringify(req.body, null, 4));
    res.json({ success: true, message: "Historique mis à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur sauvegarde historique." });
  }
});

// POST open anki
app.post('/api/open/anki', (req, res) => {
  const { spawn } = require('child_process');
  const pathModule = require('path');
  
  const ankiPath = pathModule.join(process.env.LOCALAPPDATA, 'Programs', 'Anki', 'anki.exe');
  
  if (!fs.existsSync(ankiPath)) {
    return res.status(404).json({ error: "Anki n'est pas installé ou introuvable." });
  }
  
  const child = spawn(ankiPath, [], {
    detached: true,
    stdio: 'ignore',
  });
  
  child.on('error', (err) => {
    console.error("Erreur lancement Anki:", err.message);
  });
  
  child.unref();
  res.json({ success: true, message: "Anki lancé avec succès." });
});

// POST shutdown
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: "Arrêt du serveur." });
  setTimeout(() => process.exit(0), 1000);
});

// GET orchestrator report
app.get('/api/orchestrateur', (req, res) => {
  try {
    const { CONFIG_PATH } = require('./moteur/config');
    const { COURS_PATH } = require('./moteur/cours');
    const extraTime = parseInt(req.query.extraTime) || 0;
    const rapport = genererRapportQuotidien(CONFIG_PATH, COURS_PATH, extraTime);
    res.json(rapport);
  } catch (err) {
    console.error("Erreur orchestrateur:", err);
    res.status(500).json({ error: "Erreur génération rapport: " + err.message });
  }
});

// Serve React build
const REACT_BUILD_DIR = path.join(ROOT_DIR, 'interface', 'web', 'dist');
app.use(express.static(REACT_BUILD_DIR));

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(REACT_BUILD_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ELPIS Bridge démarré sur http://0.0.0.0:${PORT}`);
  console.log(`Moteur Node.js natif — plus de dépendance C++ !`);
});
