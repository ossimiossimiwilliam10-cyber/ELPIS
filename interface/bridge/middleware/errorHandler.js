/**
 * Global Error Handler — Standardisé pour toutes les routes API.
 * Format de réponse cohérent : { error, code, details?, requestId? }
 */

const { logger } = require('../utils/logger');

/**
 * @typedef {object} ApiError
 * @property {string} error - Message d'erreur
 * @property {string} code - Code d'erreur normalisé
 * @property {unknown} [details] - Détails supplémentaires
 * @property {string} [requestId] - Identifiant unique de la requête
 */

/**
 * @type {Record<string, number>}
 */
const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  AI_SERVICE_ERROR: 502,
  INTERNAL_ERROR: 500
};

/**
 * Middleware global de gestion d'erreurs.
 * Produit une réponse JSON standardisée.
 *
 * @param {Error & { name?: string, errors?: unknown, code?: string, status?: number }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function globalErrorHandler(err, req, res, _next) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  logger.error(`[${requestId}] ${req.method} ${req.url} — ${err.message}`);
  if (err.stack) {
    logger.error(err.stack);
  }

  // Zod validation errors
  if (err.name === 'ZodError' || err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Données invalides',
      code: 'VALIDATION_ERROR',
      details: err.errors || err.message,
      requestId
    });
    return;
  }

  // AI service errors
  if (err.code === 'AI_SERVICE_ERROR' || err.name === 'DeepSeekError') {
    res.status(502).json({
      error: 'Service IA indisponible',
      code: 'AI_SERVICE_ERROR',
      message: err.message,
      requestId
    });
    return;
  }

  // Rate limiting
  if (err.status === 429 || err.code === 'RATE_LIMITED') {
    res.status(429).json({
      error: 'Trop de requêtes',
      code: 'RATE_LIMITED',
      requestId
    });
    return;
  }

  // Fallback: erreur interne
  const status = err.status || ERROR_STATUS[err.code] || 500;
  res.status(status).json({
    error: 'Erreur serveur interne',
    code: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message,
    requestId
  });
}

/**
 * Helper pour créer une erreur API standardisée.
 * @param {string} message
 * @param {keyof typeof ERROR_STATUS} code
 * @param {number} [httpStatus]
 * @returns {Error & { code: string, status: number }}
 */
function createApiError(message, code = 'INTERNAL_ERROR', httpStatus) {
  const err = /** @type {Error & { code: string, status: number }} */ (new Error(message));
  err.code = code;
  err.status = httpStatus || ERROR_STATUS[code] || 500;
  return err;
}

module.exports = globalErrorHandler;
module.exports.createApiError = createApiError;
module.exports.ERROR_STATUS = ERROR_STATUS;