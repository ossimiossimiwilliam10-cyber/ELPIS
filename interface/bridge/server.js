const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { logger } = require('./utils/logger');
// Initialisations & Adapters
const { startPythonAuditAgent } = require('./services/auditAgent');
const globalErrorHandler = require('./middleware/errorHandler');

// Configuration
const app = express();
const PORT = process.env.PORT || 3001;
const ROOT_DIR = path.join(__dirname, '..', '..');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const DOCUMENTS_DIR = path.join(ROOT_DIR, 'documents');

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION:', reason);
});

// Middleware: Proxy (for Render or similar)
app.set('trust proxy', 1);

// Middleware: Sécurité (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      mediaSrc: ["'self'", "data:", "blob:"]
    }
  }
}));

// Middleware: CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${PORT}`, 'http://localhost', 'capacitor://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// Middleware: Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware: Basic Auth (Production Secure Area)
if (process.env.ADMIN_PASSWORD) {
  const basicAuth = require('express-basic-auth');
  app.use(basicAuth({
    users: { 'admin': process.env.ADMIN_PASSWORD },
    challenge: true,
    realm: 'ELPIS Secure Area'
  }));
}

// Middleware: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Middleware: Rate Limiting strict pour l'API chat (coûteuse en tokens IA)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                    // 10 requêtes par minute
  message: { error: "Trop de requêtes sur /api/chat. Attendez avant de réessayer." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/chat', chatLimiter);

// Middleware: Désactiver le cache API (Safari iOS PWA fix)
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// --- Backup automatique au démarrage ---
function performStartupBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    
    const now = new Date();
    now.setHours(now.getHours() - 4);
    const today = now.toISOString().split('T')[0];
    const { DB_PATH } = require('./db/setup');

    if (fs.existsSync(DB_PATH)) {
      const dest = path.join(BACKUPS_DIR, `elpis_sqlite_${today}.db`);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(DB_PATH, dest);
        logger.info(`Backup créé : ${dest}`);
      }
    }

    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('elpis_sqlite_'));
    files.sort();
    while (files.length > 5) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUPS_DIR, old));
    }
  } catch (err) {
    logger.error("Erreur backup automatique:", err.message);
  }
}
performStartupBackup();

if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
app.use('/documents', express.static(DOCUMENTS_DIR));
app.use('/music', express.static(path.join(ROOT_DIR, 'music')));

// ===================== ROUTES =====================
app.use('/api/anki', require('./routes/anki'));
app.use('/api/config', require('./routes/config'));
app.use('/api/cours', require('./routes/cours'));
app.use('/api/projets', require('./routes/projets'));
app.use('/api/historique', require('./routes/historique'));
app.use('/api/orchestrateur', require('./routes/orchestrateur'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/music', require('./routes/music'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api', require('./routes/system'));

// --- Healthcheck ---
// Require db at module level to avoid lazy-load failures
let healthDb;
try {
  healthDb = require('./db/setup');
} catch (e) {
  logger.error('Module db/setup non disponible au démarrage:', e.message);
}
app.get('/api/health', (req, res) => {
  logger.info('Healthcheck demandé');
  try {
    if (healthDb?.db) {
      healthDb.db.prepare('SELECT 1').get();
    }
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: healthDb?.db ? 'connected' : 'unavailable',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  } catch (err) {
    logger.error('Healthcheck échec DB:', err.message);
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err.message
    });
  }
});

// --- Serve React Build ---
const REACT_BUILD_DIR = path.join(ROOT_DIR, 'interface', 'web', 'dist');
app.use(express.static(REACT_BUILD_DIR));

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(REACT_BUILD_DIR, 'index.html'));
});

// --- Global Error Handler (Express 5 natively handles async rejection passed to next) ---
app.use(globalErrorHandler);

// ===================== SERVER START =====================
async function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ELPIS Bridge démarré sur http://localhost:${PORT}`);
    logger.info(`Moteur Node.js 100% local (SQLite) — zéro dépendance cloud.`);
    startPythonAuditAgent(ROOT_DIR);
  });
}

startServer().catch(err => {
  logger.error("Erreur critique au démarrage:", err);
});