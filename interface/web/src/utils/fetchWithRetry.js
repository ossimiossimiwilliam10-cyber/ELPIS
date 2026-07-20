/**
 * Wrapper fetch avec retry exponentiel + timeout.
 * Remplace les appels fetch() nus dans store.js et database.js.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {object} [retryConfig]
 * @param {number} [retryConfig.maxRetries=2]   Nombre maximum de tentatives
 * @param {number} [retryConfig.baseDelay=500]   Délai initial en ms (exponentiel : baseDelay * 2^attempt)
 * @param {number} [retryConfig.timeout=15000]   Timeout par requête en ms
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retryConfig = {}) {
  const {
    maxRetries = 2,
    baseDelay = 500,
    timeout = 15000
  } = retryConfig;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Ne pas retry si la requête a été annulée par le timeout
      const isTimeout = error.name === 'AbortError';
      // Ne pas retry si c'est une erreur réseau (offline)
      const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';

      if (attempt < maxRetries && (isTimeout || isNetworkError)) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[fetchWithRetry] Tentative ${attempt + 1}/${maxRetries + 1} échouée (${error.message}), retry dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Version simplifiée pour les appels fire-and-forget (télémétrie, etc.)
 * Ne throw jamais — loggue silencieusement les échecs.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {object} [retryConfig]
 * @returns {Promise<Response|null>}
 */
export async function fetchFireAndForget(url, options = {}, retryConfig = {}) {
  try {
    return await fetchWithRetry(url, options, { maxRetries: 1, baseDelay: 300, timeout: 5000, ...retryConfig });
  } catch (e) {
    console.error(`[FireAndForget] Échec silencieux pour ${url}:`, e.message);
    return null;
  }
}
