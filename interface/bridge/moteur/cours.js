const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const COURS_PATH = path.join(ROOT_DIR, 'espoir_cours.json');

function sanitizeCours(c) {
  if (!c.licences && c.semestres) {
    c.licences = [{ nom: "Licence 1", semestres: c.semestres }];
    delete c.semestres;
  }
  if (!c.licences) c.licences = [];
  // Nettoyer le champ legacy "semestres" au niveau racine s'il persiste
  if (c.semestres) delete c.semestres;
  
  for (const l of c.licences) {
    if (!l.nom) l.nom = "Nouvelle Licence";
    if (!l.semestres) l.semestres = [];
    for (const s of l.semestres) {
      if (!s.ues) s.ues = [];
      for (const ue of s.ues) {
        ue.ects = Math.max(0, Math.min(180, ue.ects ?? 0));
        if (!ue.matieres) ue.matieres = [];
        for (const m of ue.matieres) {
          m.cm_h = Math.max(0, Math.min(500, m.cm_h ?? 0));
          m.td_h = Math.max(0, Math.min(500, m.td_h ?? 0));
          m.tp_h = Math.max(0, Math.min(500, m.tp_h ?? 0));
          
          if (!m.listeCM) m.listeCM = [];
          for (const cm of m.listeCM) {
            cm.jActuel = Math.max(0, Math.min(3000, cm.jActuel ?? 0));
            if (cm.jActuel > 0 && (!cm.derniereRevision || cm.derniereRevision === "")) {
              cm.derniereRevision = new Date().toISOString().split('T')[0];
            }
          }
          
          if (!m.listeTD) m.listeTD = [];
          for (const ex of m.listeTD) {
            ex.page = Math.max(1, Math.min(9999, ex.page ?? 1));
            ex.nombrePratiques = Math.max(0, Math.min(10000, ex.nombrePratiques ?? 0));
          }
          
          if (!m.listeTP) m.listeTP = [];
          for (const ex of m.listeTP) {
            ex.page = Math.max(1, Math.min(9999, ex.page ?? 1));
            ex.nombrePratiques = Math.max(0, Math.min(10000, ex.nombrePratiques ?? 0));
          }
        }
      }
    }
  }
  return c;
}

function loadCours(filePath = COURS_PATH) {
  try {
    if (!fs.existsSync(filePath)) return { licences: [] };
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeCours(parsed);
  } catch (err) {
    console.error("Erreur lecture cours:", err.message);
    return { licences: [] };
  }
}

function saveCours(coursConfig, filePath = COURS_PATH) {
  // Merge with existing to preserve all fields
  const existing = loadCours(filePath);
  const merged = JSON.parse(JSON.stringify({ ...existing, ...coursConfig }));
  const cleaned = sanitizeCours(merged);
  const json = JSON.stringify(cleaned, null, 4);
  const tmpPath = filePath + '.tmp';
  
  try {
    fs.writeFileSync(tmpPath, json, 'utf8');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error("Erreur sauvegarde cours:", err.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

module.exports = { sanitizeCours, loadCours, saveCours, COURS_PATH };
