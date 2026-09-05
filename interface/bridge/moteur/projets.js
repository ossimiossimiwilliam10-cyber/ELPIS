const { db } = require('../db/setup');
const crypto = require('crypto');
const { sourceCourante } = require('./stockage');

function loadProjets() {
  const source = sourceCourante();
  if (source) {
    try {
      const brut = source.lireProjets();
      return Array.isArray(brut) ? brut : [];
    } catch (err) {
      console.error('Erreur lecture projets (source externe):', err.message);
      return [];
    }
  }

  try {
    const projets = db.prepare('SELECT * FROM projets').all();
    return projets.map(p => ({
      id: p.id,
      // `nom` est le nom hérité de la colonne : les lignes anciennes le portent
      // encore, celles écrites depuis portent `titre`.
      titre: p.titre || p.nom,
      dateFin: p.dateFin || p.deadline || null,
      phases: p.phases ? JSON.parse(p.phases) : [],
      matiere: p.matiere,
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

  const source = sourceCourante();
  if (source) {
    try {
      source.ecrireProjets(projetsData);
      return true;
    } catch (err) {
      console.error('Erreur sauvegarde projets (source externe):', err.message);
      return false;
    }
  }

  try {
    const tx = db.transaction((projets) => {
      db.exec('DELETE FROM projets');
      const stmt = db.prepare('INSERT INTO projets (id, nom, titre, dateFin, phases, matiere, deadline, status, progress, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const p of projets) {
        /*
         * La page produit `titre`, `dateFin` et `phases` ; la table attendait
         * `nom` et `deadline`. Aucun projet ne pouvait donc être enregistré :
         * l'insertion échouait sur la contrainte NOT NULL de `nom`, la route
         * renvoyait une erreur 500, et le projet disparaissait au rechargement.
         *
         * `nom` reste alimenté pour honorer la contrainte et rester lisible par
         * l'ancien format ; le titre fait foi.
         */
        const titre = p.titre || p.nom || null;
        stmt.run(
          p.id || crypto.randomUUID(),
          titre,
          titre,
          p.dateFin ?? p.deadline ?? null,
          p.phases ? JSON.stringify(p.phases) : null,
          p.matiere || null,
          p.dateFin ?? p.deadline ?? null,
          p.status || null,
          p.progress ?? 0,
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
