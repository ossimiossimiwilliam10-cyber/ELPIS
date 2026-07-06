const fs = require('fs');
const path = require('path');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHistorique(profil, startDate, endDate) {
  const historique = [];
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();
  const totalDays = Math.floor((endTs - startTs) / (24 * 3600 * 1000));

  let currentTs = startTs;

  for (let i = 0; i < totalDays; i++) {
    const dayDate = new Date(currentTs);

    // Logique par profil
    let willStudyToday = false;
    let studyHourStart = 18;
    let sessionsToday = 0;

    if (profil === 'Bosseur') {
      willStudyToday = dayDate.getDay() !== 0; // Se repose le dimanche
      studyHourStart = randomInt(17, 19);
      sessionsToday = randomInt(2, 4);
    } else if (profil === 'Procrastinateur') {
      const daysLeft = totalDays - i;
      // Ne fait rien au début, panique à la fin
      if (daysLeft < 14) {
        willStudyToday = true;
        studyHourStart = randomInt(14, 20);
        sessionsToday = randomInt(5, 8); // 5 à 8 sessions par jour = Cramming
      } else {
        willStudyToday = Math.random() < 0.1; // 10% de chance d'étudier
        sessionsToday = 1;
      }
    } else if (profil === 'DentDeScie') {
      const isActivePeriod = Math.floor(i / 14) % 2 === 0; // Alternance de 2 semaines
      willStudyToday = isActivePeriod && Math.random() < 0.8;
      studyHourStart = randomInt(16, 21);
      sessionsToday = randomInt(1, 3);
    } else if (profil === 'OiseauDeNuit') {
      willStudyToday = Math.random() < 0.7;
      studyHourStart = randomInt(23, 27); // 23h à 3h du matin
      sessionsToday = randomInt(2, 4);
    }

    if (willStudyToday) {
      let currentHourTs = currentTs + (studyHourStart * 3600 * 1000);
      for (let s = 0; s < sessionsToday; s++) {
        const matieres = ['Maths', 'Physique', 'Info', 'Chimie'];
        const types = ['CM', 'TD', 'TP', 'ANKI'];

        historique.push({
          id: `hist_${Date.now()}_${randomInt(0, 10000)}`,
          matiere: matieres[randomInt(0, matieres.length - 1)],
          type: types[randomInt(0, types.length - 1)],
          dureeMinutes: randomInt(20, 90),
          timestamp: currentHourTs,
          scoreObtenu: randomInt(50, 100) / 100 // Entre 0.5 et 1.0 (maîtrise)
        });
        currentHourTs += randomInt(30, 120) * 60 * 1000; // Espace entre sessions
      }
    }
    currentTs += 24 * 3600 * 1000;
  }
  return historique;
}

function generateStudent(id, profil) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (90 * 24 * 3600 * 1000)); // 3 mois d'historique

  const historique = generateHistorique(profil, startDate, endDate);

  // Générer des notes simulées liées au profil
  let baseGrades = 10;
  if (profil === 'Bosseur') baseGrades = 15;
  if (profil === 'Procrastinateur') baseGrades = 8;
  if (profil === 'OiseauDeNuit') baseGrades = 12;

  const matieres = ['Maths', 'Physique', 'Info', 'Chimie'];
  const listeMatieres = matieres.map(m => {
    // Ajouter du bruit aléatoire aux notes
    const grade = Math.max(0, Math.min(20, baseGrades + (Math.random() * 4 - 2)));
    return {
      nom: m,
      coefficient: randomInt(1, 4),
      evaluations: [
        { note: grade, coefficient: 1, date: startDate.toISOString() }
      ],
      listeCM: Array.from({ length: 10 }).map((_, idx) => ({
        id: `${m}_cm_${idx}`,
        easeFactor: (profil === 'Bosseur') ? 2.8 : 2.0,
        repetitions: (profil === 'Bosseur') ? 5 : 1,
        derniereRevision: endDate.toISOString()
      }))
    };
  });

  const crs = {
    licences: [
      {
        archived: false,
        semestres: [
          {
            archived: false,
            ues: [
              {
                matieres: listeMatieres
              }
            ]
          }
        ]
      }
    ]
  };

  const cfg = {
    bedtime: '23:00',
    restDays: []
  };

  return { id, profil, historique, crs, cfg };
}

function generateDataset(numStudents = 100) {
  const profiles = ['Bosseur', 'Procrastinateur', 'DentDeScie', 'OiseauDeNuit'];
  const dataset = [];

  for (let i = 0; i < numStudents; i++) {
    const profil = profiles[i % profiles.length];
    dataset.push(generateStudent(`stu_${i}`, profil));
  }
  return dataset;
}

module.exports = { generateDataset };

// Si exécuté directement
if (require.main === module) {
  const args = process.argv.slice(2);
  const count = args[0] ? parseInt(args[0]) : 100;
  const data = generateDataset(count);
  const outPath = path.resolve(__dirname, 'dataset.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
}
