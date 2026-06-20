/**
 * Simulation de stress-test : Profil "Charbonneur en Retard"
 * Génère des données synthétiques et exécute l'Orchestrateur réel au Jour 13.
 */
const fs = require('fs');
const path = require('path');
const { genererRapportQuotidien } = require('./moteur/orchestrateur');

const SIM_DIR = path.join(__dirname, 'sim_stress_test');
if (!fs.existsSync(SIM_DIR)) fs.mkdirSync(SIM_DIR);

// ─── 1. Config synthétique ───
const today = new Date();
function dateStr(offset) {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const config = {
  studyStartDate: "07-09-2026",
  bedtime: "01:00",        // Étudiant qui dort tard
  wakeUpTime: "07:00",
  maxStudyHoursPerDay: 8,
  targetGrade: 12,
  maxSubjectsPerDay: 4,
  currentStreak: 12,
  bestStreak: 12,
  lastActiveDate: dateStr(-1),
  restDays: [],            // Aucun repos depuis 12 jours
  defaultDurationNewCM: 120,
  defaultDurationRevCM: 30,
  defaultDurationTD: 20,
  defaultDurationTP: 30,
  defaultDurationAnnales: 60,
  defaultDurationAnki: 30,
  defaultDurationTP_Etape1: 45,
  defaultDurationTP_Etape2: 180,
  defaultDurationTP_Etape3: 90,
  defaultDurationTP_Etape4: 30,
  maxNewCMPerSubjectPerDay: 1,
  maxNewCMPerSemesterPerDay: 3,
  antiEnnuiMultiplier: 2.0
};

// ─── 2. Cours synthétique ───
const cours = {
  licences: [{
    nom: "Licence SPI",
    semestres: [{
      nom: "Semestre 3",
      ues: [
        {
          nom: "UE Majeure - Mathématiques (coeff fort)",
          ects: 9,
          matieres: [{
            nom: "Algèbre",
            coefficient: 4,
            evaluations: [
              { nom: "DS1", coefficient: 2, note: 6, type: "SC" },
              { nom: "DS2", coefficient: 2, note: 7, type: "SC" }
            ],
            listeCM: [
              { titre: "Espaces vectoriels", jActuel: 3, easeFactor: 1.8, repetitions: 2, derniereRevision: dateStr(-3), prochaineRevisionDate: dateStr(0) },
              { titre: "Diagonalisation", jActuel: 5, easeFactor: 1.6, repetitions: 1, derniereRevision: dateStr(-5), prochaineRevisionDate: dateStr(-3) },
              { titre: "Polynômes caractéristiques", jActuel: 0, easeFactor: 2.5, repetitions: 0 }
            ],
            listeTD: [
              { titre: "TD Espaces vectoriels", nombrePratiques: 2, dernierePratique: dateStr(-3), difficulte: "difficile" },
              { titre: "TD Diagonalisation", nombrePratiques: 0, difficulte: "difficile" }
            ],
            listeTP: [],
            listeAnnales: [
              { titre: "Annale 2024 - Algèbre", nombrePratiques: 0, difficulte: "difficile" }
            ]
          }]
        },
        {
          nom: "UE Secondaire - Informatique",
          ects: 6,
          matieres: [{
            nom: "Programmation C",
            coefficient: 2,
            evaluations: [
              { nom: "TP Noté", coefficient: 1, note: 14, type: "SC" }
            ],
            listeCM: [
              { titre: "Pointeurs", jActuel: 10, easeFactor: 2.2, repetitions: 2, derniereRevision: dateStr(-10), prochaineRevisionDate: dateStr(-3) },
              { titre: "Structures", jActuel: 14, easeFactor: 2.4, repetitions: 3, derniereRevision: dateStr(-14), prochaineRevisionDate: dateStr(-2) }
            ],
            listeTD: [
              { titre: "TD Pointeurs", nombrePratiques: 4, dernierePratique: dateStr(-7), difficulte: "moyen" }
            ],
            listeTP: [],
            listeAnnales: []
          }]
        },
        {
          nom: "UE Mineure - Anglais",
          ects: 3,
          matieres: [{
            nom: "Anglais Technique",
            coefficient: 1,
            evaluations: [
              { nom: "Oral", coefficient: 1, note: 11, type: "SC" }
            ],
            listeCM: [
              { titre: "Vocabulaire scientifique", jActuel: 21, easeFactor: 2.8, repetitions: 4, derniereRevision: dateStr(-21), prochaineRevisionDate: dateStr(-5) }
            ],
            listeTD: [],
            listeTP: [],
            listeAnnales: []
          }]
        }
      ]
    }]
  }]
};

// ─── 3. Historique synthétique (12 jours) ───
const historique = [];
for (let day = 0; day < 12; day++) {
  const d = dateStr(-12 + day);
  const isWeek1 = day < 6;

  // Sessions Algèbre (mauvaise UE) — longues, souvent difficiles
  historique.push({
    timestamp: d + 'T09:00:00',
    type: 'CM',
    matiere: 'Algèbre',
    titre: 'Espaces vectoriels',
    dureeMinutes: isWeek1 ? 120 : 150,
    easeFactor: 1.8,
    action: 'score 2'
  });
  historique.push({
    timestamp: d + 'T10:30:00',
    type: 'TD',
    matiere: 'Algèbre',
    titre: 'TD Espaces vectoriels',
    dureeMinutes: isWeek1 ? 60 : 90,
    action: 'difficile'
  });

  // Sessions Programmation C (correctes)
  if (day % 2 === 0) {
    historique.push({
      timestamp: d + 'T14:00:00',
      type: 'CM',
      matiere: 'Programmation C',
      titre: 'Pointeurs',
      dureeMinutes: 45,
      easeFactor: 2.2,
      action: 'score 3'
    });
  }

  // Sessions tardives (à partir de J5)
  if (day >= 5) {
    historique.push({
      timestamp: d + 'T23:30:00',
      type: 'TD',
      matiere: 'Algèbre',
      titre: 'TD Diagonalisation',
      dureeMinutes: 90,
      action: 'difficile'
    });
  }
}

// ─── 4. Écriture des fichiers temporaires ───
fs.writeFileSync(path.join(SIM_DIR, 'espoir_config.json'), JSON.stringify(config, null, 2));
fs.writeFileSync(path.join(SIM_DIR, 'espoir_cours.json'), JSON.stringify(cours, null, 2));
fs.writeFileSync(path.join(SIM_DIR, 'espoir_historique.json'), JSON.stringify(historique, null, 2));

// ─── 5. Exécution ───
const rapport = genererRapportQuotidien(
  path.join(SIM_DIR, 'espoir_config.json'),
  path.join(SIM_DIR, 'espoir_cours.json'),
  0,
  false
);

// ─── 6. Rapport ───
console.log('\n═══════════════════════════════════════════');
console.log('  RAPPORT DE SIMULATION — Jour 13');
console.log('  Profil : "Charbonneur en Retard"');
console.log('═══════════════════════════════════════════\n');

console.log('📊 STATUT GLOBAL :', rapport.statut);
console.log('⏱️  Temps dispo    :', Math.round(rapport.tempsDispoMin / 60 * 10) / 10, 'h');
console.log('📋  Temps déjà fait :', Math.round(rapport.tempsDejaTravailleMin / 60 * 10) / 10, 'h');
console.log('📌  Temps requis    :', Math.round(rapport.tempsRequisMin / 60 * 10) / 10, 'h');

console.log('\n🛡️  ANTI-BURNOUT (Axe 12) :');
const br = rapport.intelligence.burnoutRisk;
console.log('   Risk level      :', br.riskLevel);
console.log('   Should force rest:', br.shouldForceRest);
console.log('   Jours sans repos :', br.daysWithoutRest);
console.log('   Moy. quotidienne :', Math.round(br.avgDailyMinutes / 60 * 10) / 10, 'h/jour');
console.log('   Sessions tardives:', br.lateSessionCount);
console.log('   Raison           :', br.reason || '(aucune)');

console.log('\n🎯 TÂCHES DU JOUR (priorité décroissante) :');
rapport.tachesDuJour.forEach((t, i) => {
  console.log(`  ${i + 1}. [${t.type}] ${t.matiere} — "${t.titre}"`);
  console.log(`     Priorité: ${t.prio?.toFixed?.(1) || t.prio} | Durée: ${t.dureeMinutes}min | Moment: ${t.moment}`);
  if (t.raisons && t.raisons.length > 0) console.log(`     Raisons: ${t.raisons.join(', ')}`);
});

console.log('\n🧠 INTELLIGENCE MAPS :');
console.log('   CompensationMap (Algèbre) :', JSON.stringify(rapport.intelligence.compensationMap['Algèbre'] || 'non trouvé'));
console.log('   ProjectedScore (Algèbre)  :', rapport.intelligence.projectedScoreMap['Algèbre']);
console.log('   ProjectedScore (Prog. C)  :', rapport.intelligence.projectedScoreMap['Programmation C']);
console.log('   ProjectedScore (Anglais)  :', rapport.intelligence.projectedScoreMap['Anglais Technique']);
console.log('   VelocityMap (Algèbre)     :', JSON.stringify(rapport.intelligence.velocityMap['Algèbre'] || 'non trouvé'));

console.log('\n📋 ANALYSE DES SEUILS :');
const algTasks = rapport.tachesDuJour.filter(t => t.matiere === 'Algèbre');
const progTasks = rapport.tachesDuJour.filter(t => t.matiere === 'Programmation C');
const anglaisTasks = rapport.tachesDuJour.filter(t => t.matiere === 'Anglais Technique');
console.log(`   Tâches Algèbre (UE majeure, notes < 8) : ${algTasks.length}`);
console.log(`   Tâches Programmation C (UE correcte)   : ${progTasks.length}`);
console.log(`   Tâches Anglais (UE mineure)             : ${anglaisTasks.length}`);

const burnoutTriggered = br.riskLevel !== 'none';
console.log(`\n   → Anti-Burnout déclenché : ${burnoutTriggered ? 'OUI ⚠️' : 'NON ✓'}`);
console.log(`   → Niveau : ${br.riskLevel}`);
console.log(`   → L'étudiant a ${br.daysWithoutRest} jours sans repos avec une moyenne de ${Math.round(br.avgDailyMinutes/60*10)/10}h/jour`);

// Nettoyage
fs.rmSync(SIM_DIR, { recursive: true, force: true });
console.log('\n✅ Simulation terminée.\n');
