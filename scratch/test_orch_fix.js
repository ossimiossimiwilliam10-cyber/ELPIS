const path = require('path');
const { loadConfig } = require(path.join(__dirname, '../interface/bridge/moteur/config'));
const { loadCours } = require(path.join(__dirname, '../interface/bridge/moteur/cours'));
const fs = require('fs');

// We simulate the orchestrator logic
const orchestrateurPath = path.join(__dirname, '../interface/bridge/moteur/orchestrateur');
// We need to require it and run it
const { genererRapportQuotidien } = require(orchestrateurPath);

const elpisPath = path.join(__dirname, '..');
(async () => {
    try {
        const rapport = genererRapportQuotidien(path.join(elpisPath, 'data/espoir_config.json'), path.join(elpisPath, 'data/espoir_cours.json'), 1000, false);
        const taches = rapport.tachesDuJour || [];
        console.log("Temps dispo:", rapport.tempsDispoMin);
        console.log("Temps dejà travaillé:", rapport.tempsDejaTravailleMin);
        console.log("Tâches du jour:", taches.map(t => ({ titre: t.titre, matiere: t.matiere, duree: t.dureeMinutes, prio: t.prio })));
        const matieres = new Set(taches.map(t => t.matiere));
        console.log("Matières du jour:", Array.from(matieres));
        
        const ue5 = Array.from(matieres).filter(m => m.toLowerCase().includes('sant'));
        if (ue5.length > 0) {
            console.log("SUCCÈS: Matière de l'UE 5 trouvée dans les tâches du jour !", ue5);
        } else {
            console.log("ÉCHEC: Aucune matière de l'UE 5 trouvée.");
        }
    } catch(e) {
        console.error(e);
    }
})();
