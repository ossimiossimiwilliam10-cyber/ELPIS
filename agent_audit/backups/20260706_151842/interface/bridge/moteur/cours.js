const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const COURS_PATH = path.join(ROOT_DIR, 'data', 'espoir_cours.json');

/**
 * Validation minimale de la structure du fichier cours.
 * Retourne true si la structure est cohérente, false sinon.
 */
function validateCoursSchema(data) {
  if (!data || typeof data !== 'object') {
    console.error('[VALIDATION] Structure cours invalide : données nulles ou non-objet.');
    return false;
  }
  if (!Array.isArray(data.licences)) {
    console.error('[VALIDATION] Structure cours invalide : champ "licences" manquant ou non-tableau.');
    return false;
  }
  for (let li = 0; li < data.licences.length; li++) {
    const l = data.licences[li];
    if (!l || typeof l !== 'object') {
      console.error(`[VALIDATION] Licence[${li}] invalide.`);
      return false;
    }
    if (!Array.isArray(l.semestres)) {
      console.error(`[VALIDATION] Licence[${li}] : "semestres" manquant.`);
      return false;
    }
    for (let si = 0; si < l.semestres.length; si++) {
      const s = l.semestres[si];
      if (!s || typeof s !== 'object' || !Array.isArray(s.ues)) {
        console.error(`[VALIDATION] Licence[${li}].semestres[${si}] : "ues" manquant.`);
        return false;
      }
      for (let ui = 0; ui < s.ues.length; ui++) {
        const u = s.ues[ui];
        if (!u || typeof u !== 'object') {
          console.error(`[VALIDATION] UE[${li}][${si}][${ui}] invalide.`);
          return false;
        }
        if (!Array.isArray(u.matieres)) {
          console.error(`[VALIDATION] UE "${u.nom || '?'}" : "matieres" manquant.`);
          return false;
        }
      }
    }
  }
  return true;
}

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
          m.coefficient = Math.max(1, Math.min(10, m.coefficient ?? 1));
          m.cm_h = Math.max(0, Math.min(500, m.cm_h ?? 0));
          m.td_h = Math.max(0, Math.min(500, m.td_h ?? 0));
          m.tp_h = Math.max(0, Math.min(500, m.tp_h ?? 0));
          
          if (!m.listeCM) m.listeCM = [];
          for (const cm of m.listeCM) {
            cm.jActuel = Math.max(0, Math.min(3000, cm.jActuel ?? 0));
            if (cm.jActuel > 0 && (!cm.derniereRevision || cm.derniereRevision === "")) {
              const d = new Date();
              d.setHours(d.getHours() - 4);
              cm.derniereRevision = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

          if (!m.listeAnnales) m.listeAnnales = [];
          for (const ex of m.listeAnnales) {
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
    if (!validateCoursSchema(parsed)) {
      console.error('[VALIDATION] Fichier cours corrompu — chargement du fallback vide.');
      return { licences: [] };
    }
    return sanitizeCours(parsed);
  } catch (err) {
    console.error("Erreur lecture cours:", err.message);
    return { licences: [] };
  }
}

/**
 * Deep merge une licence du frontend dans l'existant, en préservant
 * les données FSRS et l'historique de pratique sur les exercices.
 */
function deepMergeLicence(existingLicence, newLicence) {
  const merged = { ...existingLicence, ...newLicence };
  if (!newLicence.semestres || !Array.isArray(newLicence.semestres)) {
    merged.semestres = existingLicence.semestres || [];
    return merged;
  }

  merged.semestres = newLicence.semestres.map((newSem, si) => {
    const existingSem = (existingLicence.semestres && existingLicence.semestres[si]) || {};
    const mergedSem = { ...existingSem, ...newSem };
    if (!newSem.ues || !Array.isArray(newSem.ues)) {
      mergedSem.ues = existingSem.ues || [];
      return mergedSem;
    }

    mergedSem.ues = newSem.ues.map((newUE, ui) => {
      const existingUE = (existingSem.ues && existingSem.ues[ui]) || {};
      const mergedUE = { ...existingUE, ...newUE };
      if (!newUE.matieres || !Array.isArray(newUE.matieres)) {
        mergedUE.matieres = existingUE.matieres || [];
        return mergedUE;
      }

      mergedUE.matieres = newUE.matieres.map((newMat, mi) => {
        const existingMat = (existingUE.matieres && existingUE.matieres[mi]) || {};
        // Deep merge: on préserve les propriétés FSRS (fsrsCard, tempsMoyen, etc.)
        // du existant, sauf si le nouveau les écrase explicitement
        const mergedMat = { ...existingMat, ...newMat };
        // Fusion récursive pour les listes d'exercices
        if (newMat.listeCM) {
          mergedMat.listeCM = newMat.listeCM.map((newCM, ci) => {
            const existingCM = (existingMat.listeCM && existingMat.listeCM[ci]) || {};
            return { ...existingCM, ...newCM };
          });
        }
        if (newMat.listeTD) {
          mergedMat.listeTD = newMat.listeTD.map((newTD, ti) => {
            const existingTD = (existingMat.listeTD && existingMat.listeTD[ti]) || {};
            return { ...existingTD, ...newTD };
          });
        }
        if (newMat.listeTP) {
          mergedMat.listeTP = newMat.listeTP.map((newTP, pi) => {
            const existingTP = (existingMat.listeTP && existingMat.listeTP[pi]) || {};
            return { ...existingTP, ...newTP };
          });
        }
        if (newMat.listeAnnales) {
          mergedMat.listeAnnales = newMat.listeAnnales.map((newAnn, ai) => {
            const existingAnn = (existingMat.listeAnnales && existingMat.listeAnnales[ai]) || {};
            return { ...existingAnn, ...newAnn };
          });
        }
        return mergedMat;
      });
      return mergedUE;
    });
    return mergedSem;
  });
  return merged;
}

function saveCours(coursConfig, filePath = COURS_PATH) {
  // Deep merge: fuse au niveau licences/semestres/UEs/matières pour préserver les données
  // que le frontend n'envoie pas (ex: listes d'exercices avec historique FSRS)
  const existing = loadCours(filePath);

  // Si le frontend n'envoie pas de licences, on garde l'existant
  if (!coursConfig.licences || !Array.isArray(coursConfig.licences)) {
    console.error('[VALIDATION] saveCours: "licences" manquant ou invalide. Sauvegarde annulée.');
    return false;
  }

  // Deep merge: pour chaque licence du nouveau payload, fusionner dans l'existant
  const mergedLicences = coursConfig.licences.map((newLicence, li) => {
    const existingLicence = (existing.licences && existing.licences[li]) || {};
    return deepMergeLicence(existingLicence, newLicence);
  });

  const cleaned = sanitizeCours({ licences: mergedLicences });

  // Refuser d'écrire une structure corrompue
  if (!validateCoursSchema(cleaned)) {
    console.error('[VALIDATION] Refus d\'écriture : la structure cours est corrompue. Sauvegarde annulée.');
    return false;
  }

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

module.exports = { validateCoursSchema, sanitizeCours, loadCours, saveCours, COURS_PATH };
