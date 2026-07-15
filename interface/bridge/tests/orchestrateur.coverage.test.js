import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { genererRapportQuotidien } from '../moteur/orchestrateur';
const { db } = require('../db/setup');
import { saveConfig } from '../moteur/config';
import { saveCours } from '../moteur/cours';
import { saveHistorique } from '../moteur/historique';

const getBaseCours = () => ({
  licences: [{
    nom: 'L1',
    semestres: [{
      nom: 'S1',
      ues: [{
        nom: 'U1',
        matieres: [{
          nom: 'Maths',
          coefficient: 3,
          listeCM: [], listeTD: [], listeTP: [], listeAnnales: []
        }]
      }]
    }]
  }]
});

describe('Orchestrateur - Extreme Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z')); // Dimanche 21 Juin 2026

    db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');
  });

  afterEach(() => {
    db.exec('DELETE FROM exercices; DELETE FROM cours_cm; DELETE FROM matieres; DELETE FROM ues; DELETE FROM semestres; DELETE FROM licences; DELETE FROM historique; DELETE FROM config;');
  });

  test('Branch: Anti-Burnout forced rest', () => {
    const hist = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date('2026-06-21T12:00:00Z');
      d.setDate(d.getDate() - i);
      hist.push({ timestamp: d.toISOString(), dureeMinutes: 400 });
    }
    saveConfig({ maxStudyHoursPerDay: 8 });
    saveCours(getBaseCours());
    saveHistorique(hist);

    const r = genererRapportQuotidien(0);
    expect(r.statut).toBe('REPOS');
    expect(r.message).toContain('Anti-Burnout');
  });

  test('Branch: Config restDays imposed rest', () => {
    saveConfig({ restDays: ['2026-06-21'] });
    saveCours(getBaseCours());
    saveHistorique([{ type: 'CM', timestamp: '2026-06-20T10:00:00Z', dureeMinutes: 120 }]); // Worked yesterday!

    const r = genererRapportQuotidien(0);
    expect(r.statut).toBe('REPOS');
    expect(r.message).toContain('Jour de repos');
  });

  test('Branch: Fixed Commitments parsing across midnight and valid', () => {
    saveConfig({
      maxStudyHoursPerDay: 8,
      fixedCommitments: [
        { day: 'Dimanche', start: '10:00', end: '12:00', matiereLinked: 'Maths' }, // 120 mins
        { day: 'Tous les jours', start: '23:00', end: '01:00' }, // 120 mins
        { day: 'Lundi', start: '08:00', end: '10:00' }, // Ignored
        { day: 'Dimanche', start: 'XX:00', end: 'YY' } // Invalid parsing
      ]
    });
    saveCours(getBaseCours());
    const r = genererRapportQuotidien(0);
    expect(r.fixedCommitmentsMin).toBe(240);
  });

  test('Branch: Temps Deja Travaille (today) - CM, TD, TP, Annales', () => {
    saveConfig({
      dernierePratiqueAnki: '2026-06-21',
      defaultDurationAnki: 25,
      defaultDurationNewCM: 120,
      defaultDurationTD: 20,
      defaultDurationTP_Etape1: 45,
      defaultDurationAnnales: 60
    });
    const crs = getBaseCours();
    crs.licences[0].semestres[0].ues[0].matieres[0].listeCM.push({ titre: 'CM1', jActuel: 0, derniereRevision: '2026-06-21' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTD.push({ titre: 'TD1', dernierePratique: '2026-06-21', difficulte: 'moyen' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTP.push({ titre: 'TP1', dernierePratique: '2026-06-21', nombrePratiques: 1, difficulte: 'moyen' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeAnnales.push({ titre: 'ANN1', dernierePratique: '2026-06-21', difficulte: 'moyen' });
    saveCours(crs);

    saveHistorique([
      { type: 'ANKI', timestamp: '2026-06-21T10:00:00Z', dureeMinutes: 25 },
      { type: 'CM', timestamp: '2026-06-21T10:30:00Z', dureeMinutes: 120 },
      { type: 'TD', timestamp: '2026-06-21T11:00:00Z', dureeMinutes: 20 },
      { type: 'TP', timestamp: '2026-06-21T11:30:00Z', dureeMinutes: 45 },
      { type: 'ANNALE', timestamp: '2026-06-21T12:00:00Z', dureeMinutes: 60 }
    ]);

    const r = genererRapportQuotidien(0);
    expect(r.tempsDejaTravailleMin).toBe(270);
  });

  test('Branch: Annales Unlocking & Synergy Prep Boost', () => {
    saveConfig({ maxStudyHoursPerDay: 8 });
    const crs = getBaseCours();
    crs.licences[0].semestres[0].ues[0].matieres[0].evaluations = [{ date: '2026-07-01' }]; // ~10 days
    crs.licences[0].semestres[0].ues[0].matieres[0].listeAnnales.push({ titre: 'ANN_URGENT', difficulte: 'difficile' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeCM.push({ titre: 'CM_PREP', jActuel: 5, derniereRevision: '2026-06-11' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTD.push({ titre: 'TD_TARGET', difficulte: 'difficile' });
    saveCours(crs);

    const r = genererRapportQuotidien(0);
    const annaleTask = r.tachesDuJour.find(t => t.type === 'ANNALE');
    expect(annaleTask).toBeDefined();
    expect(annaleTask.raisons).toContain('EXAMEN_IMMINENT');

    const cmTask = r.tachesDuJour.find(t => t.type === 'CM' && t.titre === 'CM_PREP');
    expect(cmTask).toBeDefined();
    expect(cmTask.raisons).toContain('PREPA_TD');
  });

  test('Branch: FillGap mode', () => {
    saveConfig({ maxStudyHoursPerDay: 8 });
    const crs = getBaseCours();
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTD.push({ titre: 'TD_GAP' });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTP.push({ titre: 'TP_GAP', nombrePratiques: 1 });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeCM.push({ titre: 'CM_GAP', jActuel: 0 });
    saveCours(crs);

    const r = genererRapportQuotidien(0, true);
    expect(r.tachesDuJour.filter(t => t.type === 'TD').length).toBeLessThanOrEqual(1);
    expect(r.tachesDuJour.filter(t => t.type === 'TP').length).toBeLessThanOrEqual(1);
  });

  test('Anti-regression: tempsDejaTravailleMin calculates exact minutes from history regardless of moving averages or default durations', () => {
    // Configure default durations to 1000 each, which would cause massive bloat if the old bug was present
    saveConfig({
      defaultDurationAnki: 1000,
      defaultDurationNewCM: 1000,
      defaultDurationRevCM: 1000,
      defaultDurationTD: 1000,
      defaultDurationTP_Etape1: 1000,
      defaultDurationAnnales: 1000
    });

    // Add tasks that were revised/completed today.
    // In the old bug, their default durations or moving averages would be summed.
    const crs = getBaseCours();
    crs.licences[0].semestres[0].ues[0].matieres[0].listeCM.push({ titre: 'CM1', jActuel: 0, derniereRevision: '2026-06-21', tempsMoyen: 500 });
    crs.licences[0].semestres[0].ues[0].matieres[0].listeTD.push({ titre: 'TD1', dernierePratique: '2026-06-21', tempsMoyen: 500 });
    saveCours(crs);

    // The ONLY source of truth must be the history file.
    // We only completed two tasks today: 12 minutes and 8 minutes. Total = 20 minutes.
    saveHistorique([
      { type: 'CM', timestamp: '2026-06-21T10:30:00Z', dureeMinutes: 12 },
      { type: 'TD', timestamp: '2026-06-21T11:00:00Z', dureeMinutes: 8 }
    ]);

    const r = genererRapportQuotidien(0);
    // If the old bug was active, this would be 1000 (from tempsMoyen) or 2000 (from default configs).
    // It MUST be exactly 20.
    expect(r.tempsDejaTravailleMin).toBe(20);
  });

  test('Branch: Variable Rest Days (2nd day optional)', () => {
    // Today is forced rest via config
    saveConfig({ restDays: ['2026-06-22', '2026-06-23'], skippedRestDays: [] });
    // Work on Sunday so Monday is Day 1
    saveHistorique([{ type: 'CM', timestamp: '2026-06-21T10:00:00Z', dureeMinutes: 120 }]);
    
    // Simulate Monday (Day 1)
    vi.setSystemTime(new Date('2026-06-22T12:00:00Z')); // Monday
    let r = genererRapportQuotidien(0);
    expect(r.statut).toBe('REPOS');

    // Simulate Tuesday (Day 2)
    // History has nothing for Monday, so restedYesterday is true
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z')); // Tuesday
    r = genererRapportQuotidien(0);
    expect(r.statut).toBe('REPOS_OPTIONNEL');

    // If skipped
    saveConfig({ restDays: ['2026-06-22', '2026-06-23'], skippedRestDays: ['2026-06-23'] });
    r = genererRapportQuotidien(0);
    expect(r.statut).not.toBe('REPOS_OPTIONNEL');
    expect(r.statut).not.toBe('REPOS');
  });
});
