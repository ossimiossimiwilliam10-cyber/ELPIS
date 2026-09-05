import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { calculerPriorite, contexteDepuisExercice } = require('../moteur/priorite');
const { saveConfig, loadConfig } = require('../moteur/config');
const { saveCours, loadCours } = require('../moteur/cours');
const { genererRapportQuotidien } = require('../moteur/orchestrateur');

let configOrigine;
let coursOrigine;

const matiere = (nom, extra = {}) => ({
  nom, coefficient: 1, evaluations: [],
  listeCM: [], listeTD: [], listeTP: [], listeAnnales: [],
  ...extra,
});

beforeAll(() => {
  configOrigine = loadConfig();

  coursOrigine = loadCours();

  saveCours({
    licences: [{
      nom: 'L2',
      semestres: [{
        nom: 'S3',
        ues: [{
          nom: 'UE1', ects: 6,
          matieres: [
            matiere('Algèbre', { listeCM: [{ titre: 'Groupes' }, { titre: 'Anneaux' }] }),
            matiere('Analyse', { listeTD: [{ titre: 'TD1' }, { titre: 'TD2' }] }),
          ],
        }],
      }],
    }],
  });

  saveConfig({
    ...configOrigine,
    studyStartDate: '01-01-2020',
    restDays: [],
    skippedRestDays: [],
    enableTD: true,
    enableAnnales: true,
    maxStudyHoursPerDay: 8,
    wakeUpTime: '07:00',
    bedtime: '23:00',
  });
});

afterAll(() => {
  saveConfig(configOrigine);
  if (coursOrigine) saveCours(coursOrigine);
});

describe('Priorité explicable dans le rapport', () => {
  test('chaque tâche porte son score borné', () => {
    const rapport = genererRapportQuotidien(0, true);
    const taches = rapport.tachesDuJour || [];
    expect(taches.length).toBeGreaterThan(0);

    for (const t of taches) {
      expect(typeof t.priorite).toBe('number');
      expect(t.priorite).toBeGreaterThanOrEqual(0);
      expect(t.priorite).toBeLessThanOrEqual(100);
    }
  });

  test('chaque tâche porte la décomposition de son score', () => {
    // C'est ce qui manquait : un produit d'une douzaine de facteurs ne se
    // décompose pas, donc rien ne pouvait être expliqué à l'écran.
    const taches = genererRapportQuotidien(0, true).tachesDuJour || [];

    for (const t of taches) {
      expect(t.explication).toBeDefined();
      expect(Array.isArray(t.explication.raisons)).toBe(true);
      expect(Array.isArray(t.explication.composantes)).toBe(true);
    }
  });

  test('les tâches obligatoires gardent la priorité maximale', () => {
    const taches = genererRapportQuotidien(0, true).tachesDuJour || [];
    const anki = taches.find(t => t.type === 'ANKI');
    if (anki) {
      expect(anki.priorite).toBeGreaterThanOrEqual(95);
      expect(anki.explication.raisons.length).toBeGreaterThan(0);
    }
  });

  test('l\'amplitude entre tâches reste maîtrisée', () => {
    // L'ancien score pouvait varier d'un facteur 1200 : une seule matière
    // raflait la journée entière.
    const taches = (genererRapportQuotidien(0, true).tachesDuJour || [])
      .filter(t => t.type !== 'ANKI' && t.type !== 'PROJET');

    if (taches.length >= 2) {
      const scores = taches.map(t => t.priorite).filter(p => p > 0);
      const rapport = Math.max(...scores) / Math.min(...scores);
      expect(rapport).toBeLessThan(20);
    }
  });
});

describe('Contenu jamais abordé', () => {
  test('un cours neuf est considéré comme dû', () => {
    // Sans ce cas, un cours jamais révisé ne recevait aucun point d'échéance
    // et passait derrière des révisions déjà faites : le classement des
    // matières s'en trouvait faussé et des cours attendus disparaissaient
    // du planning.
    const neuf = calculerPriorite(contexteDepuisExercice({ titre: 'CM1' }, { nom: 'Algèbre' }));
    const revu = calculerPriorite(contexteDepuisExercice(
      { titre: 'CM2', repetitions: 3, derniereRevision: new Date().toISOString().slice(0, 10) },
      { nom: 'Algèbre' }
    ));

    expect(neuf.score).toBeGreaterThan(revu.score);
    expect(neuf.raisons).toContain('Pas encore abordé');
  });

  test('un exercice neuf cumule échéance et couverture', () => {
    const { composantes } = calculerPriorite({ jamaisTravaille: true, nombrePratiques: 0 });
    const criteres = composantes.map(c => c.critere);
    expect(criteres).toContain('oubli');
    expect(criteres).toContain('couverture');
  });
});
