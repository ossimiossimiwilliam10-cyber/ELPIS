import { describe, it, expect } from 'vitest';
import {
  diagnostiquerVitesse, diagnostiquerMatiere, synthetiserVitesse,
  dureeEpreuve, tempsMoyenTravaille, TD_PAR_SUJET,
} from '../moteur/vitesse';

const ev = (duree) => ({ nom: 'CC', coefficient: 1, dureeMinutes: duree });
const fait = (temps) => ({ titre: 'Ex', nombrePratiques: 2, tempsMoyen: temps });
const jamais = () => ({ titre: 'Ex', nombrePratiques: 0, tempsMoyen: null });

const matiere = (extra) => ({ nom: 'Électromagnétisme 3', evaluations: [ev(90)], ...extra });

const cursusAvec = (matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

describe('dureeEpreuve', () => {
  it('retient l\'épreuve la plus longue', () => {
    expect(dureeEpreuve({ evaluations: [ev(30), ev(90), ev(60)] })).toBe(90);
  });

  it('rend null quand aucune épreuve n\'est chronométrée', () => {
    // Rapports, oraux et projets n'ont pas de durée : la vitesse n'y a pas de sens.
    expect(dureeEpreuve({ evaluations: [{ nom: 'Rapport' }] })).toBeNull();
    expect(dureeEpreuve({})).toBeNull();
  });
});

describe('tempsMoyenTravaille', () => {
  it('ne compte que les exercices réellement travaillés', () => {
    const r = tempsMoyenTravaille([fait(40), jamais(), fait(60)]);
    expect(r).toEqual({ moyenne: 50, mesures: 2 });
  });

  it('rend null sans aucune mesure', () => {
    expect(tempsMoyenTravaille([jamais()])).toEqual({ moyenne: null, mesures: 0 });
    expect(tempsMoyenTravaille(null)).toEqual({ moyenne: null, mesures: 0 });
  });
});

describe('diagnostiquerMatiere', () => {
  it('compare directement le temps d\'une annale à la durée de l\'épreuve', () => {
    // Une annale est un sujet complet : c'est la mesure de référence.
    const d = diagnostiquerMatiere(matiere({ listeAnnales: [fait(120), fait(110)] }));
    expect(d.source).toBe('annales');
    expect(d.besoin).toBe(115);
    expect(d.ratio).toBeCloseTo(1.28, 2);
    expect(d.etat).toBe('critique');
    expect(d.message).toMatch(/25 min de trop/);
  });

  it('estime à partir des TD faute d\'annale', () => {
    // Trois exercices dirigés valent à peu près un sujet d'examen.
    const d = diagnostiquerMatiere(matiere({ listeTD: [fait(20), fait(20)] }));
    expect(d.source).toBe('td');
    expect(d.besoin).toBe(20 * TD_PAR_SUJET);
    expect(d.etat).toBe('confortable');
  });

  it('préfère les annales aux TD quand les deux existent', () => {
    const d = diagnostiquerMatiere(matiere({
      listeAnnales: [fait(70)],
      listeTD: [fait(60)],
    }));
    expect(d.source).toBe('annales');
    expect(d.besoin).toBe(70);
  });

  it('reconnaît une vitesse tout juste suffisante', () => {
    const d = diagnostiquerMatiere(matiere({ listeAnnales: [fait(85)] }));
    expect(d.etat).toBe('juste');
    expect(d.message).toMatch(/sans marge de relecture/);
  });

  it('signale un diagnostic tiré d\'une seule mesure', () => {
    // Une annale unique ne suffit pas à conclure : le résultat est rendu, mais
    // présenté pour ce qu'il est.
    const seule = diagnostiquerMatiere(matiere({ listeAnnales: [fait(120)] }));
    expect(seule.fiable).toBe(false);
    const deux = diagnostiquerMatiere(matiere({ listeAnnales: [fait(120), fait(115)] }));
    expect(deux.fiable).toBe(true);
  });

  it('oriente vers ce qui manque quand rien n\'est mesuré', () => {
    const d = diagnostiquerMatiere(matiere({ listeTD: [jamais()] }));
    expect(d.etat).toBe('inconnu');
    expect(d.ratio).toBeNull();
    expect(d.message).toMatch(/chronométrés/);
  });

  it('écarte les matières sans épreuve chronométrée', () => {
    expect(diagnostiquerMatiere({ nom: 'PIX', evaluations: [{ nom: 'Certification' }] })).toBeNull();
  });
});

describe('diagnostiquerVitesse', () => {
  it('classe les matières de la plus tendue à la plus sûre', () => {
    const carte = diagnostiquerVitesse(cursusAvec([
      { nom: 'Confortable', evaluations: [ev(90)], listeAnnales: [fait(50)] },
      { nom: 'Critique', evaluations: [ev(90)], listeAnnales: [fait(140)] },
      { nom: 'Juste', evaluations: [ev(90)], listeAnnales: [fait(85)] },
    ]));
    expect(carte.map(m => m.nom)).toEqual(['Critique', 'Juste', 'Confortable']);
  });

  it('relègue les matières non mesurées en fin de liste', () => {
    const carte = diagnostiquerVitesse(cursusAvec([
      { nom: 'Inconnue', evaluations: [ev(90)] },
      { nom: 'Mesurée', evaluations: [ev(90)], listeAnnales: [fait(80)] },
    ]));
    expect(carte[0].nom).toBe('Mesurée');
    expect(carte[1].ratio).toBeNull();
  });

  it('ignore une licence archivée', () => {
    const cursus = cursusAvec([{ nom: 'M', evaluations: [ev(90)] }]);
    cursus.licences[0].archived = true;
    expect(diagnostiquerVitesse(cursus)).toEqual([]);
  });

  it('survit à un cursus vide', () => {
    expect(diagnostiquerVitesse(null)).toEqual([]);
    expect(diagnostiquerVitesse({ licences: [] })).toEqual([]);
  });
});

describe('synthetiserVitesse', () => {
  it('dénombre les matières en difficulté', () => {
    const s = synthetiserVitesse(cursusAvec([
      { nom: 'A', evaluations: [ev(90)], listeAnnales: [fait(140)] },
      { nom: 'B', evaluations: [ev(90)], listeAnnales: [fait(85)] },
      { nom: 'C', evaluations: [ev(90)], listeAnnales: [fait(50)] },
      { nom: 'D', evaluations: [ev(90)] },
    ]));
    expect(s.mesurees).toBe(3);
    expect(s.critiques).toBe(1);
    expect(s.justes).toBe(1);
    expect(s.laPlusTendue.nom).toBe('A');
  });

  it('ne désigne aucune matière tendue quand tout va bien', () => {
    const s = synthetiserVitesse(cursusAvec([
      { nom: 'A', evaluations: [ev(90)], listeAnnales: [fait(40)] },
    ]));
    expect(s.laPlusTendue).toBeNull();
    expect(s.critiques).toBe(0);
  });

  it('ne produit jamais NaN', () => {
    const s = synthetiserVitesse(cursusAvec([
      { nom: 'Bruit', evaluations: [ev(90)], listeAnnales: [{ nombrePratiques: 3, tempsMoyen: 'vite' }] },
    ]));
    expect(s.matieres[0].ratio).toBeNull();
  });
});
