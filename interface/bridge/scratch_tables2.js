const db = require('better-sqlite3')('../../data/elpis.sqlite');
console.log('cours_cm:', db.prepare("SELECT COUNT(*) as count FROM cours_cm").get().count);
console.log('exercices:', db.prepare("SELECT COUNT(*) as count FROM exercices").get().count);

const sampleEx = db.prepare("SELECT type FROM exercices LIMIT 5").all();
console.log('Sample exercices types:', sampleEx);
