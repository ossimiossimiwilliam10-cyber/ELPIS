const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { consulter } = require('../moteur/repetiteur');
const { atomicWriteFileSync } = require('../utils/fileUtils');
const { createApiError } = require('../middleware/errorHandler');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const CHAT_FILE = path.join(ROOT_DIR, 'data', 'espoir_chat.json');

/** @type {import('zod').ZodObject<{messages: import('zod').ZodArray<import('zod').ZodObject<{role: import('zod').ZodEnum<['user','assistant','system']>, content: import('zod').ZodString}>>}>} */
const chatMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1, 'Le contenu ne peut pas être vide').max(10000, 'Message trop long (max 10000 caractères)')
  })).min(1, 'Au moins un message requis').max(50, 'Maximum 50 messages par requête')
});

/**
 * GET /api/chat — Récupère l'historique de chat.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get('/', (req, res, next) => {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const data = fs.readFileSync(CHAT_FILE, 'utf-8');
      try {
        const parsed = JSON.parse(data);
        res.json(parsed);
      } catch (parseErr) {
        atomicWriteFileSync(CHAT_FILE, JSON.stringify([]));
        res.json([]);
      }
    } else {
      res.json([]);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat — Envoie un message à l'IA et obtient une réponse.
 * Body: { messages: [{ role: 'user'|'assistant'|'system', content: string }] }
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post('/', async (req, res, next) => {
  try {
    // Validation Zod
    const parseResult = chatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Données invalides',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors
      });
    }

    const { messages } = parseResult.data;

    /*
     * Réponse calculée localement, sur les vraies tables.
     *
     * L'appel distant joignait un contexte lu dans `data/espoir_cours.json` et
     * `data/espoir_historique.json` — deux fichiers disparus lors du passage à
     * SQLite. Il transmettait donc un cursus vide et un historique vide : le
     * modèle ne connaissait que le règlement de la licence, et rien de
     * l'étudiant. Chaque réponse était une conversation générique, facturée à
     * l’appel, sur des données inexistantes.
     *
     * Le Répétiteur lit les tables réelles. Sur les questions qui portent sur
     * les données — programme du jour, retards, moyennes, avancement, épreuves,
     * absences — il ne peut pas inventer un chiffre, et il dispose toujours de
     * l'état courant. Sur le règlement, il cite le texte sans le commenter. Sur
     * le reste, il dit qu'il ne sait pas.
     */
    const derniere = [...messages].reverse().find(m => m.role === 'user');
    const reponse = consulter(derniere?.content || '');

    const finalMessages = [...messages, { role: 'assistant', content: reponse.texte }];
    atomicWriteFileSync(CHAT_FILE, JSON.stringify(finalMessages, null, 2));

    res.json({ content: reponse.texte, intention: reponse.intention, compris: reponse.compris });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chat — Vide l'historique de chat.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete('/', (req, res, next) => {
  try {
    atomicWriteFileSync(CHAT_FILE, JSON.stringify([]));
    res.json({ message: 'Historique vidé' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
