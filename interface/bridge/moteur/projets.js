const { db } = require('../db/setup');
const crypto = require('crypto');

function loadProjets() {
  try {
    const projets = db.prepare('SELECT * FROM projets').all();
    return projets.map(p => ({
      id: p.id,
      nom: p.nom,
      matiere: p.matiere,
      deadline: p.deadline,
      status: p.status,
      progress: p.progress,
      priority: p.priority
    }));
  } catch (e) {
    console.error("Erreur lors du chargement des projets:", e.message);
    return [];
  }
}

function saveProjets(projetsData) {
  if (!Array.isArray(projetsData)) {
    console.error("saveProjets: Données invalides (pas un tableau)");
    return false;
  }

  try {
    const tx = db.transaction((projets) => {
      db.exec('DELETE FROM projets');
      const stmt = db.prepare('INSERT INTO projets (id, nom, matiere, deadline, status, progress, priority) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const p of projets) {
        stmt.run(
          p.id || crypto.randomUUID(),
          p.nom,
          p.matiere || null,
          p.deadline || null,
          p.status || null,
          p.progress || 0,
          p.priority || null
        );
      }
    });
    tx(projetsData);
    return true;
  } catch (e) {
    console.error("Erreur lors de la sauvegarde des projets:", e.message);
    return false;
  }
}

module.exports = {
  loadProjets,
  saveProjets
};
