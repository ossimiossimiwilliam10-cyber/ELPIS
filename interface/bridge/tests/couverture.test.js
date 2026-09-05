import { describe, it, expect } from 'vitest';
import {
  projeterCouverture, projeterCouvertureMatiere, synthetiserCouverture,
  coursRestants, echeanceDe,
} from '../moteur/couverture';

const MAINTENANT = new Date(2026, 9, 1, 12).getTime(); // 1er octobre 2026

/** « JJ-MM-AAAA » à `n` jours dans le futur. */
const dans = (n) => {
  const d = new Date(MAINTENANT + n * 86400000);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const vu = () => ({ titre: 'CM', derniereRevision: '2026-09-20' });
const neuf = () => ({ titre: 'CM' });

const matiere = (nom, vus, neufs, extra = {}) => ({
  nom,
  listeCM: [...Array.from({ length: vus }, vu), ...Array.from({ length: neufs }, neuf)],
  evaluations: [],
  ...extra,
});

const cursus = (matieres, semestre = {}) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', dateFin: dans(100), ues: [{ nom: 'UE1', matieres }], ...semestre }] }],
});

/** Deux heures de découverte par jour, cours neuf à 120 min. */
const CFG = { capaciteQuotidienneH: 6, cap: 'consolider', defaultDurationNewCM: 120 };

describe('coursRestants', () => {
  it('compte ce qui n\'a jamais été ouvert', () => {
    expect(coursRestants(matiere('M', 3, 5))).toEqual({ total: 8, abordes: 3, restants: 5 });
  });

  it('survit à une matière sans cours', () => {
    expect(coursRestants({})).toEqual({ total: 0, abordes: 0, restants: 0 });
  });
});

describe('echeanceDe', () => {
  it('retient la première épreuve à venir', () => {
    const m = { evaluations: [{ nom: 'DS', date: dans(30) }, { nom: 'Partiel', date: dans(60) }] };
    const e = echeanceDe(m, { dateFin: dans(100) }, MAINTENANT);
    expect(e.source).toBe('epreuve');
    expect(Math.round((e.date - MAINTENANT) / 86400000)).toBe(30);
  });

  it('ignore une épreuve déjà notée', () => {
    // Même règle que l'urgence d'examen : les deux ne doivent pas raconter
    // deux histoires différentes.
    const m = { evaluations: [{ nom: 'DS', date: dans(10), note: 14 }] };
    expect(echeanceDe(m, { dateFin: dans(100) }, MAINTENANT).source).toBe('semestre');
  });

  it('se rabat sur la fin du semestre', () => {
    expect(echeanceDe({ evaluations: [] }, { dateFin: dans(100) }, MAINTENANT).source).toBe('semestre');
  });

  it('ne trouve rien sans date connue', () => {
    expect(echeanceDe({}, {}, MAINTENANT)).toEqual({ date: null, source: 'aucune' });
  });
});

describe('projeterCouvertureMatiere', () => {
  // 120 min de découverte par jour, un cours neuf en 120 min : un cours par jour.
  const projeter = (m, jours, budget = 120) =>
    projeterCouvertureMatiere(m, { dateFin: dans(jours) }, budget, 120, MAINTENANT);

  it('juge tenable un programme largement en avance', () => {
    const p = projeter(matiere('Optique', 5, 5), 60);
    expect(p.joursNecessaires).toBe(5);
    expect(p.joursRestants).toBe(60);
    expect(p.etat).toBe('tenable');
  });

  it('signale un programme hors délai', () => {
    // Trente chapitres jamais ouverts, vingt jours devant : le compte n'y est
    // pas, et le dire en octobre laisse encore le temps d'agir.
    const p = projeter(matiere('Électromagnétisme', 2, 30), 20);
    expect(p.etat).toBe('hors-delai');
    expect(p.message).toMatch(/30 chapitres jamais ouverts/);
    expect(p.tension).toBeGreaterThan(1);
  });

  it('distingue un programme tendu d\'un programme hors délai', () => {
    const p = projeter(matiere('Thermo', 0, 19), 20);
    expect(p.etat).toBe('tendu');
    expect(p.message).toMatch(/sans un jour de perdu/);
  });

  it('reconnaît un programme entièrement abordé', () => {
    const p = projeter(matiere('Chimie', 8, 0), 30);
    expect(p.etat).toBe('couvert');
    expect(p.joursNecessaires).toBe(0);
  });

  it('ne projette rien sans échéance', () => {
    const p = projeterCouvertureMatiere(matiere('M', 1, 5), {}, 120, 120, MAINTENANT);
    expect(p.etat).toBe('inconnu');
    expect(p.message).toMatch(/Aucune échéance/);
  });

  it('ne projette rien sans cours enregistré', () => {
    const p = projeter(matiere('Vide', 0, 0), 30);
    expect(p.etat).toBe('inconnu');
  });

  it('signale un budget de découverte nul', () => {
    const p = projeter(matiere('M', 0, 5), 30, 0);
    expect(p.etat).toBe('inconnu');
    expect(p.message).toMatch(/ajuste ta capacité/);
  });
});

