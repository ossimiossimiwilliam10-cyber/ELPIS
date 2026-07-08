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

    let totalReviews = 0;
    let failedReviews = 0;
    
    // Batch process to avoid AnkiConnect ECONNRESET on large arrays
    for (let i = 0; i < allCardsToday.length; i += 50) {
      const batch = allCardsToday.slice(i, i + 50);
      const reviews = await invokeAnkiConnect('getReviewsOfCards', { cards: batch });
      
      for (const cardId in reviews) {
        const revs = reviews[cardId];
        const todayMs = Date.now() - 24 * 60 * 60 * 1000;
        const todayRevs = revs.filter(r => r.id > todayMs);
        for (const r of todayRevs) {
          totalReviews++;
          // ease = 1 means Again (failed)
          if (r.ease === 1) failedReviews++;
        }
      }
    }

    if (totalReviews === 0) {
       return { success: true, retentionRate: null, totalCards: 0 };
    }

    const successfulReviews = totalReviews - failedReviews;
    const retentionRate = (successfulReviews / totalReviews) * 100;

    return {
      success: true,
      retentionRate: retentionRate,
      totalCards: totalReviews,
      totalFailed: failedReviews
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
