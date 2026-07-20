const Database = require('better-sqlite3');
const db = new Database('../../data/elpis.sqlite', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables);

if (tables.some(t => t.name === 'store_data')) {
    const config = db.prepare("SELECT * FROM store_data WHERE key = 'config'").get();
    console.log("Has config:", !!config);
    const cours = db.prepare("SELECT * FROM store_data WHERE key = 'cours'").get();
    console.log("Has cours:", !!cours, cours ? cours.value.substring(0, 50) : '');
}
db.close();
