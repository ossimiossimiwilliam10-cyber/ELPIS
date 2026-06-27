const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const { loadConfig, saveConfig } = require('./moteur/config');
const { loadCours, saveCours } = require('./moteur/cours');
const { loadProjets, saveProjets } = require('./moteur/projets');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');
const { initMongo, syncFromMongoToLocal, syncToMongo } = require('./mongoAdapter');
const { callDeepSeek } = require('./aiAdapter');

const app = express();
const PORT = process.env.PORT || 3001;

// Nécessaire pour que express-rate-limit fonctionne derrière le proxy de Render
app.set('trust proxy', 1);

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

// Désactiver le cache du navigateur pour toutes les routes API (Safari iOS PWA fix)
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'espoir_config.json');
const COURS_FILE = path.join(ROOT_DIR, 'data', 'espoir_cours.json');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'data', 'espoir_historique.json');
const CHAT_FILE = path.join(ROOT_DIR, 'data', 'espoir_chat.json');
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
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Données de configuration invalides. Objet attendu." });
    }
    if (req.body.targetGrade !== undefined && typeof req.body.targetGrade !== 'number') {
      return res.status(400).json({ error: "targetGrade doit être un nombre." });
    }
    const success = saveConfig(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde configuration." });
    }
    // MAJ Async sur MongoDB
    syncToMongo('config', req.body).catch(console.error);
    
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
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Données de cours invalides. Objet attendu." });
    }
    if (!Array.isArray(req.body.licences)) {
      return res.status(400).json({ error: "Structure de cours invalide ('licences' doit être un tableau)." });
    }
    const success = saveCours(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde des cours." });
    }
    // MAJ Async sur MongoDB
    syncToMongo('cours', req.body).catch(console.error);
    
    res.json({ success: true, message: "Cours mis à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// GET projets
app.get('/api/projets', (req, res) => {
  try {
    const projets = loadProjets();
    res.json(projets);
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture des projets: " + err.message });
  }
});

// POST projets
app.post('/api/projets', (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Les projets doivent être un tableau." });
    }
    const success = saveProjets(req.body);
    if (!success) {
      return res.status(500).json({ error: "Erreur sauvegarde des projets." });
    }
    // MAJ Async sur MongoDB
    syncToMongo('projets', req.body).catch(console.error);
    
    res.json({ success: true, message: "Projets mis à jour." });
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
  } catch (_err) {
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
    // MAJ Async sur MongoDB
    syncToMongo('historique', trimmed).catch(console.error);
    
    res.json({ success: true, message: "Historique mis à jour." });
  } catch (_err) {
    res.status(500).json({ error: "Erreur sauvegarde historique." });
  }
});

// POST open anki
app.post('/api/open/anki', (req, res) => {
  const { spawn } = require('child_process');
  const pathModule = require('path');
  
  // Non-Windows : chercher dans le PATH
  if (process.platform !== 'win32') {
    const child = spawn('anki', [], { detached: true, stdio: 'ignore' });
    child.on('error', (err) => {
      console.error("Erreur lancement Anki:", err.message);
    });
    child.unref();
    return res.json({ success: true, message: "Anki lancé avec succès." });
  }

  const ankiPaths = [
    pathModule.join(process.env.LOCALAPPDATA || '', 'Programs', 'Anki', 'anki.exe'),
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

app.post('/api/upload/pdf', (req, res, next) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: "Fichier trop volumineux (50 MB maximum)." });
      }
      return res.status(500).json({ error: "Erreur lors de l'upload: " + err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu." });
    }
    const url = `/documents/${req.file.filename}`;
    
    // Scan text in PDF
    let suggestedExercises = [];
    try {
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text;
        const regex = /(?:exercice|exercise|ex|exo|question|q|prob|problem|set)\s*(?:n°|#)?\s*(\d+(?:\.\d+)?)/gi;
        const matches = [...text.matchAll(regex)];
        
        const uniqueTitles = new Set();
        matches.forEach(m => {
           let title = m[0].replace(/\s+/g, ' ').trim();
           // Format like "Exercice 1"
           title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
           uniqueTitles.add(title);
        });
        
        suggestedExercises = Array.from(uniqueTitles);
      }
    } catch (parseErr) {
      console.error("Erreur scan PDF:", parseErr);
    }

    res.json({ success: true, url, suggestedExercises });
  });
});

