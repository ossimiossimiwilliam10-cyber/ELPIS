const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'espoir_config.json');

const DEFAULT_CONFIG = {
  studyStartDate: "07-09-2026",
  bedtime: "23:00",
  wakeUpTime: "07:00",
  maxStudyHoursPerDay: 8,
  targetGrade: 14,
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
  defaultDurationNewCM: 120,
  defaultDurationRevCM: 30,
  defaultDurationTD: 20,
  defaultDurationTP: 30
};

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
  
  if (c.theme !== "light" && c.theme !== "dark") c.theme = "dark";
  
  // Ensure arrays
  if (!Array.isArray(c.subjects)) c.subjects = [];
  if (!Array.isArray(c.fixedCommitments)) c.fixedCommitments = [];
  
  return c;
}

function loadConfig(filePath = CONFIG_PATH) {
  try {
    if (!fs.existsSync(filePath)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    // Merge with defaults to fill missing keys
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    return sanitize(merged);
  } catch (err) {
    console.error("Erreur lecture config:", err.message);
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config, filePath = CONFIG_PATH) {
  // Merge with existing config to preserve all fields
  const existing = loadConfig(filePath);
  const merged = { ...existing, ...config };
  const cleaned = sanitize(merged);
  const json = JSON.stringify(cleaned, null, 4);
  const tmpPath = filePath + '.tmp';
  
  try {
    fs.writeFileSync(tmpPath, json, 'utf8');
    // Atomic rename on Windows requires removing target first
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error("Erreur sauvegarde config:", err.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

module.exports = { DEFAULT_CONFIG, sanitize, loadConfig, saveConfig, CONFIG_PATH };
