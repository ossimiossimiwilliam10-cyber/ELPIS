const fs = require('fs');
const path = require('path');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

const TEMP_DIR = path.join(__dirname, 'temp_debug');
const CFG_PATH = path.join(TEMP_DIR, 'espoir_config.json');
const CRS_PATH = path.join(TEMP_DIR, 'espoir_cours.json');
const HIST_PATH = path.join(TEMP_DIR, 'espoir_historique.json');

const getBaseCours = () => ({
  licences: [{
    semestres: [{
      ues: [{
        matieres: [{
          nom: 'Maths',
          coefficient: 3,
          listeCM: [], listeTD: [], listeTP: [], listeAnnales: []
        }]
      }]
    }]
  }]
});

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
fs.writeFileSync(HIST_PATH, '[]');
fs.writeFileSync(CFG_PATH, JSON.stringify({ maxStudyHoursPerDay: 8 }));

const crs = getBaseCours();
// We force the date to be 10 days from whatever "today" is according to orchestrateur
// Wait, orchestrateur uses `new Date()`. So we just get `new Date()` + 10.
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 10);
const futureDateStr = futureDate.toISOString().split('T')[0];
crs.licences[0].semestres[0].ues[0].matieres[0].evaluations = [{ date: futureDateStr }]; // ~10 days
crs.licences[0].semestres[0].ues[0].matieres[0].listeAnnales.push({ titre: 'ANN_URGENT', difficulte: 'difficile' });
crs.licences[0].semestres[0].ues[0].matieres[0].listeCM.push({ titre: 'CM_PREP', jActuel: 0 });
crs.licences[0].semestres[0].ues[0].matieres[0].listeTD.push({ titre: 'TD_TARGET', difficulte: 'difficile' });
fs.writeFileSync(CRS_PATH, JSON.stringify(crs));

console.log("Mocked date:", futureDateStr);
const r = genererRapportQuotidien(CFG_PATH, CRS_PATH);
console.log(JSON.stringify(r.tachesDuJour, null, 2));
