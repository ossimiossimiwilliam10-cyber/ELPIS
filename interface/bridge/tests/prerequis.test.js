import { describe, it, expect } from 'vitest';
import {
  autoriseTD, autoriseTP, autoriseAnnales, coursVus, exercicesFaits,
  EXERCICES_PAR_COURS,
} from '../moteur/prerequis';

const vu = () => ({ titre: 'CM', derniereRevision: '2026-09-20' });
const neuf = () => ({ titre: 'CM' });
const tdFait = () => ({ titre: 'TD', nombrePratiques: 2 });
const tdNeuf = () => ({ titre: 'TD', nombrePratiques: 0 });

const matiere = (vus, neufs, tdsFaits = 0, tdsNeufs = 0) => ({
  nom: 'Électromagnétisme 3',
  listeCM: [...Array.from({ length: vus }, vu), ...Array.from({ length: neufs }, neuf)],
  listeTD: [...Array.from({ length: tdsFaits }, tdFait), ...Array.from({ length: tdsNeufs }, tdNeuf)],
});

describe('coursVus et exercicesFaits', () => {
  it('comptent ce qui a été réellement abordé', () => {
    const m = matiere(3, 7, 4, 6);
    expect(coursVus(m)).toBe(3);
    expect(exercicesFaits(m)).toBe(4);
  });

  it('survivent à une matière vide', () => {
    expect(coursVus({})).toBe(0);
    expect(exercicesFaits({})).toBe(0);
  });
});

describe('autoriseTD', () => {
  it('ouvre les exercices dès le premier cours vu', () => {
    // L'ancienne règle exigeait 70 % du programme : en septembre, aucune
    // matière n'y parvient, et plus aucun TD n'était proposé pendant des
    // semaines — précisément quand ils ancrent le mieux les notions fraîches.
    const r = autoriseTD(matiere(1, 19, 0, 10));
    expect(r.autorise).toBe(true);
    expect(r.motif).toBe('equilibre');
  });

  it('refuse tant qu\'aucun cours n\'a été abordé', () => {
    const r = autoriseTD(matiere(0, 20, 0, 10));
    expect(r.autorise).toBe(false);
    expect(r.message).toMatch(/premier cours/);
  });

  it('empêche la pratique de prendre de l\'avance sur la théorie', () => {
    // Trois exercices par cours vu : de quoi suivre, pas de quoi épuiser toute
    // la réserve sur les deux premiers chapitres.
    const r = autoriseTD(matiere(2, 18, 2 * EXERCICES_PAR_COURS, 5));
    expect(r.autorise).toBe(false);
    expect(r.motif).toBe('avance-sur-theorie');
    expect(r.message).toMatch(/avance dans le cours/);
  });

  it('rouvre le quota à mesure que le cours avance', () => {
    const bloque = autoriseTD(matiere(2, 18, 6, 5));
    const libre = autoriseTD(matiere(3, 17, 6, 5));
    expect(bloque.autorise).toBe(false);
    expect(libre.autorise).toBe(true);
  });

  it('ne contraint pas une matière sans cours enregistré', () => {
    // Certaines matières ne se travaillent que par la pratique.
    const r = autoriseTD({ nom: 'Programmation', listeCM: [], listeTD: [tdFait(), tdFait()] });
    expect(r.autorise).toBe(true);
    expect(r.motif).toBe('aucun-cours');
  });
});

describe('autoriseTP', () => {
  it('ne bloque jamais un TP', () => {
    // Sa date est imposée et toute la note se joue sur la préparation :
    // la subordonner à l'avancement du cours revenait à sanctionner un retard
    // de théorie par un TP raté.
    expect(autoriseTP().autorise).toBe(true);
    expect(autoriseTP(matiere(0, 20)).autorise).toBe(true);
  });
});

describe('autoriseAnnales', () => {
  it('exige une vraie assise du programme', () => {
    const r = autoriseAnnales(matiere(2, 18));
    expect(r.autorise).toBe(false);
    expect(r.message).toMatch(/porte sur l'ensemble/);
  });

  it('ouvre à la moitié du programme', () => {
    expect(autoriseAnnales(matiere(10, 10)).autorise).toBe(true);
  });

  it('cède devant une échéance proche', () => {
    // Mieux vaut une annale imparfaite que pas d'annale à trois semaines de
    // l'épreuve.
    const r = autoriseAnnales(matiere(1, 19), { urgent: true });
    expect(r.autorise).toBe(true);
    expect(r.motif).toBe('echeance-proche');
  });

  it('laisse poursuivre une série déjà entamée', () => {
    const r = autoriseAnnales(matiere(2, 18), { dejaCommencees: true });
    expect(r.autorise).toBe(true);
  });

  it('ne contraint pas une matière sans cours enregistré', () => {
    expect(autoriseAnnales({ listeCM: [] }).autorise).toBe(true);
  });
});
