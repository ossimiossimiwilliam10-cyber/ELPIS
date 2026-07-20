import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes basiques
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Bridge ELPIS Amélioré en ligne.' });
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Bridge démarré sur http://localhost:${PORT}`);
    console.log(`📁 Prêt à gérer les fichiers locaux atomiquement.`);
});
