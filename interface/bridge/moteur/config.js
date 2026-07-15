const { db } = require('../db/setup');

const DEFAULT_CONFIG = {
  studyStartDate: "07-09-2026",
  bedtime: "23:00",
  wakeUpTime: "07:00",
  maxStudyHoursPerDay: 8,
  targetGrade: 14,
  targetRank: 10,
  summerStudyHoursCompleted: 0,
  maxSubjectsPerDay: 3,
  studyBlockDurationMinutes: 50,
  activeRecallMinutesPerDay: 30,
  subjects: [],
  fixedCommitments: [],
  theme: "dark",
  pomoWork: 25,
  pomoBreak: 5,
  lastActiveDate: "",
  currentStreak: 0,
  bestStreak: 0,
  defaultDurationNewCM: 120,
  defaultDurationRevCM: 30,
  defaultDurationTD: 20,
  defaultDurationTP: 30,
  defaultDurationAnnales: 60,
  defaultDurationAnki: 30,
  defaultDurationTP_Etape1: 45,
  defaultDurationTP_Etape2: 180,
  defaultDurationTP_Etape3: 90,
  defaultDurationTP_Etape4: 30,
  maxNewCMPerSubjectPerDay: 1,
  maxNewCMPerSemesterPerDay: 3,
  antiEnnuiMultiplier: 2.0,
  restDays: [],
  skippedRestDays: [],
  dernierePratiqueAnki: ""
};

function validateConfigSchema(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('[VALIDATION] Structure config invalide : données nulles ou non-objet.');
    return false;
  }
  const numChecks = [
    ['maxStudyHoursPerDay', 0, 24],
    ['targetGrade', 0, 20],
    ['defaultDurationNewCM', 5, 600],
    ['defaultDurationRevCM', 5, 600],
  ];
  for (const [field, min, max] of numChecks) {
    if (data[field] !== undefined && (typeof data[field] !== 'number' || data[field] < min || data[field] > max)) {
      console.error(`[VALIDATION] Config : champ "${field}" hors plage (${min}-${max}).`);
      return false;
    }
  }
  if (data.subjects !== undefined && !Array.isArray(data.subjects)) {
    console.error('[VALIDATION] Config : "subjects" doit être un tableau.');
    return false;
  }
  if (data.fixedCommitments !== undefined && !Array.isArray(data.fixedCommitments)) {
    console.error('[VALIDATION] Config : "fixedCommitments" doit être un tableau.');
    return false;
  }
  if (data.restDays !== undefined && !Array.isArray(data.restDays)) {
    console.error('[VALIDATION] Config : "restDays" doit être un tableau.');
    return false;
  }
  if (data.skippedRestDays !== undefined && !Array.isArray(data.skippedRestDays)) {
    console.error('[VALIDATION] Config : "skippedRestDays" doit être un tableau.');
    return false;
  }
  return true;
}

function sanitize(c) {
  c.maxStudyHoursPerDay = Math.max(0, Math.min(24, c.maxStudyHoursPerDay ?? 8));
  c.targetGrade = Math.max(0, Math.min(20, c.targetGrade ?? 14));
  c.summerStudyHoursCompleted = Math.max(0, c.summerStudyHoursCompleted ?? 0);
  c.maxSubjectsPerDay = Math.max(1, c.maxSubjectsPerDay ?? 3);
  c.studyBlockDurationMinutes = Math.max(10, Math.min(240, c.studyBlockDurationMinutes ?? 50));
  c.activeRecallMinutesPerDay = Math.max(0, c.activeRecallMinutesPerDay ?? 30);

  c.defaultDurationNewCM = Math.max(5, c.defaultDurationNewCM ?? 120);
  c.defaultDurationRevCM = Math.max(5, c.defaultDurationRevCM ?? 30);
  c.defaultDurationTD = Math.max(5, c.defaultDurationTD ?? 20);
  c.defaultDurationTP = Math.max(5, c.defaultDurationTP ?? 30);
  c.defaultDurationAnnales = Math.max(5, c.defaultDurationAnnales ?? 60);
  c.defaultDurationAnki = Math.max(5, c.defaultDurationAnki ?? 30);
  c.defaultDurationTP_Etape1 = Math.max(5, c.defaultDurationTP_Etape1 ?? 45);
  c.defaultDurationTP_Etape2 = Math.max(5, c.defaultDurationTP_Etape2 ?? 180);
  c.defaultDurationTP_Etape3 = Math.max(5, c.defaultDurationTP_Etape3 ?? 90);
  c.defaultDurationTP_Etape4 = Math.max(5, c.defaultDurationTP_Etape4 ?? 30);
  c.maxNewCMPerSubjectPerDay = Math.max(1, c.maxNewCMPerSubjectPerDay ?? 1);
  c.maxNewCMPerSemesterPerDay = Math.max(1, c.maxNewCMPerSemesterPerDay ?? 3);
  c.antiEnnuiMultiplier = Math.max(1.0, c.antiEnnuiMultiplier ?? 2.0);
  c.pomoWork = Math.max(5, Math.min(120, c.pomoWork ?? 25));
  c.pomoBreak = Math.max(1, Math.min(60, c.pomoBreak ?? 5));
  c.currentStreak = Math.max(0, c.currentStreak ?? 0);
  c.bestStreak = Math.max(0, c.bestStreak ?? 0);

  if (c.theme !== "light" && c.theme !== "dark") c.theme = "dark";

  if (!Array.isArray(c.subjects)) c.subjects = [];
  if (!Array.isArray(c.fixedCommitments)) c.fixedCommitments = [];
  if (!Array.isArray(c.restDays)) c.restDays = [];
  if (!Array.isArray(c.skippedRestDays)) c.skippedRestDays = [];

  return c;
}

function loadConfig() {
  try {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get('main');
    if (!row) return { ...DEFAULT_CONFIG };
    
    const parsed = JSON.parse(row.value);
    if (!validateConfigSchema(parsed)) {
      console.error('[VALIDATION] Base config corrompue — chargement des valeurs par défaut.');
      return { ...DEFAULT_CONFIG };
    }
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    return sanitize(merged);
  } catch (err) {
    console.error("Erreur lecture config:", err.message);
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  try {
    const existing = loadConfig();
    const merged = { ...existing, ...config };
    const cleaned = sanitize(merged);

    if (!validateConfigSchema(cleaned)) {
      console.error("[VALIDATION] Tentative de sauvegarde d'une config invalide annulée.");
      return false;
    }

    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('main', JSON.stringify(cleaned));
    return true;
  } catch (err) {
    console.error('Erreur sauvegarde config (SQLite):', err.message);
    return false;
  }
}

module.exports = {
  DEFAULT_CONFIG,
  validateConfigSchema,
  sanitize,
  loadConfig,
  saveConfig
};
