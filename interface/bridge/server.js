const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Les chemins absolus
const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'espoir_config.json');
const INCOMING_FILE = path.join(__dirname, 'incoming_config.json');
const C_EXECUTABLE = path.join(ROOT_DIR, 'build', 'moteur_config.exe');

const COURS_FILE = path.join(ROOT_DIR, 'espoir_cours.json');
const INCOMING_COURS_FILE = path.join(__dirname, 'incoming_cours.json');
const COURS_EXECUTABLE = path.join(ROOT_DIR, 'build', 'moteur_cours.exe');

const ORCHESTRATEUR_EXECUTABLE = path.join(ROOT_DIR, 'build', 'moteur_principal.exe');

const FICHES_DIR = path.join(ROOT_DIR, 'fiches_revision');
if (!fs.existsSync(FICHES_DIR)) {
    fs.mkdirSync(FICHES_DIR);
}

// Config Multer pour les PDF
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, FICHES_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})
const upload = multer({ storage: storage })

// Servir les fiches publiquement
app.use('/fiches', express.static(FICHES_DIR));

// Route GET : Lire la configuration actuelle
app.get('/api/config', (req, res) => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            // Si le fichier n'existe pas encore, on renvoie un JSON vide. 
            // Lors de la première sauvegarde, le C++ générera les valeurs par défaut !
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la lecture du fichier." });
    }
});

// Route POST : Demander au C++ de mettre à jour la configuration
app.post('/api/config', (req, res) => {
    try {
        // 1. On écrit les nouvelles données dans un fichier temporaire (Le Node.js n'écrit PAS la source de vérité !)
        fs.writeFileSync(INCOMING_FILE, JSON.stringify(req.body, null, 4));

        // 2. On appelle notre exécutable C++ pour qu'il s'occupe de valider et sauvegarder proprement
        const command = `"${C_EXECUTABLE}" --update "${INCOMING_FILE}"`;
        
        exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
            // Nettoyage du fichier temporaire entrant
            if (fs.existsSync(INCOMING_FILE)) fs.unlinkSync(INCOMING_FILE);

            if (error) {
                console.error("Erreur d'exécution du C++ :", stderr);
                return res.status(500).json({ error: "Le Cerveau C++ a rejeté la configuration.", details: stderr });
            }

            console.log("C++ Engine Response:", stdout);
            res.json({ success: true, message: "Configuration mise à jour par le Cerveau C++." });
        });

    } catch (err) {
        res.status(500).json({ error: "Erreur serveur lors de la mise à jour." });
    }
});

// Route GET : Lire les cours actuels
app.get('/api/cours', (req, res) => {
    try {
        if (fs.existsSync(COURS_FILE)) {
            const data = fs.readFileSync(COURS_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ semestres: [] });
        }
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la lecture du fichier des cours." });
    }
});

// Route POST : Mettre à jour les cours
app.post('/api/cours', (req, res) => {
    try {
        fs.writeFileSync(INCOMING_COURS_FILE, JSON.stringify(req.body, null, 4));
        const command = `"${COURS_EXECUTABLE}" --update "${INCOMING_COURS_FILE}"`;
        
        exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
            if (fs.existsSync(INCOMING_COURS_FILE)) fs.unlinkSync(INCOMING_COURS_FILE);

            if (error) {
                console.error("Erreur d'exécution du C++ (Cours) :", stderr);
                return res.status(500).json({ error: "Le Cerveau C++ a rejeté les cours.", details: stderr });
            }

            console.log("C++ Engine Response (Cours):", stdout);
            res.json({ success: true, message: "Cours mis à jour par le Cerveau C++." });
        });

    } catch (err) {
        res.status(500).json({ error: "Erreur serveur lors de la mise à jour des cours." });
    }
});

// Route POST : Upload PDF
app.post('/api/upload-pdf', upload.single('pdfFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Aucun fichier uploadé." });
        }
        // Renvoie l'URL publique pour accéder au PDF
        const fileUrl = `/fiches/${req.file.filename}`;
        res.json({ success: true, url: fileUrl });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de l'upload du fichier." });
    }
});

// Route POST : Scan PDF pour extraire les numéros d'exercices par page
app.post('/api/scan-pdf', upload.single('pdfFile'), async (req, res) => {
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

        await pdfParse(pdfBuffer, { pagerender: render_page });

        let exercises = [];
        pagesText.forEach((pageText, index) => {
            const regex = /(?:exercice|ex|probl[èe]me)\s*([0-9]+)/gi;
            let match;
            while ((match = regex.exec(pageText)) !== null) {
                // Éviter les doublons sur la même page
                if (!exercises.find(e => e.titre.toLowerCase() === match[0].toLowerCase() && e.page === index + 1)) {
                    exercises.push({
                        titre: match[0],
                        page: index + 1,
                        pdfSource: fileUrl,
                        dernierePratique: "",
                        nombrePratiques: 0
                    });
                }
            }
        });

        res.json({ success: true, url: fileUrl, exercises });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors du scan du PDF." });
    }
});

// Route GET : Obtenir les statistiques du Cerveau Principal
app.get('/api/orchestrateur', (req, res) => {
    // Si les fichiers n'existent pas, on renvoie une liste vide
    if (!fs.existsSync(CONFIG_FILE) || !fs.existsSync(COURS_FILE)) {
        return res.json({ statut: "OK", tempsDispoMin: 0, tempsRequisMin: 0, tachesDuJour: [] });
    }

    const command = `"${ORCHESTRATEUR_EXECUTABLE}" "${CONFIG_FILE}" "${COURS_FILE}"`;
    exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
        if (error) {
            console.error(`C++ Engine Error (Principal): ${stderr}`);
            return res.status(500).json({ error: "Erreur lors de l'exécution du Cerveau Principal." });
        }

        console.log(`C++ Engine Response (Principal):\n${stdout}`);
        
        try {
            const lines = stdout.trim().split('\n');
            const jsonStr = lines[lines.length - 1]; // Le dernier output est le JSON
            const result = JSON.parse(jsonStr);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: "Erreur de parsing des données de l'Orchestrateur." });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Le Pont (Bridge) est démarré sur http://localhost:${PORT}`);
});
