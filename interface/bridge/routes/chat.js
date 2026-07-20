const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { callDeepSeek } = require('../aiAdapter');
const { atomicWriteFileSync } = require('../utils/fileUtils');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const CHAT_FILE = path.join(ROOT_DIR, 'data', 'espoir_chat.json');

router.get('/', (req, res, next) => {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const data = fs.readFileSync(CHAT_FILE, 'utf-8');
      try {
        const parsed = JSON.parse(data);
        res.json(parsed);
      } catch (parseErr) {
        console.error('Fichier chat corrompu, reset:', parseErr.message);
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

router.post('/', async (req, res, next) => {
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
    next(err);
  }
});

router.delete('/', (req, res, next) => {
  try {
    atomicWriteFileSync(CHAT_FILE, JSON.stringify([]));
    res.json({ message: "Historique vidé" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
