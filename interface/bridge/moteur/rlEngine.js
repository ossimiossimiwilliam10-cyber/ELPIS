/**
 * RL ENGINE v1 — Moteur de Reinforcement Learning (Bandits Manchots / UCB)
 *
 * Ce module implémente l'algorithme Upper Confidence Bound (UCB) pour optimiser
 * le choix des matières à étudier. La "récompense" est la variation positive de
 * la note projetée (Bayésienne) après une session d'étude.
 */

const fs = require('fs');
const path = require('path');

// Chemin par défaut du fichier de télémétrie RL
const DEFAULT_RL_FILE = path.join(__dirname, '..', '..', 'data', 'espoir_telemetry_rl.json');

/**
 * Charge l'état actuel du modèle RL depuis le disque.
 * @param {string} filePath - Chemin vers le fichier JSON (optionnel)
 * @returns {Object} - État RL { totalTrials: 0, subjects: { "maths": { qValue: 0, trials: 0 } } }
 */
function loadRLState(filePath = DEFAULT_RL_FILE) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const state = JSON.parse(data);
      if (state && state.subjects) {
        return state;
      }
    }
  } catch (error) {
    console.warn("[RL] Erreur lors du chargement de l'état RL :", error.message);
  }
  // État par défaut
  return {
    totalTrials: 0,
    subjects: {}
  };
}

/**
 * Sauvegarde l'état du modèle RL sur le disque.
 * @param {Object} state - État RL à sauvegarder
 * @param {string} filePath - Chemin vers le fichier JSON (optionnel)
 */
function saveRLState(state, filePath = DEFAULT_RL_FILE) {
  try {
    // S'assurer que le dossier existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error("[RL] Erreur lors de la sauvegarde de l'état RL :", error.message);
  }
}

/**
 * Calcule le score UCB (Upper Confidence Bound) pour une matière.
 * Formule : UCB = Q + C * sqrt(ln(N) / n)
 * 
 * @param {string} matiereNom - Nom de la matière (sera normalisé en lowercase)
 * @param {Object} rlState - L'état du modèle (retourné par loadRLState)
 * @param {number} c - Paramètre d'exploration (par défaut Math.SQRT2)
 * @returns {number} Score UCB (typiquement entre 0 et 2, mais peut dépendre des récompenses)
 */
function calculateUCBScore(matiereNom, rlState, c = Math.SQRT2) {
  if (!matiereNom || !rlState || !rlState.subjects) return 1.0;
  
  const key = matiereNom.toLowerCase().trim();
  const N = Math.max(1, rlState.totalTrials); // Total global des essais (pour éviter log(0))
  
  const subjData = rlState.subjects[key];
  if (!subjData || subjData.trials === 0) {
    // Si la matière n'a jamais été testée, on retourne une valeur infinie
    // pour forcer l'exploration (ou un score artificiellement très haut)
    return 1000.0; 
  }
  
  const qValue = subjData.qValue;
  const n = subjData.trials;
  
  // Terme d'exploration : croît si N croît alors que n reste faible
  const explorationTerm = c * Math.sqrt(Math.log(N) / n);
  
  return qValue + explorationTerm;
}

/**
 * Met à jour la Q-Value (récompense moyenne) d'une matière suite à une session d'étude.
 * 
 * @param {string} matiereNom - Nom de la matière étudiée
 * @param {Object} rlState - État actuel du modèle RL (sera muté en place)
 * @param {number} reward - Récompense obtenue (ex: delta de la note projetée, comme +0.2)
 * @returns {Object} - Le nouvel état RL
 */
function updateQValues(matiereNom, rlState, reward) {
  if (!matiereNom || !rlState) return rlState;
  
  const key = matiereNom.toLowerCase().trim();
  
  if (!rlState.subjects) {
    rlState.subjects = {};
  }
  
  if (!rlState.subjects[key]) {
    rlState.subjects[key] = { qValue: 0, trials: 0 };
  }
  
  const subj = rlState.subjects[key];
  
  // Formule de mise à jour incrémentale de la moyenne
  // Q(n+1) = Q(n) + (R - Q(n)) / (n + 1)
  const newTrials = subj.trials + 1;
  const newQ = subj.qValue + (reward - subj.qValue) / newTrials;
  
  rlState.subjects[key].trials = newTrials;
  rlState.subjects[key].qValue = newQ;
  rlState.totalTrials = (rlState.totalTrials || 0) + 1;
  
  return rlState;
}

/**
 * Calcule le multiplicateur RL à appliquer au scoring de l'orchestrateur.
 * 
 * @param {string} matiereNom - Nom de la matière
 * @param {Object} rlState - L'état du modèle
 * @returns {number} Un multiplicateur (ex: entre 1.0 et 2.0) lissé pour ne pas écraser les autres règles.
 */
function getRLMultiplier(matiereNom, rlState) {
  const ucb = calculateUCBScore(matiereNom, rlState);
  
  // Si c'est une nouvelle matière, on donne un boost d'exploration fixe modéré
  if (ucb > 100) return 1.3; 
  
  // Lissage : on transforme le score UCB brut (qui peut être négatif ou élevé)
  // en un multiplicateur compris entre ~0.8 et ~2.5.
  let boost = 1.0 + (ucb * 0.5); // Heuristique simple
  
  // Limites strictes
  return Math.max(0.8, Math.min(2.5, boost));
}

module.exports = {
  loadRLState,
  saveRLState,
  calculateUCBScore,
  updateQValues,
  getRLMultiplier,
  DEFAULT_RL_FILE
};
