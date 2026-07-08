const { genererRapportQuotidien } = require('./interface/bridge/moteur/orchestrateur');
const path = require('path');

const configPath = path.join(__dirname, 'data', 'espoir_config.json');
const coursPath = path.join(__dirname, 'data', 'espoir_cours.json');

const rapport = genererRapportQuotidien(configPath, coursPath, 0, false);
console.log("Statut:", rapport.statut);
console.log("Temps Dispo (min):", rapport.tempsDispoMin);
console.log("Temps Requis (min):", rapport.tempsRequisMin);
console.log("Tâches:");
rapport.tachesDuJour.forEach(t => {
    console.log(`- [${t.type}] ${t.matiere}: ${t.titre} (Prio: ${t.prio})`);
});
