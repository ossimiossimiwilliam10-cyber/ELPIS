const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { verbose: console.log });

db.transaction(() => {
  const mat = db.prepare(`SELECT id, dateExamen FROM matieres WHERE nom LIKE '%Architecture des systèmes d''exploitation%'`).get();
  
  if (mat && mat.dateExamen) {
    let dates = JSON.parse(mat.dateExamen);
    const newDates = dates.filter(d => d !== '2026-12-18');
    if (dates.length !== newDates.length) {
      db.prepare(`UPDATE matieres SET dateExamen = ? WHERE id = ?`).run(JSON.stringify(newDates), mat.id);
      console.log(`Removed 2026-12-18 from Architecture des systèmes d'exploitation`);
    }
  }
})();
