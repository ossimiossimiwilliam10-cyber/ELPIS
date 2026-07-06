// Fix: replace forecastDaysToExam (non-existent field) with constant 30
const fs = require('fs');
const filePath = 'interface/bridge/moteur/intelligence.js';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find line with forecastDaysToExam
let fixed = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('forecastDaysToExam')) {
    // Replace this line and surrounding lines
    // Line before: "const v = velocityMap ? ..."
    // This line: "const daysToExam = v ? (v.forecastDaysToExam || 30) : 30;"
    // Next line: "if (trendSignificant) {"
    // Next+1: comment about MSE
    // Next+2: "projected += trend * Math.min(daysToExam, 30) * 0.5;"

    // Fix line i-1 (comment): "Projection de tendance (sur 30 jours max)" → "Projection de tendance (fenêtre glissante de 30 jours)"
    lines[i-1] = lines[i-1].replace('(sur 30 jours max)', '(fenêtre glissante de 30 jours)');
    // Remove line i-0.5 (const v = velocityMap...)
    // Fix line i: change to const trendWindowDays = 30;
    lines[i] = lines[i].replace(/const daysToExam = v \? \(v\.forecastDaysToExam \|\| 30\) : 30;/, '          const trendWindowDays = 30;');
    // Fix line i+2 (comment): remove "Impact de la tendance..."
    lines[i+2] = lines[i+2].replace(/\/\/ Impact de la tendance réduit pour limiter l'amplification d'erreurs \(MSE\)/, '');
    // Fix line i+3: change daysToExam to trendWindowDays
    lines[i+2] = ''; // Delete comment line
    lines[i+3] = lines[i+3].replace('Math.min(daysToExam, 30)', 'trendWindowDays');
    fixed = true;
    break;
  }
}

// Also remove the "const v = velocityMap..." line that's now dead
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const v = velocityMap ? velocityMap[m.nom] : null;') && lines[i+1] && lines[i+1].includes('trendWindowDays')) {
    lines[i] = '';
  }
}

if (fixed) {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
} else {
}
