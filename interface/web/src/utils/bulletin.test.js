import { describe, it, expect } from 'vitest';
import { moyenneMatiere, moyenneUE, moyenneSemestre, formaterMoyenne, mentionPour, conformiteUE, DEFAILLANT } from './bulletin';

const ev = (note, coefficient = 1, statut) => ({ note, coefficient, statut });

describe('moyenneMatiere', () => {
  it('pondère les évaluations par leur coefficient', () => {
    expect(moyenneMatiere([ev(10, 1), ev(16, 3)])).toBe(14.5);
  });

  it('ignore les évaluations sans note', () => {
    expect(moyenneMatiere([ev(12, 1), ev(null, 2)])).toBe(12);
  });

  it('ignore une évaluation excusée', () => {
    expect(moyenneMatiere([ev(12, 1), ev(4, 3, 'excuse')])).toBe(12);
  });

  it('rend la matière défaillante si une évaluation l\'est', () => {
    expect(moyenneMatiere([ev(18, 1), ev(null, 1, 'defaillant')])).toBe(DEFAILLANT);
  });

  it('renvoie null en l\'absence de note', () => {
    expect(moyenneMatiere([])).toBeNull();
    expect(moyenneMatiere(null)).toBeNull();
    expect(moyenneMatiere([ev(null, 1)])).toBeNull();
  });

  it('accepte un coefficient absent', () => {
    expect(moyenneMatiere([{ note: 10 }, { note: 14 }])).toBe(12);
  });
});

describe('moyenneUE', () => {
  const matiere = (nom, notes, extra = {}) => ({ nom, evaluations: notes.map(n => ev(n)), ...extra });

  it('pondère les matières par leur coefficient', () => {
    const ue = { ects: 6, matieres: [matiere('A', [10], { coefficient: 1 }), matiere('B', [16], { coefficient: 3 })] };
    expect(moyenneUE(ue).moyenne).toBe(14.5);
  });

  it('écarte une matière de coefficient nul du calcul', () => {
    /*
     * Le coefficient nul était traité en « bonus additif » : la moyenne entière
     * de la matière s'ajoutait à celle de l'UE. Le test qui couvrait ce cas
     * prenait un bonus noté 1/20 sur une base de 10 et attendait 11 — un
     * chiffre plausible, qui masquait la formule. Avec des notes ordinaires,
     * elle produisait des moyennes impossibles.
     */
    const ue = { ects: 6, matieres: [matiere('A', [11], { coefficient: 2 }), matiere('Sport', [12], { coefficient: 0 })] };
    expect(moyenneUE(ue).moyenne).toBe(11);
  });

  it('ne produit jamais une moyenne supérieure à 20', () => {
    const ue = {
      ects: 6,
      matieres: [
        matiere('A', [11], { coefficient: 2 }),
        matiere('Sport', [12], { coefficient: 0 }),
        matiere('Associatif', [14], { coefficient: 0 }),
      ],
    };
    // Avant correction : 11 + 12 + 14 = 37/20.
    expect(moyenneUE(ue).moyenne).toBeLessThanOrEqual(20);
    expect(moyenneUE(ue).moyenne).toBe(11);
  });

  it('une matière de coefficient nul mal notée ne fait pas monter la moyenne', () => {
    // Avant correction, un bonus à 2/20 portait une UE de 11 à 13.
    const ue = { ects: 6, matieres: [matiere('A', [11], { coefficient: 2 }), matiere('Sport', [2], { coefficient: 0 })] };
    expect(moyenneUE(ue).moyenne).toBe(11);
  });

  it('ignore un coefficient négatif ou illisible', () => {
    const ue = {
      ects: 6,
      matieres: [
        matiere('A', [10], { coefficient: 2 }),
        matiere('B', [20], { coefficient: -3 }),
        matiere('C', [20], { coefficient: 'deux' }),
      ],
    };
    expect(moyenneUE(ue).moyenne).toBe(10);
  });

  it('exclut une matière dispensée du calcul', () => {
    const ue = { ects: 6, matieres: [matiere('A', [10]), matiere('B', [2], { dispense: true })] };
    expect(moyenneUE(ue).moyenne).toBe(10);
  });

  it('propage la défaillance sans produire de NaN', () => {
    // Régression : `'DEF' * coef` valait NaN, qui se propageait jusqu'au
    // décompte d'ECTS et faisait basculer l'année en « Ajourné ».
    const ue = {
      ects: 6,
      matieres: [matiere('A', [15]), { nom: 'B', evaluations: [ev(null, 1, 'defaillant')] }],
    };
    const resultat = moyenneUE(ue);
    expect(resultat.moyenne).toBe(DEFAILLANT);
    expect(Number.isNaN(resultat.moyenne)).toBe(false);
    expect(resultat.validee).toBe(false);
  });

  it('considère acquise une UE au-dessus de 10', () => {
    const ue = { ects: 6, matieres: [matiere('A', [12])] };
    expect(moyenneUE(ue).validee).toBe(true);
  });

  it('considère acquise une UE entièrement dispensée', () => {
    const ue = { ects: 6, matieres: [matiere('A', [], { dispense: true })] };
    const resultat = moyenneUE(ue);
    expect(resultat.dispense).toBe(true);
    expect(resultat.validee).toBe(true);
  });

  it('ne déclare pas dispensée une UE sans matière', () => {
    expect(moyenneUE({ ects: 6, matieres: [] }).dispense).toBe(false);
  });

  it('renvoie null quand rien n\'est noté', () => {
    expect(moyenneUE({ ects: 6, matieres: [matiere('A', [])] }).moyenne).toBeNull();
  });
});

