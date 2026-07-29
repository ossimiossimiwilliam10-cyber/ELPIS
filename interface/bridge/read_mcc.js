const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');
const p = "c:\\Users\\User\\Desktop\\Etudes\\Mes cours 2026 - 2027\\L2 Sciences pour l'ingénieur - Semestre 3\\MCC L2 Sciences pour l'ingénieur et santé.pdf";
const dataBuffer = fs.readFileSync(p);
pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(console.error);
