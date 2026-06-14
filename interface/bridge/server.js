const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const { loadConfig, saveConfig } = require('./moteur/config');
const { loadCours, saveCours } = require('./moteur/cours');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const ROOT_DIR = path.join(__dirname, '..', '..');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'espoir_historique.json');
const FICHES_DIR = path.join(ROOT_DIR, 'fiches_revision');

if (!fs.existsSync(FICHES_DIR)) {
  fs.mkdirSync(FICHES_DIR);
}

// Multer config for PDFs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, FICHES_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Seuls les fichiers PDF sont acceptés.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
});

const uploadPdf = (req, res, next) => {
  upload.single('pdfFile')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "Fichier trop volumineux (limite 10 Mo)." });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: "Type de fichier invalide. Seuls les PDF sont acceptés." });
      }
      return res.status(500).json({ error: err.message });
    }
    next();
  });
};

// Serve uploaded files
app.use('/fiches', express.static(FICHES_DIR));

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
  // Use absolute path since it's known
  const ankiPath = process.env.LOCALAPPDATA + '\\Programs\\Anki\\anki.exe';
  
  try {
    const child = spawn(ankiPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref();
    res.json({ success: true, message: "Anki lancé avec succès." });
  } catch (err) {
    res.status(500).json({ error: "Impossible de lancer Anki: " + err.message });
  }
});

// POST shutdown
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: "Arrêt du serveur." });
  setTimeout(() => process.exit(0), 1000);
});

// POST upload PDF
app.post('/api/upload-pdf', uploadPdf, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier uploadé." });
    }
    const fileUrl = `/fiches/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Erreur upload." });
  }
});

// POST scan PDF
app.post('/api/scan-pdf', uploadPdf, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier uploadé." });
    
    const fileUrl = `/fiches/${req.file.filename}`;
    const pdfBuffer = fs.readFileSync(req.file.path);
    
    let pagesText = [];
    const render_page = async function(pageData) {
      let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
      const textContent = await pageData.getTextContent(render_options);
      const text = textContent.items.map(item => item.str).join(' ');
      pagesText.push(text);
      return text;
    };

    const pdfData = await pdfParse(pdfBuffer, { pagerender: render_page });

    let exercises = [];
    pagesText.forEach((pageText, index) => {
      const patterns = [
        /(?:exercice|exercise|ex\.?|exo)[\s.:]*(?:n[°º]|#)?\s*(\d+(?:[.\-]\d+)?)/gi,
        /(?:probl[eè]me|problem|prob|pb)[\s.:]*(?:set)?\s*(\d+(?:[.\-]\d+)?)/gi,
        /(?:question)[\s.:]*(?:n[°º]|#)?\s*(\d+(?:[.\-]\d+)?)/gi
      ];
      
      patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(pageText)) !== null) {
          const titre = match[0].trim().replace(/[\s.:]+$/, '');
          if (!exercises.find(e => e.titre.toLowerCase() === titre.toLowerCase() && e.page === index + 1)) {
            exercises.push({
              titre: titre,
              page: index + 1,
              pdfSource: fileUrl,
              dernierePratique: "",
              nombrePratiques: 0,
              difficulte: "",
              notes: ""
            });
          }
        }
      });
    });

    // Fallback: one exercise per page
    if (exercises.length === 0 && pagesText.length > 0) {
      const pdfName = req.file.originalname.replace(/\.pdf$/i, '');
      for (let i = 0; i < pagesText.length; i++) {
        exercises.push({
          titre: `${pdfName} - Page ${i + 1}`,
          page: i + 1,
          pdfSource: fileUrl,
          dernierePratique: "",
          nombrePratiques: 0,
          difficulte: "",
          notes: ""
        });
      }
    }

    res.json({ success: true, url: fileUrl, exercises, totalPages: pdfData.numpages || pagesText.length });
  } catch (err) {
    console.error("Erreur scan PDF:", err);
    res.status(500).json({ error: "Erreur scan PDF: " + err.message });
  }
});

// GET orchestrator report
app.get('/api/orchestrateur', (req, res) => {
  try {
    const { CONFIG_PATH } = require('./moteur/config');
    const { COURS_PATH } = require('./moteur/cours');
    const rapport = genererRapportQuotidien(CONFIG_PATH, COURS_PATH);
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