describe('moyenneSemestre', () => {
  const ueAvec = (nom, note, ects) => ({ nom, ects, matieres: [{ nom: 'M', evaluations: [ev(note)] }] });

  it('pondère les UE par leurs ECTS', () => {
    const sem = { ues: [ueAvec('UE1', 10, 3), ueAvec('UE2', 16, 9)] };
    expect(moyenneSemestre(sem).moyenne).toBe(14.5);
  });

  it('signale une compensation possible', () => {
    const sem = { ues: [ueAvec('UE1', 8, 6), ueAvec('UE2', 14, 6)] };
    const resultat = moyenneSemestre(sem);
    expect(resultat.moyenne).toBe(11);
    expect(resultat.compense).toBe(true);
    expect(resultat.ues[0].validee).toBe(false); // sous 10, mais rattrapée par le semestre
  });

  it('refuse la compensation sous la moyenne', () => {
    const sem = { ues: [ueAvec('UE1', 8, 6), ueAvec('UE2', 9, 6)] };
    expect(moyenneSemestre(sem).compense).toBe(false);
  });

  it('propage une défaillance au semestre entier', () => {
    const sem = {
      ues: [ueAvec('UE1', 15, 6), { nom: 'UE2', ects: 6, matieres: [{ nom: 'M', evaluations: [ev(null, 1, 'defaillant')] }] }],
    };
    const resultat = moyenneSemestre(sem);
    expect(resultat.moyenne).toBe(DEFAILLANT);
    expect(resultat.defaillant).toBe(true);
  });

  it('totalise les ECTS du semestre', () => {
    const sem = { ues: [ueAvec('UE1', 10, 3), ueAvec('UE2', 16, 9)] };
    expect(moyenneSemestre(sem).ectsTotal).toBe(12);
  });

  it('supporte un semestre vide', () => {
    expect(moyenneSemestre({ ues: [] }).moyenne).toBeNull();
    expect(moyenneSemestre(null).moyenne).toBeNull();
  });
});

