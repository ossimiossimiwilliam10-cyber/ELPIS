const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/User/Desktop/ELPIS/data/espoir_cours.json', 'utf8'));

let report = {
    totalCards: 0,
    cardsWithSuccessRates: [],
    averageSuccess: 0,
    chapitresAvecFlashcards: 0,
    totalCours: 0
};

data.licences.forEach(licence => {
    licence.semestres.forEach(semestre => {
        semestre.ues.forEach(ue => {
            ue.matieres.forEach(matiere => {
                if (matiere.listeCM) {
                    report.totalCours += matiere.listeCM.length;
                    matiere.listeCM.forEach(cours => {
                        if (cours.flashcards && cours.flashcards.length > 0) {
                            report.chapitresAvecFlashcards++;
                            report.totalCards += cours.flashcards.length;
                            
                            cours.flashcards.forEach(fc => {
                                if (fc.fsrsCard) {
                                    // Sometimes success rate isn't explicit but we have lapses, reps, stability
                                    // Let's check for any success metric or easeFactor
                                }
                                if (fc.successRate !== undefined) {
                                    report.cardsWithSuccessRates.push(fc.successRate);
                                }
                            });
                        }
                    });
                }
                if (matiere.flashcards && matiere.flashcards.length > 0) {
                     report.totalCards += matiere.flashcards.length;
                     // In case flashcards are at the matiere level
                }
            });
        });
    });
});

if (report.cardsWithSuccessRates.length > 0) {
    report.averageSuccess = report.cardsWithSuccessRates.reduce((a, b) => a + b, 0) / report.cardsWithSuccessRates.length;
}

// Let's also check if there are global flashcards in other properties
let allFCMatch = JSON.stringify(data).match(/"flashcards"\s*:\s*\[/g);
report.flashcardArraysCount = allFCMatch ? allFCMatch.length : 0;

let easeFactors = [];
let fDataStr = JSON.stringify(data);
let easeFactorMatches = fDataStr.match(/"easeFactor":\s*([\d.]+)/g);
if (easeFactorMatches) {
    easeFactorMatches.forEach(match => {
        easeFactors.push(parseFloat(match.split(':')[1]));
    });
    report.avgEaseFactor = easeFactors.reduce((a, b) => a + b, 0) / easeFactors.length;
    report.totalEaseFactors = easeFactors.length;
}

// let's look for any 'taux de réussite' or 'success' keywords
let fsrsCards = fDataStr.match(/"fsrsCard"\s*:/g);
report.totalFSRSCards = fsrsCards ? fsrsCards.length : 0;

let retentionMatches = fDataStr.match(/"retention":\s*([\d.]+)/g);
if (retentionMatches) {
    let ret = retentionMatches.map(m => parseFloat(m.split(':')[1]));
    report.avgRetention = ret.reduce((a, b) => a + b, 0) / ret.length;
}

console.log(JSON.stringify(report, null, 2));
