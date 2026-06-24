const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.ELPIS_ROOT || path.join(__dirname, '../../../../');
const PROJETS_FILE = path.join(ROOT_DIR, 'espoir_projets.json');

/**
 * Charge les projets personnels depuis le fichier JSON.
 */
function loadProjets(filePath = PROJETS_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      return []; // Retourne un tableau vide si le fichier n'existe pas encore
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erreur lors du chargement des projets:", e.message);
    return [];
  }
}

/**
 * Sauvegarde les projets personnels dans le fichier JSON.
 */
function saveProjets(projetsData, filePath = PROJETS_FILE) {
  if (!Array.isArray(projetsData)) {
    console.error("saveProjets: Données invalides (pas un tableau)");
    return false;
  }

  try {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(projetsData, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
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