describe('conformiteUE', () => {
  /*
   * Le règlement impose trois notes minimum par UE et interdit qu'une note pèse
   * plus de la moitié de la moyenne. ELPIS ne repondère pas — il signale que la
   * moyenne affichée est trop peu assise pour être lue comme un résultat.
   */
  const evNote = (note, coefficient = 1) => ({ note, coefficient });

  it("signale une UE qui n'a qu'une seule note", () => {
    const ue = { matieres: [{ nom: 'A', coefficient: 1, evaluations: [evNote(12)] }] };
    const r = conformiteUE(ue);
    expect(r.nbNotes).toBe(1);
    expect(r.partMax).toBe(1);
    expect(r.sousLeMinimum).toBe(true);
    expect(r.noteTropLourde).toBe(true);
    expect(r.conforme).toBe(false);
  });

  it('accepte trois notes de poids égal', () => {
    const ue = { matieres: [{ nom: 'A', coefficient: 1, evaluations: [evNote(12), evNote(14), evNote(8)] }] };
    const r = conformiteUE(ue);
    expect(r.nbNotes).toBe(3);
    expect(r.partMax).toBeCloseTo(1 / 3, 10);
    expect(r.conforme).toBe(true);
  });

  it('détecte une note qui pèse plus de la moitié malgré trois notes', () => {
    const ue = {
      matieres: [
        { nom: 'Examen', coefficient: 3, evaluations: [evNote(12)] },
        { nom: 'TP', coefficient: 1, evaluations: [evNote(14), evNote(8)] },
      ],
    };
    const r = conformiteUE(ue);
    expect(r.nbNotes).toBe(3);
    expect(r.partMax).toBeCloseTo(0.75, 10); // 3/4 pour la seule note d'examen
    expect(r.noteTropLourde).toBe(true);
    expect(r.sousLeMinimum).toBe(false);
  });

  it("pondère par le coefficient de l'évaluation", () => {
    const ue = {
      matieres: [{ nom: 'A', coefficient: 1, evaluations: [evNote(12, 3), evNote(14, 1)] }],
    };
    expect(conformiteUE(ue).partMax).toBeCloseTo(0.75, 10);
  });

  it('ignore les matières dispensées et les évaluations excusées', () => {
    const ue = {
      matieres: [
        { nom: 'A', coefficient: 1, evaluations: [evNote(12), evNote(14), evNote(10)] },
        { nom: 'B', dispense: true, coefficient: 5, evaluations: [evNote(3)] },
        { nom: 'C', coefficient: 1, evaluations: [{ note: 4, coefficient: 1, statut: 'excuse' }] },
      ],
    };
    const r = conformiteUE(ue);
    expect(r.nbNotes).toBe(3);
    expect(r.conforme).toBe(true);
  });

  it("ne compte pas une épreuve de coefficient nul parmi les trois attendues", () => {
    const ue = { matieres: [{ nom: 'A', coefficient: 1, evaluations: [
      evNote(12), evNote(14), evNote(10, 0),
    ] }] };
    const r = conformiteUE(ue);
    expect(r.nbNotes).toBe(2);
    expect(r.sousLeMinimum).toBe(true);
  });

  it('reste silencieuse sur une UE sans aucune note', () => {
    expect(conformiteUE({ matieres: [{ nom: 'A', evaluations: [] }] }).conforme).toBe(true);
    expect(conformiteUE(null).conforme).toBe(true);
    expect(conformiteUE({}).nbNotes).toBe(0);
  });

  it('ne compte pas une matière de coefficient nul', () => {
    const ue = {
      matieres: [
        { nom: 'A', coefficient: 2, evaluations: [evNote(12), evNote(14), evNote(10)] },
        { nom: 'Sport', coefficient: 0, evaluations: [evNote(18)] },
      ],
    };
    expect(conformiteUE(ue).nbNotes).toBe(3);
  });
});

describe('formaterMoyenne', () => {
  it('arrondit à deux décimales', () => {
    expect(formaterMoyenne(14.567)).toBe('14.57');
  });

  it('affiche la défaillance telle quelle', () => {
    expect(formaterMoyenne(DEFAILLANT)).toBe('DEF');
  });

  it('affiche un tiret en l\'absence de note', () => {
    expect(formaterMoyenne(null)).toBe('--');
    expect(formaterMoyenne(undefined)).toBe('--');
    expect(formaterMoyenne(NaN)).toBe('--');
  });
});

describe('mentionPour', () => {
  it('attribue la mention correspondante', () => {
    expect(mentionPour(17)).toBe('Très Bien');
    expect(mentionPour(14)).toBe('Bien');
    expect(mentionPour(12)).toBe('Assez Bien');
    expect(mentionPour(10)).toBe('Passable');
    expect(mentionPour(9.99)).toBe('Ajourné');
  });

  it('reste muette sans moyenne', () => {
    expect(mentionPour(null)).toBe('');
    expect(mentionPour(DEFAILLANT)).toBe('');
  });
});
