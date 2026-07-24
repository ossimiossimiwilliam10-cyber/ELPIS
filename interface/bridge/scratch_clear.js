const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');

try {
  const db = new Database(dbPath);
  
  const delCm = db.prepare('DELETE FROM cours_cm');
  const delEx = db.prepare('DELETE FROM exercices');
  const delProj = db.prepare('DELETE FROM projets');
  
  db.transaction(() => {
    const resCm = delCm.run();
    console.log(`Supprimé ${resCm.changes} lignes de cours_cm.`);
    
    const resEx = delEx.run();
    console.log(`Supprimé ${resEx.changes} lignes d'exercices (TD/TP/Annales).`);
    
    const resProj = delProj.run();
    console.log(`Supprimé ${resProj.changes} lignes de projets.`);
  })();
  
  db.close();
} catch (error) {
  console.error("Erreur lors de la suppression:", error);
}
