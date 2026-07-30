const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const multer = require('multer');
const { genererRapportQuotidien } = require('../moteur/orchestrateur');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');

// -- Music Upload & Management --
const musicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.body.category;
    if (!['calm', 'motivational'].includes(category)) {
      return cb(new Error("Catégorie invalide"));
    }
    const tmpDir = path.join(os.tmpdir(), 'elpis_music_tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'tmp_' + Date.now() + '_' + Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const uploadMusic = multer({
  storage: musicStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max pour les grosses OSTs
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error("Format de fichier invalide, audio attendu."));
    }
    cb(null, true);
  }
});

router.get('/recommendation', (req, res, next) => {
  try {
    const rapport = genererRapportQuotidien(0, false);
    const now = new Date();
    const hour = now.getHours();

    let category = 'calm';
    if (req.query.category && ['calm', 'motivational'].includes(req.query.category)) {
      category = req.query.category;
    } else {
      if (hour >= 21 || (rapport.tachesDuJour?.length || 0) > 5) {
        category = 'motivational';
      } else {
        category = 'calm';
      }
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
    next(err);
  }
});

router.get('/list', (req, res, next) => {
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
    next(err);
  }
});

const calculateMD5 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

router.post('/upload', uploadMusic.array('files', 10), async (req, res, next) => {
  try {
    const category = req.body.category;
    const destDir = path.join(ROOT_DIR, 'music', category);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const hashesFile = path.join(ROOT_DIR, 'music', 'music_hashes.json');
    let hashes = {};
    if (fs.existsSync(hashesFile)) {
      hashes = JSON.parse(fs.readFileSync(hashesFile, 'utf8'));
    }

    const imported = [];
    const ignored = [];

    if (req.files) {
      for (const file of req.files) {
        let nameConflict = false;
        const categories = ['calm', 'motivational'];
        for (const cat of categories) {
          if (fs.existsSync(path.join(ROOT_DIR, 'music', cat, file.originalname))) {
            nameConflict = true;
            break;
          }
        }

        if (nameConflict) {
          ignored.push(file.originalname);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          continue;
        }

        const hex = await calculateMD5(file.path);

        if (hashes[hex]) {
          ignored.push(file.originalname);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } else {
          const finalPath = path.join(destDir, file.originalname);
          try {
            fs.renameSync(file.path, finalPath);
          } catch(e) {
            fs.copyFileSync(file.path, finalPath);
            fs.unlinkSync(file.path);
          }
          hashes[hex] = category + '/' + file.originalname;
          imported.push(file.originalname);
        }
      }
    }

    fs.writeFileSync(hashesFile, JSON.stringify(hashes, null, 2));

    let msg = `${imported.length} musique(s) importée(s).`;
    if (ignored.length > 0) {
      msg += ` ${ignored.length} doublon(s) ignoré(s) (contenu identique).`;
    }

    res.json({ message: msg, imported, ignored });
  } catch (err) {
    if (req.files) {
      req.files.forEach(f => {
        if(fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    next(err);
  }
});

router.delete('/:category/:filename', (req, res, next) => {
  try {
    const { category, filename } = req.params;
    if (!['calm', 'motivational'].includes(category)) {
      return res.status(400).json({ error: "Catégorie invalide" });
    }

    const safeFilename = path.basename(filename);
    const targetPath = path.join(ROOT_DIR, 'music', category, safeFilename);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      res.json({ message: "Fichier supprimé" });
    } else {
      res.status(404).json({ error: "Fichier introuvable" });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
