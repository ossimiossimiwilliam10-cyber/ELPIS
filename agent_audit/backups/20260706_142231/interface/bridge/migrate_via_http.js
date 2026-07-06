const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'espoir_config.json');
const COURS_FILE = path.join(ROOT_DIR, 'data', 'espoir_cours.json');
const HISTORIQUE_FILE = path.join(ROOT_DIR, 'data', 'espoir_historique.json');

const BASE_URL = 'https://elpis-app.onrender.com/api';

async function uploadFile(endpoint, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} (not found)`);
    return;
  }
  const data = fs.readFileSync(filePath, 'utf8');
  console.log(`Uploading ${filePath} to ${endpoint}...`);
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data
  });
  if (!res.ok) {
    throw new Error(`Failed to upload ${endpoint}: ${await res.text()}`);
  }
  console.log(`✅ Success for ${endpoint}`);
}

async function migrate() {
  try {
    await uploadFile('/config', CONFIG_FILE);
    await uploadFile('/cours', COURS_FILE);
    await uploadFile('/historique', HISTORIQUE_FILE);
    console.log("🎉 Migration HTTP terminée avec succès !");
  } catch (err) {
    console.error("❌ Erreur:", err);
  }
}

migrate();
