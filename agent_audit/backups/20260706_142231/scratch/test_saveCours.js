const fs = require('fs');
const path = require('path');
const { loadCours, saveCours } = require('../interface/bridge/moteur/cours');

const cours = loadCours();
console.log("Cours loaded. Licences count:", cours.licences ? cours.licences.length : 0);

if (cours.licences && cours.licences.length > 0 && cours.licences[0].semestres && cours.licences[0].semestres.length > 0) {
    const td = cours.licences[0].semestres[0].ues[0].matieres[0].listeTD[0];
    if (td) {
        console.log("Before save:", td.titre, td.dernierePratique);
        td.dernierePratique = "2026-06-23";
        td.nombrePratiques = (td.nombrePratiques || 0) + 1;
        const success = saveCours(cours);
        console.log("Save success:", success);
        const reloaded = loadCours();
        console.log("After save:", reloaded.licences[0].semestres[0].ues[0].matieres[0].listeTD[0].dernierePratique);
    } else {
        console.log("No TD found to modify");
    }
}
