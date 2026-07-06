const { getTodayString } = require('../interface/bridge/moteur/intelligence.js');

console.log("Backend today string:", getTodayString());

const d = new Date();
d.setHours(d.getHours() - 4);
const frontendStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
console.log("Frontend today string:", frontendStr);
