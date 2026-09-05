import { describe, it, expect } from 'vitest';
import {
  parcourirMatieres, nomsDesMatieres, listesDe, resumerMatiere, resumerUE,
  resumerCursus, chercherDansCursus, indexSur,
} from './cursus';

const matiere = (nom, extra = {}) => ({
  nom, listeCM: [], listeTD: [], listeTP: [], listeAnnales: [], evaluations: [], ...extra,
});

const CURSUS = {
  licences: [{
    nom: 'L2 Physique',
    semestres: [
      {
        nom: 'S3',
        ues: [
          {
            nom: 'UE Maths', ects: 6,
            matieres: [
              matiere('Algèbre', {
                listeCM: [{ titre: 'Groupes', derniereRevision: '2026-09-01', prochaineRevisionDate: '2026-09-20' }, { titre: 'Anneaux' }],
                listeTD: [{ titre: 'TD1', nombrePratiques: 2 }, { titre: 'TD2' }],
                evaluations: [{ note: 14, coefficient: 1 }],
              }),
              matiere('Analyse', { listeCM: [{ titre: 'Suites' }] }),
            ],
          },
          { nom: 'UE Info', ects: 3, matieres: [matiere('Programmation')] },
        ],
      },
      { nom: 'S4', ues: [{ nom: 'UE Physique', ects: 6, matieres: [matiere('Mécanique')] }] },
    ],
  }],
};

describe('parcourirMatieres', () => {
  it('visite toutes les matières du cursus', () => {
    expect(parcourirMatieres(CURSUS).map(x => x.matiere.nom))
      .toEqual(['Algèbre', 'Analyse', 'Programmation', 'Mécanique']);
  });

  it('note le chemin d\'accès de chaque matière', () => {
    const analyse = parcourirMatieres(CURSUS).find(x => x.matiere.nom === 'Analyse');
    expect(analyse.chemin).toEqual({ lIndex: 0, sIndex: 0, uIndex: 0, mIndex: 1 });
  });

  it('remonte le contexte de chaque matière', () => {
    const meca = parcourirMatieres(CURSUS).find(x => x.matiere.nom === 'Mécanique');
    expect(meca.ue.nom).toBe('UE Physique');
    expect(meca.semestre.nom).toBe('S4');
    expect(meca.licence.nom).toBe('L2 Physique');
  });

  it('supporte un cursus absent ou vide', () => {
    expect(parcourirMatieres(null)).toEqual([]);
    expect(parcourirMatieres({ licences: [] })).toEqual([]);
    expect(parcourirMatieres({ licences: [{}] })).toEqual([]);
  });
});

describe('nomsDesMatieres', () => {
  it('dédoublonne et classe alphabétiquement', () => {
    expect(nomsDesMatieres(CURSUS)).toEqual(['Algèbre', 'Analyse', 'Mécanique', 'Programmation']);
  });

  it('ne retient pas une même matière suivie deux fois', () => {
    const doublon = { licences: [{ semestres: [
      { ues: [{ matieres: [matiere('Algèbre')] }] },
      { ues: [{ matieres: [matiere('Algèbre')] }] },
    ] }] };
    expect(nomsDesMatieres(doublon)).toEqual(['Algèbre']);
  });
});

describe('listesDe', () => {
  it('expose les quatre listes dans l\'ordre d\'affichage', () => {
    expect(listesDe(matiere('X')).map(l => l.type)).toEqual(['CM', 'TD', 'TP', 'ANNALE']);
  });

  it('tolère une matière sans listes', () => {
    expect(listesDe({}).every(l => Array.isArray(l.items))).toBe(true);
  });
});

