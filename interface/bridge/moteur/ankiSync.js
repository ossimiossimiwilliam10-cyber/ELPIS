const http = require('http');

/**
 * Fonction interne pour appeler l'API AnkiConnect locale
 */
function invokeAnkiConnect(action, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, version: 6, params });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8765,
      method: 'POST',
      agent: false,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed.result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Récupère le taux de rétention réel d'Anki pour aujourd'hui (ou globalement)
 * En interrogeant les cartes révisées aujourd'hui.
 */
async function syncAnkiRetention() {
  try {
    // Toutes les cartes révisées aujourd'hui
    const allCardsToday = await invokeAnkiConnect('findCards', { query: 'rated:1' });
    
    if (!allCardsToday || allCardsToday.length === 0) {
      return { success: true, retentionRate: null, totalCards: 0, message: "Aucune carte révisée aujourd'hui." };
    }

    const totalCards = allCardsToday.length;
    let failedCards = [];
    try {
        failedCards = await invokeAnkiConnect('findCards', { query: 'rated:1:1' });
    } catch (e) {
        console.error("AnkiConnect rated:1:1 error: ", e.message);
        return { success: false, error: e.message, message: "AnkiConnect a refusé la requête rated:1:1." };
    }

    const totalFailed = failedCards && failedCards.length ? failedCards.length : 0;
    const successfulReviews = totalCards - totalFailed;
    const retentionRate = totalCards > 0 ? (successfulReviews / totalCards) * 100 : 0;

    return {
      success: true,
      retentionRate: retentionRate,
      totalCards: totalCards,
      totalFailed: totalFailed
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: "AnkiConnect inaccessible ou requête invalide."
    };
  }
}

module.exports = {
  syncAnkiRetention,
  invokeAnkiConnect
};