describe('projeterCouverture', () => {
  it('partage le temps de découverte entre les matières concernées', () => {
    // Projeter chaque matière sur la totalité du budget donnerait une vision
    // trop optimiste : elles se le disputent.
    const seule = projeterCouverture(cursus([matiere('A', 0, 10)]), CFG, MAINTENANT);
    const deux = projeterCouverture(cursus([matiere('A', 0, 10), matiere('B', 0, 10)]), CFG, MAINTENANT);

    expect(deux[0].joursNecessaires).toBeGreaterThan(seule[0].joursNecessaires);
  });

  it('classe les matières de la plus menacée à la plus sûre', () => {
    const c = projeterCouverture(cursus([
      matiere('Confortable', 10, 1),
      matiere('Menacée', 0, 40, { evaluations: [{ nom: 'DS', date: dans(10) }] }),
      matiere('Moyenne', 5, 5),
    ]), CFG, MAINTENANT);

    expect(c[0].nom).toBe('Menacée');
    expect(c[0].etat).toBe('hors-delai');
  });

  it('relègue les matières non projetables en fin de liste', () => {
    const c = projeterCouverture(cursus([matiere('Vide', 0, 0), matiere('Pleine', 0, 5)]), CFG, MAINTENANT);
    expect(c[0].nom).toBe('Pleine');
    expect(c[1].tension).toBeNull();
  });

  it('ignore une licence archivée', () => {
    const crs = cursus([matiere('M', 0, 5)]);
    crs.licences[0].archived = true;
    expect(projeterCouverture(crs, CFG, MAINTENANT)).toEqual([]);
  });

  it('survit à un cursus absent', () => {
    expect(projeterCouverture(null, CFG, MAINTENANT)).toEqual([]);
  });
});

describe('synthetiserCouverture', () => {
  it('dénombre les matières en difficulté', () => {
    const s = synthetiserCouverture(cursus([
      matiere('Menacée', 0, 40, { evaluations: [{ nom: 'DS', date: dans(10) }] }),
      matiere('Sûre', 10, 1),
    ]), CFG, MAINTENANT);

    expect(s.projetees).toBe(2);
    expect(s.horsDelai).toBe(1);
    expect(s.laPlusMenacee.nom).toBe('Menacée');
  });

  it('ne désigne aucune matière menacée quand tout tient', () => {
    const s = synthetiserCouverture(cursus([matiere('A', 10, 1)]), CFG, MAINTENANT);
    expect(s.laPlusMenacee).toBeNull();
    expect(s.horsDelai).toBe(0);
  });

  it('rappelle le temps quotidien alloué à la découverte', () => {
    const s = synthetiserCouverture(cursus([matiere('A', 0, 5)]), CFG, MAINTENANT);
    expect(s.budgetDecouverteMin).toBeGreaterThan(0);
  });

  it('ne produit jamais NaN', () => {
    const s = synthetiserCouverture(cursus([matiere('A', 0, 5)]), { capaciteQuotidienneH: 0 }, MAINTENANT);
    for (const m of s.matieres) {
      expect(Number.isNaN(m.tension)).toBe(false);
      expect(Number.isNaN(m.joursNecessaires)).toBe(false);
    }
  });
});
