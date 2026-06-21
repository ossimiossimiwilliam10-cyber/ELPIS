const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const { loadConfig, saveConfig } = require('./moteur/config');
const { loadCours, saveCours } = require('./moteur/cours');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

const app = express();
const PORT = process.env.PORT || 3001;

// Sécurité : HTTP headers
app.use(helmet());

// Sécurité : CORS restrictif (Vite dev server + soi-même)
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${PORT}`],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());

// Sécurité : Rate Limiting (100 requêtes max par IP toutes les 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'espoir_config.json');
const COURS_FILE = path.join(ROOT_DIR, 'espoir_cours.json');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'espoir_historique.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const DOCUMENTS_DIR = path.join(ROOT_DIR, 'documents');

// --- Atomic file write utility ---
function atomicWriteFileSync(filePath, data) {
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, data, 'utf8');
    // On Windows, renameSync requires the target to not exist
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error(`Erreur écriture atomique ${filePath}:`, err.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

// --- Backup automatique au démarrage (5 jours glissants) ---
function performStartupBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    // Night Owl : cohérent avec le reste de l'application (période de grâce de 4h)
    const now = new Date();
    now.setHours(now.getHours() - 4);
    const today = now.toISOString().split('T')[0];

    const filesToBackup = [
      { src: CONFIG_FILE, name: 'espoir_config' },
      { src: COURS_FILE, name: 'espoir_cours' },
      { src: HISTORIQUE_FILE, name: 'espoir_historique' }
    ];

    for (const { src, name } of filesToBackup) {
      if (!fs.existsSync(src)) continue;
      const dest = path.join(BACKUPS_DIR, `${name}_${today}.json`);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`Backup créé : ${dest}`);
      }
    }

    // Nettoyage : ne garder que les 5 derniers backups par type
    for (const { name } of filesToBackup) {
      const existing = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith(`${name}_`) && f.endsWith('.json'))
        .sort(); // tri chronologique naturel avec les dates ISO
      while (existing.length > 5) {
        const oldest = existing.shift();
        fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
        console.log(`Backup ancien supprimé : ${oldest}`);
      }
    }
  } catch (err) {
    console.error('Erreur backup automatique:', err.message);
  }
}
// Exécuter le backup au démarrage
performStartupBackup();

if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, DOCUMENTS_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
    files: 1
  }
});

// Servir les documents stockés en interne
app.use('/documents', express.static(DOCUMENTS_DIR));

// ===================== ROUTES =====================

// GET current config
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture configuration: " + err.message });
  }
});

// POST update config
app.post('/api/config', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: "Données de configuration invalides." });
    }
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
    res.status(500).json({ error: "Erreur lecture des cours: " + err.message });
  }
});

// POST update courses
app.post('/api/cours', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: "Données de cours invalides." });
    }
    if (!req.body.licences && !req.body.semestres) {
      return res.status(400).json({ error: "Structure de cours invalide (licences ou semestres requis)." });
    }
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
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "L'historique doit être un tableau." });
    }
    // Limit history to 10 000 entries to prevent unbounded growth
    const trimmed = req.body.length > 10000 ? req.body.slice(req.body.length - 10000) : req.body;
    const success = atomicWriteFileSync(HISTORIQUE_FILE, JSON.stringify(trimmed, null, 4));
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde historique." });
    }
    res.json({ success: true, message: "Historique mis à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur sauvegarde historique." });
  }
});

// POST open anki
app.post('/api/open/anki', (req, res) => {
  const { spawn } = require('child_process');
  const pathModule = require('path');
  
  const ankiPaths = [
    pathModule.join(process.env.LOCALAPPDATA, 'Programs', 'Anki', 'anki.exe'),
    pathModule.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Anki', 'anki.exe'),
    pathModule.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Anki', 'anki.exe')
  ];
  
  let validPath = null;
  for (const p of ankiPaths) {
    if (fs.existsSync(p)) {
      validPath = p;
      break;
    }
  }
  
  if (!validPath) {
    return res.status(404).json({ error: "Anki n'est pas installé ou introuvable." });
  }
  
  const child = spawn(validPath, [], {
    detached: true,
    stdio: 'ignore',
  });
  
  child.on('error', (err) => {
    console.error("Erreur lancement Anki:", err.message);
  });
  
  child.unref();
  res.json({ success: true, message: "Anki lancé avec succès." });
});

// POST open file (PDF or other)
app.post('/api/open/file', (req, res) => {
  const { spawn } = require('child_process');
  const filepath = req.body.filepath;
  
  if (!filepath) {
    return res.status(400).json({ error: "Chemin du fichier manquant." });
  }

  // Use spawn with cmd.exe to prevent command injection vulnerabilities
  const child = spawn('cmd.exe', ['/c', 'start', '""', filepath], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  
  child.on('error', (err) => {
    console.error("Erreur ouverture fichier:", err.message);
  });
  
  child.unref();
  res.json({ success: true, message: "Fichier ouvert." });
});

// POST upload pdf
app.post('/api/upload/pdf', (req, res, next) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: "Fichier trop volumineux (50 MB maximum)." });
      }
      return res.status(500).json({ error: "Erreur lors de l'upload: " + err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu." });
    }
    // Renvoie l'URL relative pour accéder au fichier
    res.json({ success: true, url: `/documents/${req.file.filename}` });
  });
});

// POST shutdown
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: "Arrêt du serveur." });
  setTimeout(() => process.exit(0), 1000);
});

// Cache orchestrateur : évite de recalculer à chaque rafraîchissement (10s TTL)
const orchestratorCache = new Map();
const CACHE_TTL_MS = 10_000;

// GET orchestrator report
app.get('/api/orchestrateur', (req, res) => {
  try {
    const { CONFIG_PATH } = require('./moteur/config');
    const { COURS_PATH } = require('./moteur/cours');
    const extraTime = parseInt(req.query.extraTime) || 0;
    const fillGap = req.query.fillGap === 'true';

    const configMtime = fs.existsSync(CONFIG_PATH) ? fs.statSync(CONFIG_PATH).mtimeMs : 0;
    const coursMtime = fs.existsSync(COURS_PATH) ? fs.statSync(COURS_PATH).mtimeMs : 0;
    const now = Date.now();
    
    // Clé de cache robuste basée sur l'ensemble des paramètres (Audit Improvement)
    const cacheKey = `${configMtime}_${coursMtime}_${extraTime}_${fillGap}`;
    
    let cacheEntry = orchestratorCache.get(cacheKey);
    let cacheValid = cacheEntry && (now - cacheEntry.timestamp) < CACHE_TTL_MS;

    const rapport = cacheValid
      ? cacheEntry.rapport
      : genererRapportQuotidien(CONFIG_PATH, COURS_PATH, extraTime, fillGap);

    if (!cacheValid) {
      orchestratorCache.set(cacheKey, {
        rapport,
        timestamp: now
      });
      
      // Nettoyage paresseux des vieilles entrées pour éviter les fuites de mémoire
      for (const [key, entry] of orchestratorCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          orchestratorCache.delete(key);
        }
      }
    }

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

// Sécurité / Robustesse : Global Error Handler
app.use((err, req, res, next) => {
  console.error("Erreur serveur non gérée:", err.stack);
  res.status(500).json({ error: "Une erreur interne est survenue.", details: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ELPIS Bridge démarré sur http://0.0.0.0:${PORT}`);
  console.log(`Moteur Node.js natif — plus de dépendance C++ !`);
});
