const http = require('http');

/**
 * Timeout pour les requêtes AnkiConnect (ms).
 * Évite de bloquer l'orchestrateur indéfiniment si Anki n'est pas lancé.
 */
const ANKICONNECT_TIMEOUT_MS = 5000;

/**
 * Appelle l'API AnkiConnect locale avec timeout et gestion robuste des erreurs.
 */
function invokeAnkiConnect(action, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, version: 6, params });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8765,
      method: 'POST',
      agent: false,
      timeout: ANKICONNECT_TIMEOUT_MS,
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AnkiConnect timeout: Anki est-il lancé ?'));
    });
    req.on('error', err => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('AnkiConnect inaccessible: Anki n\'est pas lancé.'));
      } else {
        reject(err);
      }
    });
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Découverte des decks
// ---------------------------------------------------------------------------

/**
 * Cache des noms de decks Anki (durée de vie: 5 minutes).
 * Évite d'appeler deckNames à chaque requête orchestrateur.
 */
let _deckNamesCache = null;
let _deckNamesCacheTs = 0;
const DECK_NAMES_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Récupère la liste de tous les noms de decks depuis AnkiConnect.
 * Utilise un cache de 5 minutes pour éviter les appels redondants.
 */
async function fetchDeckNames() {
  const now = Date.now();
  if (_deckNamesCache && (now - _deckNamesCacheTs) < DECK_NAMES_CACHE_TTL_MS) {
    return _deckNamesCache;
  }
  try {
    const names = await invokeAnkiConnect('deckNames');
    _deckNamesCache = names || [];
    _deckNamesCacheTs = now;
    return _deckNamesCache;
  } catch (e) {
    // Si le cache existe, le retourner même expiré en cas d'échec
    if (_deckNamesCache) return _deckNamesCache;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Matching intelligent matière → deck
// ---------------------------------------------------------------------------

/**
 * Trouve le meilleur deck Anki correspondant à une matière.
 *
 * Stratégie (par ordre de priorité) :
 *   1. Mapping explicite : si la matière a un champ `ankiDeckName`, on l'utilise.
 *   2. Match exact (insensible à la casse) parmi les vrais decks.
 *   3. Match par plus long chevauchement : pour éviter "Bio" → "Microbiologie",
 *      on préfère le deck dont le nom contient la matière ET a la plus petite
 *      différence de longueur.
 *   4. Fallback wildcard simple (comportement legacy).
 *
 * @param {string} subjectName - Nom de la matière (ex: "Analyse")
 * @param {string|null} explicitDeckName - Champ ankiDeckName de la matière (si défini)
 * @param {string[]} deckNames - Liste des vrais noms de decks Anki
 * @returns {{ deckName: string|null, matchMethod: string }}
 *   - deckName: le nom exact du deck à utiliser dans les queries, ou null si aucun match
 *   - matchMethod: 'explicit' | 'exact' | 'longest' | 'wildcard' | 'none'
 */
function findBestDeckMatch(subjectName, explicitDeckName, deckNames) {
  // 1. Mapping explicite (overrides tout le reste)
  if (explicitDeckName && explicitDeckName.trim()) {
    // Vérifier que le deck existe vraiment
    const found = deckNames.find(d => d.toLowerCase() === explicitDeckName.trim().toLowerCase());
    if (found) {
      return { deckName: found, matchMethod: 'explicit' };
    }
    // Le deck explicite n'existe pas → on loggue et on continue
    console.warn(`[AnkiSync] Deck explicite "${explicitDeckName}" introuvable pour "${subjectName}".`);
  }

  // 2. Match exact (insensible à la casse)
  const exact = deckNames.find(d => d.toLowerCase() === subjectName.toLowerCase());
  if (exact) {
    return { deckName: exact, matchMethod: 'exact' };
  }

  // 3. Match par dernier segment (ex: "Algèbre" → "...::Algèbre")
  //    Pour les decks hiérarchiques Anki (séparateur ::), on cherche le sujet
  //    comme dernier segment. Évite les collisions comme "Bio" ⊂ "Microbiologie".
  const subjLower = subjectName.toLowerCase();
  const lastSegmentMatch = deckNames
    .filter(d => {
      const segments = d.split('::');
      return segments.length > 0 && segments[segments.length - 1].toLowerCase() === subjLower;
    })
    .sort((a, b) => a.length - b.length);

  if (lastSegmentMatch.length > 0) {
    return { deckName: lastSegmentMatch[0], matchMethod: 'segment' };
  }

  // 4. Match par plus long chevauchement (best-match)
  //    On cherche les decks qui contiennent le nom de la matière et on préfère
  //    le plus court (le plus proche du nom de matière).
  const candidates = deckNames
    .filter(d => d.toLowerCase().includes(subjLower))
    .sort((a, b) => a.length - b.length);

  if (candidates.length > 0) {
    return { deckName: candidates[0], matchMethod: 'longest' };
  }

  // 5. Aucun match trouvé → fallback wildcard (legacy)
  return { deckName: subjectName, matchMethod: 'wildcard' };
}

// ---------------------------------------------------------------------------
// Extraction des matières
// ---------------------------------------------------------------------------

/**
 * Construit la liste des noms de matières depuis les données de cours.
 * Retourne aussi les mappings explicites (ankiDeckName).
 */
function extractSubjectNames(coursData) {
  const subjects = [];
  if (coursData && coursData.licences) {
    coursData.licences.forEach(l => {
      if (l.semestres) {
        l.semestres.forEach(s => {
          if (s.ues) {
            s.ues.forEach(u => {
              if (u.matieres) {
                u.matieres.forEach(m => {
                  if (m.nom) {
                    subjects.push({
                      name: m.nom,
                      ankiDeckName: m.ankiDeckName || null
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  return subjects;
}

// ---------------------------------------------------------------------------
// Sync rétention
// ---------------------------------------------------------------------------

/**
 * Récupère le taux de rétention réel d'Anki (global + par matière).
 *
 * Améliorations v3 :
 *   - Appelle deckNames pour découvrir les vrais decks
 *   - Matching intelligent (explicite > exact > longest > wildcard)
 *   - Rapport des matières non matchées
 *   - Batching des requêtes (max 5 concurrentes)
 *
 * @param {Array<{name: string, ankiDeckName: string|null}>} subjects
 * @param {number} days - Période de rétention en jours (défaut: 365)
 */
async function syncAnkiRetention(subjects = [], days = 365) {
  try {
    // --- 0. Découvrir les vrais decks Anki ---
    let deckNames = [];
    try {
      deckNames = await fetchDeckNames();
    } catch (e) {
      return { success: false, error: e.message, message: "AnkiConnect inaccessible. Lancez Anki pour activer la synchro." };
    }

    // --- 1. Global Stats ---
    const todayCardsQuery = `rated:${days}`;
    const failedCardsQuery = `rated:${days}:1`;

    let allCardsToday;
    try {
      allCardsToday = await invokeAnkiConnect('findCards', { query: todayCardsQuery });
    } catch (e) {
      return { success: false, error: e.message, message: "AnkiConnect inaccessible." };
    }

    if (!allCardsToday || allCardsToday.length === 0) {
      return {
        success: true,
        retentionRate: null,
        totalCards: 0,
        message: "Aucune carte révisée sur cette période.",
        retentionBySubject: {},
        cardsBySubject: {},
        unmatchedSubjects: [],
        deckMappings: []
      };
    }

    const totalCards = allCardsToday.length;
    let failedCards = [];
    try {
      failedCards = await invokeAnkiConnect('findCards', { query: failedCardsQuery });
    } catch (e) {
      console.error("AnkiConnect rated:X:1 error:", e.message);
      return { success: false, error: e.message, message: "AnkiConnect a refusé la requête rated:X:1." };
    }

    const totalFailed = failedCards && failedCards.length ? failedCards.length : 0;
    const retentionRate = totalCards > 0 ? ((totalCards - totalFailed) / totalCards) * 100 : 0;

    // --- 2. Per-Subject Stats ---
    const retentionBySubject = {};
    const cardsBySubject = {};
    const deckMappings = [];     // { subject, matchedDeck, method }
    const unmatchedSubjects = []; // sujets pour lesquels aucun deck n'a été trouvé

    const BATCH_SIZE = 5;
    for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
      const batch = subjects.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (subject) => {
        try {
          const subjectName = typeof subject === 'string' ? subject : subject.name;
          const explicitDeck = typeof subject === 'string' ? null : (subject.ankiDeckName || null);

          // Trouver le meilleur deck
          const match = findBestDeckMatch(subjectName, explicitDeck, deckNames);

          // Construire la query avec le nom exact du deck
          const deckQuery = `rated:${days} deck:"${match.deckName}"`;

          let subjAll = [];
          try {
            subjAll = await invokeAnkiConnect('findCards', { query: deckQuery });
          } catch (_) {
            // Le deck peut ne pas exister ou la query peut échouer
          }

          const subjFailedQuery = `rated:${days}:1 deck:"${match.deckName}"`;
          let subjFailed = [];
          try {
            subjFailed = await invokeAnkiConnect('findCards', { query: subjFailedQuery });
          } catch (_) {
            // Certaines versions d'AnkiConnect ne supportent pas rated:X:Y avec deck
          }

          const sTotal = subjAll && subjAll.length ? subjAll.length : 0;
          const sFailed = subjFailed && subjFailed.length ? subjFailed.length : 0;

          return {
            subject: subjectName,
            matchedDeck: match.deckName,
            matchMethod: match.matchMethod,
            sTotal,
            sFailed,
            isUnmatched: sTotal === 0
          };
        } catch (e) {
          console.error(`AnkiConnect Error for subject ${subject.name || subject}:`, e.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (!result) continue;
        const { subject, matchedDeck, matchMethod, sTotal, sFailed, isUnmatched } = result;

        deckMappings.push({ subject, matchedDeck, matchMethod });

        if (isUnmatched) {
          unmatchedSubjects.push({ subject, matchMethod });
          continue;
        }

        if (sTotal > 0) {
          const sSuccess = sTotal - sFailed;
          retentionBySubject[subject] = (sSuccess / sTotal) * 100;
          cardsBySubject[subject] = sTotal;
        }
      }
    }

    return {
      success: true,
      retentionRate,
      totalCards,
      totalFailed,
      retentionBySubject,
      cardsBySubject,
      unmatchedSubjects,
      deckMappings
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
  invokeAnkiConnect,
  fetchDeckNames,
  findBestDeckMatch,
  extractSubjectNames
};
