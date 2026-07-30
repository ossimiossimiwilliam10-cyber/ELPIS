/**
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/** @type {Record<LogLevel, number>} */
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/** @type {number} */
const currentLevel = LOG_LEVELS[/** @type {LogLevel} */ (process.env.LOG_LEVEL)] ?? LOG_LEVELS.info;

/**
 * Log un message avec niveau et timestamp ISO.
 * @param {LogLevel} level
 * @param {...unknown} args
 */
function log(level, ...args) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[method](prefix, ...args);
}

/**
 * Logger structuré avec niveaux de sévérité.
 * @type {Record<LogLevel, (...args: unknown[]) => void>}
 */
const logger = {
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args),
};

module.exports = { logger };
