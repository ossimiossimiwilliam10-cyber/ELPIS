const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'elpis.sqlite');
const db = new Database(dbPath, { readonly: true });

try {
  const configCount = db.prepare("SELECT COUNT(*) as count FROM user_config").get().count;
  console.log("Config rows:", configCount);

  const coursCount = db.prepare("SELECT COUNT(*) as count FROM user_cours").get().count;
  console.log("Cours rows:", coursCount);

  const lastCours = db.prepare("SELECT data FROM user_cours ORDER BY id DESC LIMIT 1").get();
  if (lastCours && lastCours.data) {
    const data = JSON.parse(lastCours.data);
    console.log("Last cours data preview:");
    console.log("Licences length:", data.licences ? data.licences.length : 0);
  } else {
    console.log("No data found in user_cours");
  }
} catch (e) {
  console.error("DB Error:", e);
}

db.close();
