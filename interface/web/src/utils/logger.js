/**
 * Logger conditionnel — silencieux en production, verbeux en développement.
 * Remplace les console.log/error/warn disséminés dans le code.
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

const logger = {
  log(...args) {
    if (isDev) console.log(...args);
  },
  warn(...args) {
    if (isDev) console.warn(...args);
  },
  error(...args) {
    // En production, on loggue seulement les erreurs critiques
    // (on pourrait aussi les envoyer à un service de monitoring)
    if (isDev) {
      console.error(...args);
    }
  },
  info(...args) {
    if (isDev) console.info(...args);
  }
};

export default logger;
