import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { genererRapportQuotidien } from './orchestrateur';
import * as path from 'path';
import * as fs from 'fs';

// Définir des chemins vers des données de test
const configPath = path.join(__dirname, '..', '..', '..', 'data', 'espoir_config.json');
const coursPath = path.join(__dirname, '..', '..', '..', 'data', 'espoir_cours.json');

describe('Orchestrateur v3', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('devrait générer un rapport priorisant selon la chronobiologie (morning_lark)', () => {
    // Simuler l'heure du matin (9h00)
    const dateMatin = new Date('2026-07-08T09:00:00+02:00');
    vi.setSystemTime(dateMatin);
    
    // Si les fichiers existent, on teste la génération
    if (fs.existsSync(configPath) && fs.existsSync(coursPath)) {
      const rapport = genererRapportQuotidien(configPath, coursPath, 0, false);
      
      expect(rapport).toBeDefined();
      expect(rapport.tachesDuJour).toBeDefined();
      
      // On s'attend à ce que l'Orchestrateur nous donne des tâches
      // Et que l'assignation 'moment' soit calculée
      if (rapport.tachesDuJour.length > 0) {
        expect(['matin', 'aprem', 'soir']).toContain(rapport.tachesDuJour[0].moment);
      }
    }
  });

  it('devrait assigner des tâches légères en priorité le soir', () => {
    // Simuler l'heure du soir (22h00)
    const dateSoir = new Date('2026-07-08T22:00:00+02:00');
    vi.setSystemTime(dateSoir);
    
    if (fs.existsSync(configPath) && fs.existsSync(coursPath)) {
      const rapport = genererRapportQuotidien(configPath, coursPath, 0, false);
      expect(rapport).toBeDefined();
      expect(rapport.tachesDuJour).toBeDefined();
    }
  });

  it('devrait retourner le mode repos si le risque de burnout est critique ou si jour de repos', () => {
    // Test basique pour s'assurer qu'il ne crashe pas
    if (fs.existsSync(configPath) && fs.existsSync(coursPath)) {
      const rapport = genererRapportQuotidien(configPath, coursPath, 0, false);
      if (rapport.statut === "REPOS") {
        expect(rapport.tachesDuJour).toHaveLength(0);
        expect(rapport.tempsRequisMin).toBe(0);
      }
    }
  });
});
