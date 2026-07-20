const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const DOCUMENTS_DIR = path.join(ROOT_DIR, 'documents');
const PORT = process.env.PORT || 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

router.post('/open/anki', (req, res, next) => {
  try {
    if (process.platform !== 'win32') {
      const child = spawn('anki', [], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => {
        console.error("Erreur lancement Anki:", err.message);
      });
      child.unref();
      return res.json({ success: true, message: "Anki lancé avec succès." });
    }

    const ankiPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Anki', 'anki.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Anki', 'anki.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Anki', 'anki.exe')
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
  } catch (err) {
    next(err);
  }
});

router.post('/open/file', (req, res, next) => {
  try {
    const filepath = req.body.filepath;

    if (!filepath) {
      return res.status(400).json({ error: "Chemin du fichier manquant." });
    }

    if (process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: "L'ouverture de fichiers locaux est désactivée en mode sécurisé/production." });
    }

    const resolvedPath = path.resolve(filepath);
    if (!resolvedPath.startsWith(path.resolve(DOCUMENTS_DIR))) {
      return res.status(403).json({ error: "Accès refusé. Le fichier est en dehors du répertoire autorisé." });
    }

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
  } catch (err) {
    next(err);
  }
});

router.post('/upload/pdf', (req, res, next) => {
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

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname);
      const filename = 'doc-' + uniqueSuffix + ext;

      if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
      fs.writeFileSync(path.join(DOCUMENTS_DIR, filename), req.file.buffer);

      const url = `/api/documents/${filename}`;

      let suggestedExercises = [];
      try {
        if (req.file.mimetype === 'application/pdf') {
          const dataBuffer = req.file.buffer;
          const pdfData = await pdfParse(dataBuffer);
          const text = pdfData.text;
          const regex = /(?:exercice|exercise|ex|exo|question|q|prob|problem|problème|partie|sujet|td|tp)\s*(?:n°|n|#)?\s*(\d+(?:\.\d+)?)/gi;
          const matches = [...text.matchAll(regex)];

          const uniqueTitles = new Set();
          matches.forEach(m => {
             let title = m[0].replace(/\s+/g, ' ').trim();
             title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
             uniqueTitles.add(title);
          });

          suggestedExercises = Array.from(uniqueTitles);
        }
      } catch (parseErr) {
        console.error("Erreur scan PDF:", parseErr);
      }

      res.json({ success: true, url, suggestedExercises });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

router.get('/documents/:filename', (req, res, next) => {
  try {
    const filename = req.params.filename;
    const localPath = path.join(DOCUMENTS_DIR, filename);
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    res.status(404).json({ error: "Fichier non trouvé" });
  } catch (err) {
    next(err);
  }
});

router.post('/shutdown', (req, res, next) => {
  try {
    if (process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: "L'arrêt de l'application est désactivé en mode sécurisé/production." });
    }
    const origin = req.get('origin') || req.get('referer') || '';
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${PORT}`];
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:127.0.0.1'].includes(clientIp)
      || clientIp === '::1' || clientIp.startsWith('127.');

    if (!isLocalhost && !allowedOrigins.some(o => origin.startsWith(o))) {
      return res.status(403).json({ error: "Arrêt non autorisé depuis cette origine." });
    }

    res.json({ success: true, message: "Arrêt du serveur." });
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    next(err);
  }
});

router.get('/audit', (req, res, next) => {
  try {
    const AUDIT_FILE = path.join(ROOT_DIR, 'data', 'espoir_audit.json');
    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json({ status: "pending", message: "Aucun audit n'a encore été réalisé." });
    }
    const data = fs.readFileSync(AUDIT_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
