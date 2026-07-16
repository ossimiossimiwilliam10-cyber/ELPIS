const { db } = require('../db/setup');
const crypto = require('crypto');

function validateCoursSchema(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!Array.isArray(data.licences)) {
    return false;
  }
  return true;
}

function sanitizeCours(c) {
  if (!c.licences && c.semestres) {
    c.licences = [{ nom: "Licence 1", semestres: c.semestres }];
    delete c.semestres;
  }
  if (!c.licences) c.licences = [];
  if (c.semestres) delete c.semestres;
  return c;
}

function loadCours() {
  try {
    const licences = db.prepare('SELECT * FROM licences').all();
    const semestres = db.prepare('SELECT * FROM semestres').all();
    const ues = db.prepare('SELECT * FROM ues').all();
    const matieres = db.prepare('SELECT * FROM matieres').all();
    const cms = db.prepare('SELECT * FROM cours_cm').all();
    const exos = db.prepare('SELECT * FROM exercices').all();

    // Reconstruct the tree
    const data = { licences: [] };
    
    const semMap = {}; // licence_id -> []
    for (const s of semestres) {
      if (!semMap[s.licence_id]) semMap[s.licence_id] = [];
      semMap[s.licence_id].push({ ...s, archived: s.archived === 1, ues: [] });
    }

    const ueMap = {}; // semestre_id -> []
    for (const u of ues) {
      if (!ueMap[u.semestre_id]) ueMap[u.semestre_id] = [];
      ueMap[u.semestre_id].push({ ...u, matieres: [] });
    }

    const matMap = {}; // ue_id -> []
    for (const m of matieres) {
      if (!matMap[m.ue_id]) matMap[m.ue_id] = [];
      matMap[m.ue_id].push({ 
        ...m, 
        evaluations: m.evaluations ? JSON.parse(m.evaluations) : undefined,
        synergies: m.synergies ? JSON.parse(m.synergies) : undefined,
        listeCM: [], 
        listeTD: [], 
        listeTP: [], 
        listeAnnales: [] 
      });
    }

    const cmMap = {}; // matiere_id -> []
    for (const cm of cms) {
      if (!cmMap[cm.matiere_id]) cmMap[cm.matiere_id] = [];
      cmMap[cm.matiere_id].push({
        ...cm,
        pdfPaths: cm.pdfPaths ? JSON.parse(cm.pdfPaths) : undefined,
        fsrsCard: cm.fsrsCard ? JSON.parse(cm.fsrsCard) : undefined
      });
    }

    const exMap = {}; // matiere_id -> []
    for (const ex of exos) {
      if (!exMap[ex.matiere_id]) exMap[ex.matiere_id] = [];
      exMap[ex.matiere_id].push({
        ...ex,
        tempsMoyenEtapes: ex.tempsMoyenEtapes ? JSON.parse(ex.tempsMoyenEtapes) : undefined,
        pdfPaths: ex.pdfPaths ? JSON.parse(ex.pdfPaths) : undefined,
        notes: ex.notes ? JSON.parse(ex.notes) : undefined
      });
    }

    // Assemble Matieres
    for (const ueId in matMap) {
      for (const m of matMap[ueId]) {
        if (cmMap[m.id]) m.listeCM = cmMap[m.id];
        if (exMap[m.id]) {
          m.listeTD = exMap[m.id].filter(e => e.type === 'TD');
          m.listeTP = exMap[m.id].filter(e => e.type === 'TP');
          m.listeAnnales = exMap[m.id].filter(e => e.type === 'ANNALE');
        }
      }
    }

    // Assemble UEs
    for (const semId in ueMap) {
      for (const u of ueMap[semId]) {
        if (matMap[u.id]) u.matieres = matMap[u.id];
      }
    }

    // Assemble Semestres
    for (const licId in semMap) {
      for (const s of semMap[licId]) {
        if (ueMap[s.id]) s.ues = ueMap[s.id];
      }
    }

    // Assemble Licences
    for (const l of licences) {
      const lObj = { ...l, archived: l.archived === 1, semestres: [] };
      if (semMap[l.id]) lObj.semestres = semMap[l.id];
      data.licences.push(lObj);
    }

    return sanitizeCours(data);
  } catch (err) {
    console.error("Erreur lecture cours (SQLite):", err.message);
    return { licences: [] };
  }
}

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
        const mergedMat = { ...existingMat, ...newMat };
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

