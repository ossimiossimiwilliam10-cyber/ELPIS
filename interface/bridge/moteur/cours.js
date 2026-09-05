const { db } = require('../db/setup');
const crypto = require('crypto');
const { sourceCourante } = require('./stockage');

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

/*
 * Le document que détient le téléphone est celui que ce même `loadCours` a
 * produit sur le PC, transporté tel quel par la synchronisation : il est déjà
 * assemblé et déjà normalisé. On le rend donc sans le reconstruire — mais on
 * vérifie sa forme, car un document tronqué ferait passer un cursus vide pour
 * un cursus réel.
 */
function loadCours() {
  const source = sourceCourante();
  if (source) {
    try {
      const brut = source.lireCours();
      if (!brut || !Array.isArray(brut.licences)) return { licences: [] };
      return brut;
    } catch (err) {
      console.error('Erreur lecture cursus (source externe):', err.message);
      return { licences: [] };
    }
  }

  return loadCoursSqlite();
}

function loadCoursSqlite() {
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
        // Un coef NULL en base signifie « non renseigné » : on laisse le champ
        // absent pour que le calcul applique son défaut de 1. Le convertir en
        // 0 exclurait la matière de la moyenne de son UE, alors qu'un
        // coefficient nul est une décision explicite, pas une absence.
        coefficient: m.coef === null || m.coef === undefined ? undefined : m.coef,
        examDates: m.dateExamen ? (m.dateExamen.startsWith('[') ? JSON.parse(m.dateExamen) : [m.dateExamen]) : undefined,
        evaluations: m.evaluations ? JSON.parse(m.evaluations) : undefined,
        synergies: m.synergies ? JSON.parse(m.synergies) : undefined,
        listeCM: [], 
        listeTD: [], 
        listeTP: [], 
        listeAnnales: [] 
      });
      delete matMap[m.ue_id][matMap[m.ue_id].length - 1].coef;
      delete matMap[m.ue_id][matMap[m.ue_id].length - 1].dateExamen;
    }

    const cmMap = {}; // matiere_id -> []
    for (const cm of cms) {
      if (!cmMap[cm.matiere_id]) cmMap[cm.matiere_id] = [];
      cmMap[cm.matiere_id].push({
        ...cm,
        pdfPaths: cm.pdfPaths ? JSON.parse(cm.pdfPaths) : undefined,
        fsrsCard: cm.fsrsCard ? JSON.parse(cm.fsrsCard) : undefined,
        rappels: cm.rappels ? JSON.parse(cm.rappels) : undefined
      });
    }

    const exMap = {}; // matiere_id -> []
    for (const ex of exos) {
      if (!exMap[ex.matiere_id]) exMap[ex.matiere_id] = [];
      exMap[ex.matiere_id].push({
        ...ex,
        tempsMoyenEtapes: ex.tempsMoyenEtapes ? JSON.parse(ex.tempsMoyenEtapes) : undefined,
        nombreRevisionsEtapes: ex.nombreRevisionsEtapes ? JSON.parse(ex.nombreRevisionsEtapes) : undefined,
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

/**
 * Appariement d'un élément entrant avec son homologue existant.
 *
 * L'appariement se faisait par **position** : la matière n°2 du nouveau cursus
 * héritait des données de la matière n°2 de l'ancien, quel que soit son nom.
 * Supprimer une matière faisait donc glisser les notes et l’historique de
 * révision sur les suivantes ; en réordonner deux les échangeait. Une matière
 * remplacée récupérait les notes de celle qui occupait sa place — un bulletin
 * pouvait attribuer des notes à la mauvaise matière sans que rien ne le signale.
 *
 * On apparie donc par identité : l'`id` d'abord, le nom ensuite pour les
 * données anciennes qui n’en portent pas. Sans correspondance, l’élément est
 * neuf et n’hérite de rien.
 */
function apparier(existants, entrant) {
  const liste = Array.isArray(existants) ? existants : [];
  if (!entrant) return {};

  if (entrant.id) {
    const parId = liste.find(e => e && e.id === entrant.id);
    if (parId) return parId;
    // Un identifiant explicite qui ne correspond à rien désigne un élément neuf :
    // se rabattre sur le nom ferait ressurgir le glissement qu’on corrige.
    return {};
  }

  const cle = entrant.nom || entrant.titre;
  if (!cle) return {};
  return liste.find(e => e && (e.nom || e.titre) === cle) || {};
}

/** Fusionne une liste entrante avec l’existante, élément par élément. */
const fusionnerListe = (existants, entrants, fusion) =>
  (entrants || []).map(entrant => fusion(apparier(existants, entrant), entrant));

function deepMergeLicence(existingLicence, newLicence) {
  const merged = { ...existingLicence, ...newLicence };
  if (!newLicence.semestres || !Array.isArray(newLicence.semestres)) {
    merged.semestres = existingLicence.semestres || [];
    return merged;
  }

  merged.semestres = fusionnerListe(existingLicence.semestres, newLicence.semestres, (existingSem, newSem) => {
    const mergedSem = { ...existingSem, ...newSem };
    if (!newSem.ues || !Array.isArray(newSem.ues)) {
      mergedSem.ues = existingSem.ues || [];
      return mergedSem;
    }

    mergedSem.ues = fusionnerListe(existingSem.ues, newSem.ues, (existingUE, newUE) => {
      const mergedUE = { ...existingUE, ...newUE };
      if (!newUE.matieres || !Array.isArray(newUE.matieres)) {
        mergedUE.matieres = existingUE.matieres || [];
        return mergedUE;
      }

      mergedUE.matieres = fusionnerListe(existingUE.matieres, newUE.matieres, (existingMat, newMat) => {
        const mergedMat = { ...existingMat, ...newMat };
        for (const cle of ['listeCM', 'listeTD', 'listeTP', 'listeAnnales']) {
          if (!newMat[cle]) continue;
          mergedMat[cle] = fusionnerListe(existingMat[cle], newMat[cle], (a, b) => ({ ...a, ...b }));
        }
        return mergedMat;
      });
      return mergedUE;
    });
    return mergedSem;
  });
  return merged;
}

/** Toutes les matières d'un cursus, indexées par leur identifiant stable. */
function matieresParId(cursus) {
  const table = new Map();
  for (const l of (cursus?.licences || [])) {
    for (const sem of (l.semestres || [])) {
      for (const ue of (sem.ues || [])) {
        for (const m of (ue.matieres || [])) {
          if (m && m.id && m.nom) table.set(m.id, m.nom);
        }
      }
    }
  }
  return table;
}

/**
 * Les matières renommées entre deux états du cursus.
 *
 * L'historique désigne la matière par son nom, en chaîne, et tous les
 * rapprochements du moteur sont des égalités strictes — la vélocité, le temps
 * travaillé, les projections, le Répétiteur. Renommer une matière, ce qui se
 * fait d'un clic dans sa fiche et sans avertissement, détachait donc tout son
 * passé : trente heures mesurées devenaient zéro — pas « inconnu », zéro —, la
 * date de maîtrise avançait de deux jours, la matière déjà travaillée le matin
 * repassait au rang d'une matière fraîche, et le Répétiteur affichait la même
 * matière deux fois en attribuant l'ancien nom à « un programme antérieur ».
 * Un accent, une majuscule ou une espace finale suffisaient.
 *
 * L'identifiant, lui, ne bouge pas : même `id`, nom différent, c'est un
 * renommage, sans ambiguïté possible.
 */
function renommagesDeMatieres(avant, apres) {
  const ancien = matieresParId(avant);
  const nouveau = matieresParId(apres);

  // Un nom encore porté par une autre matière ne peut pas être déplacé : la
  // migration se fait sur le nom, elle emporterait aussi l'homonyme.
  const nomsConserves = new Map();
  for (const [id, nom] of nouveau) nomsConserves.set(nom, (nomsConserves.get(nom) || 0) + 1);

  const sortie = [];
  for (const [id, nomApres] of nouveau) {
    const nomAvant = ancien.get(id);
    if (!nomAvant || nomAvant === nomApres) continue;
    if (nomsConserves.get(nomAvant)) {
      console.warn(`Renommage ignoré : « ${nomAvant} » reste porté par une autre matière, son historique resterait ambigu.`);
      continue;
    }
    sortie.push({ ancien: nomAvant, nouveau: nomApres });
  }
  return sortie;
}

function saveCours(coursConfig) {
  const source = sourceCourante();
  if (source) {
    try {
      if (!coursConfig || !Array.isArray(coursConfig.licences)) return false;
      const renommages = renommagesDeMatieres(loadCours(), coursConfig);
      source.ecrireCours(coursConfig);
      if (renommages.length > 0) {
        const table = new Map(renommages.map(r => [r.ancien, r.nouveau]));
        const journal = source.lireHistorique() || [];
        let deplacees = 0;
        const migre = journal.map(h => {
          const cible = h && table.get(h.matiere);
          if (!cible) return h;
          deplacees++;
          return { ...h, matiere: cible };
        });
        if (deplacees > 0) {
          source.ecrireHistorique(migre);
          console.info(`Renommage : ${deplacees} entrée(s) d'historique suivies.`);
        }
      }
      return true;
    } catch (err) {
      console.error('Erreur sauvegarde cursus (source externe):', err.message);
      return false;
    }
  }

  return saveCoursSqlite(coursConfig);
}

function saveCoursSqlite(coursConfig) {
  const existing = loadCours();

  if (!coursConfig.licences || !Array.isArray(coursConfig.licences)) {
    return false;
  }

  const mergedLicences = coursConfig.licences.map(newLicence =>
    deepMergeLicence(apparier(existing.licences, newLicence), newLicence));
  
  const cleaned = sanitizeCours({ ...coursConfig, licences: mergedLicences });

  if (!validateCoursSchema(cleaned)) {
    return false;
  }

  // WIPE AND INSERT TRANSACTION
  const insLicence = db.prepare('INSERT INTO licences (id, nom, archived) VALUES (?, ?, ?)');
  const insSemestre = db.prepare('INSERT INTO semestres (id, nom, archived, dateFin, licence_id) VALUES (?, ?, ?, ?, ?)');
  const insUe = db.prepare('INSERT INTO ues (id, nom, ects, semestre_id) VALUES (?, ?, ?, ?)');
  const insMatiere = db.prepare('INSERT INTO matieres (id, nom, coef, ects, dateExamen, ankiDeckName, evaluations, notebookLMLink, cm_h, td_h, tp_h, synergies, ue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insCm = db.prepare(`
    INSERT INTO cours_cm (id, titre, dateCM, derniereRevision, prochaineRevisionDate, jActuel, tempsMoyen, fichePdfPath, pdfPath, pdfPaths, fsrsCard, rappels, easeFactor, repetitions, nombreRevisionsTemps, ankiDeck, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insEx = db.prepare(`
    INSERT INTO exercices (id, type, titre, dernierePratique, datePrevue, dateTP, nombrePratiques, tempsMoyen, tempsMoyenEtapes, nombreRevisionsEtapes, pdfPath, pdfPaths, page, difficulte, difficulteInitiale, derniereNote, notes, nombreRevisionsTemps, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const renommages = renommagesDeMatieres(existing, cleaned);
    const majHistorique = db.prepare('UPDATE historique SET matiere = ? WHERE matiere = ?');

    const tx = db.transaction(() => {
      // Dans la transaction : un cursus renommé face à un historique resté à
      // l'ancien nom serait pire que l'échec des deux.
      for (const { ancien, nouveau } of renommages) {
        const info = majHistorique.run(nouveau, ancien);
        if (info.changes > 0) {
          console.info(`Renommage « ${ancien} » → « ${nouveau} » : ${info.changes} entrée(s) d'historique suivies.`);
        }
      }

      db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');

      for (const licence of cleaned.licences) {
        const lid = licence.id || crypto.randomUUID();
        insLicence.run(lid, licence.nom, licence.archived ? 1 : 0);

        for (const semestre of (licence.semestres || [])) {
          const sid = semestre.id || crypto.randomUUID();
          insSemestre.run(sid, semestre.nom, semestre.archived ? 1 : 0, semestre.dateFin || null, lid);

          for (const ue of (semestre.ues || [])) {
            const uid = ue.id || crypto.randomUUID();
            insUe.run(uid, ue.nom, ue.ects || null, sid);

            for (const matiere of (ue.matieres || [])) {
              const mid = matiere.id || crypto.randomUUID();
              insMatiere.run(
                mid,
                matiere.nom,
                // `||` écrasait un coefficient 0 explicite en NULL, le rendant
                // indiscernable du champ non renseigné. `??` le préserve.
                matiere.coefficient ?? matiere.coef ?? null,
                matiere.ects || null,
                matiere.examDates ? JSON.stringify(matiere.examDates) : (matiere.dateExamen || null),
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
                  cm.dateCM || null,
                  cm.derniereRevision || null,
                  cm.prochaineRevisionDate || null,
                  cm.jActuel !== undefined && cm.jActuel !== null ? cm.jActuel : null,
                  cm.tempsMoyen !== undefined && cm.tempsMoyen !== null ? cm.tempsMoyen : null,
                  cm.fichePdfPath || null,
                  cm.pdfPath || null,
                  cm.pdfPaths ? JSON.stringify(cm.pdfPaths) : null,
                  cm.fsrsCard ? JSON.stringify(cm.fsrsCard) : null,
                  cm.rappels && cm.rappels.length ? JSON.stringify(cm.rappels) : null,
                  cm.easeFactor || null,
                  cm.repetitions || null,
                  cm.nombreRevisionsTemps || null,
                  /*
                   * Le paquet Anki d'un chapitre n'était pas enregistré : la
                   * colonne existait, la relecture le rendait, mais l’écriture
                   * l'omettait. Le rattachement fait dans la Bibliothèque
                   * disparaissait donc au premier enregistrement — et avec lui
                   * la seule façon de valider un cours sur une vraie épreuve
                   * plutôt que sur une auto-évaluation, ce que l'application
                   * propose pourtant explicitement.
                   */
                  cm.ankiDeck || null,
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
                  td.datePrevue || null,
                  td.dateTP || null,
                  td.nombrePratiques || null,
                  td.tempsMoyen || null,
                  td.tempsMoyenEtapes ? JSON.stringify(td.tempsMoyenEtapes) : null,
                  td.nombreRevisionsEtapes ? JSON.stringify(td.nombreRevisionsEtapes) : null,
                  td.pdfPath || null,
                  td.pdfPaths ? JSON.stringify(td.pdfPaths) : null,
                  td.page || null,
                  td.difficulte || null,
                  td.difficulteInitiale || null,
                  td.derniereNote || null,
                  td.notes ? JSON.stringify(td.notes) : null,
                  td.nombreRevisionsTemps || null,
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
                  tp.datePrevue || null,
                  tp.dateTP || null,
                  tp.nombrePratiques || null,
                  tp.tempsMoyen || null,
                  tp.tempsMoyenEtapes ? JSON.stringify(tp.tempsMoyenEtapes) : null,
                  tp.nombreRevisionsEtapes ? JSON.stringify(tp.nombreRevisionsEtapes) : null,
                  tp.pdfPath || null,
                  tp.pdfPaths ? JSON.stringify(tp.pdfPaths) : null,
                  tp.page || null,
                  tp.difficulte || null,
                  tp.difficulteInitiale || null,
                  tp.derniereNote || null,
                  tp.notes ? JSON.stringify(tp.notes) : null,
                  tp.nombreRevisionsTemps || null,
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
                  annale.datePrevue || null,
                  annale.dateTP || null,
                  annale.nombrePratiques || null,
                  annale.tempsMoyen || null,
                  annale.tempsMoyenEtapes ? JSON.stringify(annale.tempsMoyenEtapes) : null,
                  annale.nombreRevisionsEtapes ? JSON.stringify(annale.nombreRevisionsEtapes) : null,
                  annale.pdfPath || null,
                  annale.pdfPaths ? JSON.stringify(annale.pdfPaths) : null,
                  annale.page || null,
                  annale.difficulte || null,
                  annale.difficulteInitiale || null,
                  annale.derniereNote || null,
                  annale.notes ? JSON.stringify(annale.notes) : null,
                  annale.nombreRevisionsTemps || null,
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