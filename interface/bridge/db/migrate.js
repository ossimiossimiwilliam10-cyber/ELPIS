const fs = require('fs');
const path = require('path');
const { db } = require('./setup');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const COURS_FILE = path.join(DATA_DIR, 'espoir_cours.json');
const HISTORIQUE_FILE = path.join(DATA_DIR, 'espoir_historique.json');
const CONFIG_FILE = path.join(DATA_DIR, 'espoir_config.json');

function migrateConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return;
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  console.log('Migration de la configuration...');
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  
  // We can insert the whole config object as a single 'main' key for simplicity
  // or break it down. For backward compatibility with mongoAdapter and ease of use:
  stmt.run('main', JSON.stringify(config));
}

function migrateHistorique() {
  if (!fs.existsSync(HISTORIQUE_FILE)) return;
  const historique = JSON.parse(fs.readFileSync(HISTORIQUE_FILE, 'utf-8'));
  console.log(`Migration de l'historique (${historique.length} entrées)...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO historique (id, type, titre, matiere, action, timestamp, dureeMinutes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((entries) => {
    for (const entry of entries) {
      stmt.run(
        crypto.randomUUID(),
        entry.type || '',
        entry.titre || null,
        entry.matiere || '',
        entry.action || null,
        entry.timestamp || new Date().toISOString(),
        entry.dureeMinutes || null
      );
    }
  });
  
  insertMany(historique);
}

function migrateCours() {
  if (!fs.existsSync(COURS_FILE)) return;
  const data = JSON.parse(fs.readFileSync(COURS_FILE, 'utf-8'));
  if (!data.licences) return;

  console.log('Migration des cours (JSON vers Relationnel SQLite)...');
  
  const insLicence = db.prepare('INSERT INTO licences (id, nom, archived) VALUES (?, ?, ?)');
  const insSemestre = db.prepare('INSERT INTO semestres (id, nom, archived, dateFin, licence_id) VALUES (?, ?, ?, ?, ?)');
  const insUe = db.prepare('INSERT INTO ues (id, nom, semestre_id) VALUES (?, ?, ?)');
  const insMatiere = db.prepare('INSERT INTO matieres (id, nom, coef, ects, dateExamen, ankiDeckName, ue_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insCm = db.prepare(`
    INSERT INTO cours_cm (id, titre, derniereRevision, prochaineRevisionDate, jActuel, tempsMoyen, fichePdfPath, pdfPath, pdfPaths, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insEx = db.prepare(`
    INSERT INTO exercices (id, type, titre, dernierePratique, dateTP, nombrePratiques, tempsMoyen, tempsMoyenEtapes, pdfPath, pdfPaths, page, difficulte, matiere_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // Nettoyer les tables avant migration complète
    db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences;');

    for (const licence of data.licences) {
      const lid = crypto.randomUUID();
      insLicence.run(lid, licence.nom, licence.archived ? 1 : 0);

      for (const semestre of (licence.semestres || [])) {
        const sid = crypto.randomUUID();
        insSemestre.run(sid, semestre.nom, semestre.archived ? 1 : 0, semestre.dateFin || null, lid);

        for (const ue of (semestre.ues || [])) {
          const uid = crypto.randomUUID();
          insUe.run(uid, ue.nom, sid);

          for (const matiere of (ue.matieres || [])) {
            const mid = crypto.randomUUID();
            insMatiere.run(
              mid,
              matiere.nom,
              matiere.coef || null,
              matiere.ects || null,
              matiere.dateExamen || null,
              matiere.ankiDeckName || null,
              uid
            );

            // CM
            for (const cm of (matiere.listeCM || [])) {
              insCm.run(
                crypto.randomUUID(),
                cm.titre,
                cm.derniereRevision || null,
                cm.prochaineRevisionDate || null,
                cm.jActuel || null,
                cm.tempsMoyen || null,
                cm.fichePdfPath || null,
                cm.pdfPath || null,
                cm.pdfPaths ? JSON.stringify(cm.pdfPaths) : null,
                mid
              );
            }

            // TD
            for (const td of (matiere.listeTD || [])) {
              insEx.run(
                crypto.randomUUID(),
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
                mid
              );
            }

            // TP
            for (const tp of (matiere.listeTP || [])) {
              insEx.run(
                crypto.randomUUID(),
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
                mid
              );
            }

            // ANNALES
            for (const annale of (matiere.listeAnnales || [])) {
              insEx.run(
                crypto.randomUUID(),
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
                mid
              );
            }
          }
        }
      }
    }
  });

  tx();
}

function runMigration() {
  console.log('--- DÉBUT DE LA MIGRATION VERS SQLITE ---');
  // We check if DB is already migrated by checking if licences table has data
  const count = db.prepare('SELECT COUNT(*) as count FROM licences').get();
  if (count.count > 0) {
    console.log('La base de données est déjà migrée (table licences non vide).');
    return;
  }

  migrateConfig();
  migrateHistorique();
  migrateCours();
  console.log('--- MIGRATION TERMINÉE AVEC SUCCÈS ---');
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