function saveCours(coursConfig) {
  const existing = loadCours();

  if (!coursConfig.licences || !Array.isArray(coursConfig.licences)) {
    return false;
  }

  const mergedLicences = coursConfig.licences.map((newLicence, li) => {
    const existingLicence = (existing.licences && existing.licences[li]) || {};
    return deepMergeLicence(existingLicence, newLicence);
  });
  
  const cleaned = sanitizeCours({ ...coursConfig, licences: mergedLicences });

  if (!validateCoursSchema(cleaned)) {
    return false;
  }

  // WIPE AND INSERT TRANSACTION
  const insLicence = db.prepare('INSERT INTO licences (id, nom, archived) VALUES (?, ?, ?)');
  const insSemestre = db.prepare('INSERT INTO semestres (id, nom, archived, dateFin, licence_id) VALUES (?, ?, ?, ?, ?)');
  const insUe = db.prepare('INSERT INTO ues (id, nom, semestre_id) VALUES (?, ?, ?)');
  const insMatiere = db.prepare('INSERT INTO matieres (id, nom, coef, ects, dateExamen, ankiDeckName, evaluations, notebookLMLink, cm_h, td_h, tp_h, synergies, ue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insCm = db.prepare(`
    INSERT INTO cours_cm (id, titre, derniereRevision, prochaineRevisionDate, jActuel, tempsMoyen, fichePdfPath, pdfPath, pdfPaths, fsrsCard, easeFactor, repetitions, nombreRevisionsTemps, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insEx = db.prepare(`
    INSERT INTO exercices (id, type, titre, dernierePratique, dateTP, nombrePratiques, tempsMoyen, tempsMoyenEtapes, pdfPath, pdfPaths, page, difficulte, difficulteInitiale, derniereNote, notes, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const tx = db.transaction(() => {
      db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');

      for (const licence of cleaned.licences) {
        const lid = licence.id || crypto.randomUUID();
        insLicence.run(lid, licence.nom, licence.archived ? 1 : 0);

        for (const semestre of (licence.semestres || [])) {
          const sid = semestre.id || crypto.randomUUID();
          insSemestre.run(sid, semestre.nom, semestre.archived ? 1 : 0, semestre.dateFin || null, lid);

          for (const ue of (semestre.ues || [])) {
            const uid = ue.id || crypto.randomUUID();
            insUe.run(uid, ue.nom, sid);

            for (const matiere of (ue.matieres || [])) {
              const mid = matiere.id || crypto.randomUUID();
              insMatiere.run(
                mid,
                matiere.nom,
                matiere.coef || null,
                matiere.ects || null,
                matiere.dateExamen || null,
                matiere.ankiDeckName || null,
                matiere.evaluations ? JSON.stringify(matiere.evaluations) : null,
                matiere.notebookLMLink || null,
                matiere.cm_h || null,
                matiere.td_h || null,
                matiere.tp_h || null,
                matiere.synergies ? JSON.stringify(matiere.synergies) : null,
                uid
              );

              // CM
              for (const cm of (matiere.listeCM || [])) {
                insCm.run(
                  cm.id || crypto.randomUUID(),
                  cm.titre,
                  cm.derniereRevision || null,
                  cm.prochaineRevisionDate || null,
                  cm.jActuel !== undefined && cm.jActuel !== null ? cm.jActuel : null,
                  cm.tempsMoyen !== undefined && cm.tempsMoyen !== null ? cm.tempsMoyen : null,
                  cm.fichePdfPath || null,
                  cm.pdfPath || null,
                  cm.pdfPaths ? JSON.stringify(cm.pdfPaths) : null,
                  cm.fsrsCard ? JSON.stringify(cm.fsrsCard) : null,
                  cm.easeFactor || null,
                  cm.repetitions || null,
                  cm.nombreRevisionsTemps || null,
                  mid
                );
              }

              // TD
              for (const td of (matiere.listeTD || [])) {
                insEx.run(
                  td.id || crypto.randomUUID(),
                  'TD',
                  td.titre,
                  td.dernierePratique || null,
                  td.dateTP || null,
                  td.nombrePratiques || null,
                  td.tempsMoyen || null,
                  td.tempsMoyenEtapes ? JSON.stringify(td.tempsMoyenEtapes) : null,
                  td.pdfPath || null,
                  td.pdfPaths ? JSON.stringify(td.pdfPaths) : null,
                  td.page || null,
                  td.difficulte || null,
                  td.difficulteInitiale || null,
                  td.derniereNote || null,
                  td.notes ? JSON.stringify(td.notes) : null,
                  mid
                );
              }

              // TP
              for (const tp of (matiere.listeTP || [])) {
                insEx.run(
                  tp.id || crypto.randomUUID(),
                  'TP',
                  tp.titre,
                  tp.dernierePratique || null,
                  tp.dateTP || null,
                  tp.nombrePratiques || null,
                  tp.tempsMoyen || null,
                  tp.tempsMoyenEtapes ? JSON.stringify(tp.tempsMoyenEtapes) : null,
                  tp.pdfPath || null,
                  tp.pdfPaths ? JSON.stringify(tp.pdfPaths) : null,
                  tp.page || null,
                  tp.difficulte || null,
                  tp.difficulteInitiale || null,
                  tp.derniereNote || null,
                  tp.notes ? JSON.stringify(tp.notes) : null,
                  mid
                );
              }

              // ANNALES
              for (const annale of (matiere.listeAnnales || [])) {
                insEx.run(
                  annale.id || crypto.randomUUID(),
                  'ANNALE',
                  annale.titre,
                  annale.dernierePratique || null,
                  annale.dateTP || null,
                  annale.nombrePratiques || null,
                  annale.tempsMoyen || null,
                  annale.tempsMoyenEtapes ? JSON.stringify(annale.tempsMoyenEtapes) : null,
                  annale.pdfPath || null,
                  annale.pdfPaths ? JSON.stringify(annale.pdfPaths) : null,
                  annale.page || null,
                  annale.difficulte || null,
                  annale.difficulteInitiale || null,
                  annale.derniereNote || null,
                  annale.notes ? JSON.stringify(annale.notes) : null,
                  mid
                );
              }
            }
          }
        }
      }
    });

    tx();
    return true;
  } catch (err) {
    console.error("Erreur sauvegarde cours (SQLite):", err.message);
    return false;
  }
}

module.exports = {
  loadCours,
  saveCours,
  validateCoursSchema,
  sanitizeCours
};