describe('resumerMatiere', () => {
  const algebre = CURSUS.licences[0].semestres[0].ues[0].matieres[0];

  it('compte les éléments et ceux déjà travaillés', () => {
    const r = resumerMatiere(algebre);
    expect(r.total).toBe(4);      // 2 CM + 2 TD
    expect(r.travailles).toBe(2); // 1 CM révisé + 1 TD pratiqué
    expect(r.avancement).toBe(50);
  });

  it('détaille les effectifs par type', () => {
    expect(resumerMatiere(algebre).parType).toEqual({ CM: 2, TD: 2, TP: 0, ANNALE: 0 });
  });

  it('reprend la moyenne du bulletin', () => {
    expect(resumerMatiere(algebre).moyenne).toBe(14);
  });

  it('signale une matière défaillante sans produire de moyenne', () => {
    const r = resumerMatiere(matiere('X', { evaluations: [{ note: null, statut: 'defaillant' }] }));
    expect(r.defaillante).toBe(true);
    expect(r.moyenne).toBeNull();
  });

  it('indique la prochaine révision la plus proche', () => {
    const m = matiere('X', { listeCM: [
      { titre: 'A', prochaineRevisionDate: '2026-10-05' },
      { titre: 'B', prochaineRevisionDate: '2026-09-20' },
    ] });
    expect(resumerMatiere(m).prochaineRevision).toBe('2026-09-20');
  });

  it('laisse l\'avancement indéfini pour une matière vide', () => {
    expect(resumerMatiere(matiere('Vide')).avancement).toBeNull();
  });

  it('relève les statuts particuliers', () => {
    const r = resumerMatiere(matiere('X', { dispense: true, dette: true }));
    expect(r.dispensee).toBe(true);
    expect(r.dette).toBe(true);
  });
});

describe('resumerUE', () => {
  it('agrège l\'avancement de ses matières', () => {
    const ue = CURSUS.licences[0].semestres[0].ues[0];
    const r = resumerUE(ue);
    expect(r.nbMatieres).toBe(2);
    expect(r.total).toBe(5);      // Algèbre 4 + Analyse 1
    expect(r.travailles).toBe(2);
    expect(r.avancement).toBe(40);
  });

  it('reporte les ECTS', () => {
    expect(resumerUE(CURSUS.licences[0].semestres[0].ues[0]).ects).toBe(6);
  });

  it('supporte une UE vide', () => {
    const r = resumerUE({ nom: 'Vide', matieres: [] });
    expect(r.nbMatieres).toBe(0);
    expect(r.avancement).toBeNull();
    expect(r.moyenne).toBeNull();
  });
});

describe('resumerCursus', () => {
  it('dénombre l\'ensemble du cursus', () => {
    expect(resumerCursus(CURSUS)).toMatchObject({
      nbLicences: 1, nbMatieres: 4, nbCours: 3, nbExercices: 2,
    });
  });

  it('renvoie des zéros pour un cursus vide', () => {
    expect(resumerCursus({ licences: [] })).toMatchObject({ nbLicences: 0, nbMatieres: 0 });
  });
});

describe('chercherDansCursus', () => {
  it('trouve une matière par son nom', () => {
    const r = chercherDansCursus(CURSUS, 'Analyse');
    expect(r[0]).toMatchObject({ type: 'MATIERE', titre: 'Analyse' });
  });

  it('ignore les accents', () => {
    // Chercher « algebre » doit trouver « Algèbre ».
    expect(chercherDansCursus(CURSUS, 'algebre').length).toBeGreaterThan(0);
    expect(chercherDansCursus(CURSUS, 'MÉCANIQUE').length).toBeGreaterThan(0);
  });

  it('trouve un cours par son titre', () => {
    const r = chercherDansCursus(CURSUS, 'Groupes');
    expect(r[0]).toMatchObject({ type: 'CM', titre: 'Groupes' });
    expect(r[0].matiere.nom).toBe('Algèbre');
  });

  it('traverse toutes les licences et tous les semestres', () => {
    // La recherche de la Bibliothèque ne balayait que la licence affichée.
    const r = chercherDansCursus(CURSUS, 'Mécanique');
    expect(r[0].semestre.nom).toBe('S4');
  });

  it('cherche aussi dans les notes', () => {
    const avecNote = { licences: [{ semestres: [{ ues: [{ matieres: [
      matiere('X', { listeTD: [{ titre: 'TD1', notes: 'revoir le théorème de Rolle' }] }),
    ] }] }] }] };
    expect(chercherDansCursus(avecNote, 'Rolle')).toHaveLength(1);
  });

  it('ne renvoie rien pour un terme vide', () => {
    expect(chercherDansCursus(CURSUS, '')).toEqual([]);
    expect(chercherDansCursus(CURSUS, '   ')).toEqual([]);
  });

  it('borne le nombre de résultats', () => {
    expect(chercherDansCursus(CURSUS, 'e', 2)).toHaveLength(2);
  });
});

describe('indexSur', () => {
  it('ramène un index hors bornes dans la liste', () => {
    expect(indexSur(9, ['a', 'b'])).toBe(1);
    expect(indexSur(-3, ['a', 'b'])).toBe(0);
  });

  it('renvoie zéro pour une liste vide', () => {
    expect(indexSur(4, [])).toBe(0);
    expect(indexSur(0, undefined)).toBe(0);
  });
});
