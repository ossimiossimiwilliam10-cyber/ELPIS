const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Les chemins absolus
const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'espoir_config.json');
const INCOMING_FILE = path.join(__dirname, 'incoming_config.json');
const C_EXECUTABLE = path.join(ROOT_DIR, 'build', 'moteur_config.exe');

// Route GET : Lire la configuration actuelle
app.get('/api/config', (req, res) => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ error: "Fichier de configuration introuvable." });
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

app.listen(PORT, () => {
    console.log(`Le Pont (Bridge) est démarré sur http://localhost:${PORT}`);
});
