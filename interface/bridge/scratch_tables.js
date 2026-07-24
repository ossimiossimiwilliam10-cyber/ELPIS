const db = require('better-sqlite3')('../../data/elpis.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));
