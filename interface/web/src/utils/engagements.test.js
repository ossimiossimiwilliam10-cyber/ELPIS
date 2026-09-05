import { describe, it, expect } from 'vitest';
import { dureeEngagementMin, formaterDuree, dureeSuspecte } from './engagements';

describe('dureeEngagementMin', () => {
  it('calcule une plage ordinaire', () => {
    expect(dureeEngagementMin('08:00', '10:00')).toBe(120);
    expect(dureeEngagementMin('08:30', '09:15')).toBe(45);
  });

  it('traite une fin antérieure comme un passage à minuit', () => {
    // Comportement de l'orchestrateur, reproduit à l'identique.
    expect(dureeEngagementMin('22:00', '02:00')).toBe(240);
  });

  it('révèle l\'ampleur d\'une inversion accidentelle', () => {
    // 10:00 → 08:00 devient 22 h et absorbe toute la journée : c'est
    // précisément ce que l'affichage doit rendre visible.
    expect(dureeEngagementMin('10:00', '08:00')).toBe(22 * 60);
  });

  it('renvoie zéro pour une saisie incomplète', () => {
    expect(dureeEngagementMin('', '10:00')).toBe(0);
    expect(dureeEngagementMin('08:00', null)).toBe(0);
    expect(dureeEngagementMin('pas une heure', '10:00')).toBe(0);
  });

  it('renvoie zéro pour une plage nulle', () => {
    expect(dureeEngagementMin('08:00', '08:00')).toBe(0);
  });
});

describe('formaterDuree', () => {
  it('exprime les heures pleines', () => {
    expect(formaterDuree(120)).toBe('2 h');
  });

  it('exprime les minutes seules', () => {
    expect(formaterDuree(45)).toBe('45 min');
  });

  it('combine heures et minutes', () => {
    expect(formaterDuree(90)).toBe('1 h 30');
    expect(formaterDuree(65)).toBe('1 h 05');
  });

  it('gère l\'absence de durée', () => {
    expect(formaterDuree(0)).toBe('0 min');
    expect(formaterDuree(undefined)).toBe('0 min');
  });
});

describe('dureeSuspecte', () => {
  it('laisse passer une journée de cours ordinaire', () => {
    expect(dureeSuspecte('08:00', '18:00')).toBe(false);
  });

  it('signale une plage démesurée', () => {
    expect(dureeSuspecte('10:00', '08:00')).toBe(true);
  });

  it('laisse passer une garde de nuit plausible', () => {
    expect(dureeSuspecte('22:00', '06:00')).toBe(false);
  });
});
