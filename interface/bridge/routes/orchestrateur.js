const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { loadCours } = require('../moteur/cours');
const { genererRapportQuotidien, genererTacheSpecifique } = require('../moteur/orchestrateur');

/** @type {Map<string, {rapport: object, timestamp: number}>} */
const orchestratorCache = new Map();
const CACHE_TTL_MS = 60000;

/** Schéma de validation pour génération de tâche forcée */
const forceTaskSchema = z.object({
  matiere: z.string().min(1).max(200).optional().default('all'),
  type: z.enum(['CM', 'TD', 'TP', 'ANNALE', 'all']).optional().default('all'),
  dureeMin: z.number().int().min(0).max(480).optional().default(0)
});

/**
 * GET /api/orchestrateur — Rapport quotidien de l'orchestrateur.
 * Query params: extraTime (int), fillGap (bool)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get('/', async (req, res, next) => {
  try {
    const extraTime = parseInt(req.query.extraTime) || 0;
    const fillGap = req.query.fillGap === 'true';
    const now = Date.now();

    let ankiStats = null;
    try {
        const coursData = loadCours();
        if (coursData._globalAnkiStats) {
           ankiStats = coursData._globalAnkiStats;
        }
    } catch (err) {
        // Silencieux — pas critique
    }

    const ankiKey = ankiStats?.success ? JSON.stringify(ankiStats.retentionBySubject || {}) : 'none';
    const cacheKey = `${global.dbVersion || 0}_${extraTime}_${fillGap}_${ankiKey}`;

    let cacheEntry = orchestratorCache.get(cacheKey);
    let cacheValid = cacheEntry && (now - cacheEntry.timestamp) < CACHE_TTL_MS;

    const rapport = cacheValid
      ? cacheEntry.rapport
      : genererRapportQuotidien(extraTime, fillGap, ankiStats);

    if (!cacheValid) {
      orchestratorCache.set(cacheKey, { rapport, timestamp: now });
    }

    // Nettoyage périodique des vieilles entrées
    for (const [key, entry] of orchestratorCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        orchestratorCache.delete(key);
      }
    }

    // Assigner les métadonnées globales au rapport final
    if (rapport?.intelligence && ankiStats?.success && ankiStats.retentionRate !== null) {
        rapport.intelligence.fsrs_real_retention = ankiStats.retentionRate;
        rapport.intelligence.fsrs_retention_by_subject = ankiStats.retentionBySubject;
        rapport.intelligence.fsrs_unmatched_subjects = ankiStats.unmatchedSubjects || [];
        rapport.intelligence.fsrs_deck_mappings = ankiStats.deckMappings || [];
    }

    res.json(rapport);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orchestrateur/force-task — Génère une tâche forcée.
 * Body: { matiere?: string, type?: 'CM'|'TD'|'TP'|'ANNALE'|'all', dureeMin?: number }
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post('/force-task', (req, res, next) => {
  try {
    const parseResult = forceTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Données invalides',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors
      });
    }

    const { matiere, type, dureeMin } = parseResult.data;

    const task = genererTacheSpecifique(matiere, type, dureeMin);
    if (!task) {
      return res.status(404).json({
        error: 'Aucune tâche trouvée pour ces critères',
        code: 'NOT_FOUND'
      });
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