// POST shutdown — protégé par vérification d'origine
app.post('/api/shutdown', (req, res) => {
  const origin = req.get('origin') || req.get('referer') || '';
  const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${PORT}`];
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  
  if (!isLocalhost && !allowedOrigins.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: "Arrêt non autorisé depuis cette origine." });
  }
  
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
    const histMtime = fs.existsSync(HISTORIQUE_FILE) ? fs.statSync(HISTORIQUE_FILE).mtimeMs : 0;
    const now = Date.now();
    
    // Clé de cache robuste basée sur l'ensemble des paramètres (Audit Improvement)
    const cacheKey = `${configMtime}_${coursMtime}_${histMtime}_${extraTime}_${fillGap}`;
    
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
    }
    
    // Nettoyage périodique des vieilles entrées (tous les appels, pas seulement sur miss)
    for (const [key, entry] of orchestratorCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        orchestratorCache.delete(key);
      }
    }

    res.json(rapport);
  } catch (err) {
    console.error("Erreur orchestrateur:", err);
    res.status(500).json({ error: "Erreur génération rapport: " + err.message });
  }
});

// --- ROUTES IA COACH ---
app.get('/api/chat', (req, res) => {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const data = fs.readFileSync(CHAT_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages requis" });
    }
    
    // Call DeepSeek
    const aiResponseContent = await callDeepSeek(messages, ROOT_DIR);
    
    // Append the AI response to the history
    const finalMessages = [...messages, { role: 'assistant', content: aiResponseContent }];
    
    // Save to disk
    atomicWriteFileSync(CHAT_FILE, JSON.stringify(finalMessages, null, 2));
    
    res.json({ content: aiResponseContent });
  } catch (err) {
    console.error("Erreur DeepSeek:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat', (req, res) => {
  try {
    atomicWriteFileSync(CHAT_FILE, JSON.stringify([]));
    res.json({ message: "Historique vidé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/music', express.static(path.join(ROOT_DIR, 'music')));

app.get('/api/music/recommendation', (req, res) => {
  try {
    const { genererRapportQuotidien } = require('./moteur/orchestrateur');
    const { loadConfig } = require('./moteur/config');
    const { loadCours } = require('./moteur/cours');
    const config = loadConfig();
    const cours = loadCours();
    let historique = [];
    try {
      historique = JSON.parse(fs.readFileSync(HISTORIQUE_FILE, 'utf8') || '[]');
    } catch(e) {}
    
    const rapport = genererRapportQuotidien(config, cours, 0, false, historique);
    const now = new Date();
    const hour = now.getHours();
    
    let category = 'calm';
    if (hour >= 21 || rapport.pendingTasksCount > 5) {
      category = 'motivational';
    } else {
      category = 'calm';
    }

    let musicDir = path.join(ROOT_DIR, 'music', category);
    const getFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a') || f.endsWith('.ogg')) : [];
    
    let files = getFiles(musicDir);
    if (files.length === 0) {
      // Fallback vers l'autre catégorie si l'actuelle est vide
      const fallbackCategory = category === 'calm' ? 'motivational' : 'calm';
      const fallbackDir = path.join(ROOT_DIR, 'music', fallbackCategory);
      files = getFiles(fallbackDir);
      if (files.length > 0) {
        category = fallbackCategory;
      }
    }
    
    if (files.length === 0) {
      return res.json({ url: null, category });
    }
    
    const randomFile = files[Math.floor(Math.random() * files.length)];
    res.json({ url: `/music/${category}/${encodeURIComponent(randomFile)}`, category, title: randomFile.replace(/\.[^/.]+$/, "") });
  } catch (err) {
    console.error("Music API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- Music Upload & Management --
const musicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.body.category;
    if (!['calm', 'motivational'].includes(category)) {
      return cb(new Error("Catégorie invalide"));
    }
    const destDir = path.join(ROOT_DIR, 'music', category);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Garde le nom original de la musique
  }
});
const uploadMusic = multer({
  storage: musicStorage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

app.get('/api/music/list', (req, res) => {
  try {
    const categories = ['calm', 'motivational'];
    const result = {};
    categories.forEach(cat => {
      const dir = path.join(ROOT_DIR, 'music', cat);
      if (fs.existsSync(dir)) {
        result[cat] = fs.readdirSync(dir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a') || f.endsWith('.ogg'));
      } else {
        result[cat] = [];
      }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/music/upload', uploadMusic.array('files', 10), (req, res) => {
  try {
    res.json({ message: "Musiques uploadées avec succès" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/music/:category/:filename', (req, res) => {
  try {
    const { category, filename } = req.params;
    if (!['calm', 'motivational'].includes(category)) return res.status(400).json({ error: "Catégorie invalide" });
    
    // Security to prevent directory traversal
    const safeFilename = path.basename(filename);
    const targetPath = path.join(ROOT_DIR, 'music', category, safeFilename);
    
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      res.json({ message: "Fichier supprimé" });
    } else {
      res.status(404).json({ error: "Fichier introuvable" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
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

async function startServer() {
  // 1. Initialiser MongoDB
  const isMongoEnabled = await initMongo();
  
  // 2. Si MongoDB est actif, télécharger les données AVANT de démarrer le serveur
  if (isMongoEnabled) {
    await syncFromMongoToLocal(CONFIG_FILE, COURS_FILE, HISTORIQUE_FILE);
  }

  // 3. Démarrer le serveur Express
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ELPIS Bridge démarré sur http://0.0.0.0:${PORT}`);
    console.log(`Moteur Node.js natif — plus de dépendance C++ !`);
  });
}

startServer().catch(console.error);
