const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.ELPIS_ROOT || path.join(__dirname, '../../../../');
const PROJETS_FILE = path.join(ROOT_DIR, 'espoir_projets.json');

/**
 * Charge les projets personnels depuis le fichier JSON.
 */
function loadProjets() {
  try {
    if (!fs.existsSync(PROJETS_FILE)) {
      return []; // Retourne un tableau vide si le fichier n'existe pas encore
    }
    const raw = fs.readFileSync(PROJETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erreur lors du chargement des projets:", e.message);
    return [];
  }
}

/**
 * Sauvegarde les projets personnels dans le fichier JSON.
 * @param {Array} projets - Le tableau de projets
 */
function saveProjets(projets) {
  try {
    if (!Array.isArray(projets)) {
      console.warn("saveProjets: Données invalides (pas un tableau)");
      return false;
    }
    fs.writeFileSync(PROJETS_FILE, JSON.stringify(projets, null, 2), 'utf8');
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
