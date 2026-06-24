const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * Builds the context payload by reading the ELPIS JSON data files.
 */
function buildAIContext(dataDir) {
  try {
    const configPath = path.join(dataDir, 'espoir_config.json');
    const coursPath = path.join(dataDir, 'espoir_cours.json');
    const histPath = path.join(dataDir, 'espoir_historique.json');

    const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '{}';
    const cours = fs.existsSync(coursPath) ? fs.readFileSync(coursPath, 'utf-8') : '{}';
    const hist = fs.existsSync(histPath) ? fs.readFileSync(histPath, 'utf-8') : '[]';

    return `
=== CONTEXTE DE L'APPLICATION ELPIS ===
[Configuration]
${config}

[Cours (Structure)]
${cours}

[Historique Récents (100 dernières entrées)]
${hist.slice(-15000)} // Limite empirique pour éviter un contexte trop lourd si l'historique est immense.
=======================================
`;
  } catch (err) {
    console.error("Erreur lors de la construction du contexte IA:", err);
    return "Erreur lors du chargement du contexte.";
  }
}

/**
 * Sends a message to the DeepSeek API.
 * @param {Array} messages - The array of previous messages in the conversation format {role, content}.
 * @param {string} dataDir - Path to the data directory to fetch context.
 * @returns {Promise<string>} The AI's response text.
 */
async function callDeepSeek(messages, dataDir) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY est manquant dans le fichier .env');
  }

  const contextStr = buildAIContext(dataDir);

  const systemPrompt = {
    role: "system",
    content: `Tu es le "Coach Virtuel" de l'application ELPIS (un moteur de révision basé sur l'algorithme FSRS).
Ta mission est d'agir comme un mentor bienveillant mais exigeant.
Règles :
1. Tu ne peux pas modifier la configuration, ni débloquer des tâches. Tu es uniquement une interface de "façade".
2. Analyse le contexte fourni pour faire des commentaires pertinents sur la progression de l'étudiant.
3. Garde tes réponses concises et utilise le formatage Markdown.
4. Parle directement à l'étudiant à la 2ème personne du singulier (tu).

${contextStr}
`
  };

  const payloadMessages = [systemPrompt, ...messages];

  try {
    const modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: payloadMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `API Error: ${response.status}`);
    }

    return data.choices[0].message.content;
  } catch (err) {
    console.error("DeepSeek API Error:", err);
    throw err;
  }
}

module.exports = {
  callDeepSeek,
  buildAIContext
};
