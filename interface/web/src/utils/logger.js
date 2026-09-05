/**
 * Journal de l'interface.
 *
 * Les messages de mise au point ne servent qu'au développement et n'ont rien à
 * faire dans la console d'un appareil en service. Les erreurs, elles, sont le
 * contraire : c'est en production qu'on en a besoin.
 *
 * Ce fichier les taisait toutes. Une application qui avale ses propres erreurs
 * n'est pas diagnosticable, et cela s'est payé : le rapport du téléphone
 * tombait sur « object is not extensible », l'écran affichait un cursus vide,
 * et rien nulle part ne le disait — il a fallu plusieurs cycles de compilation
 * pour retrouver la cause d'une exception qui s'annonçait pourtant elle-même.
 *
 * `error` parle donc toujours. Le reste reste silencieux hors développement.
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
    // Toujours, y compris en production : voir l'en-tête.
    console.error(...args);
  },
  info(...args) {
    if (isDev) console.info(...args);
  }
};

export default logger;
