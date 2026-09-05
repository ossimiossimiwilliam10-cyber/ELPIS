import { describe, it, expect } from 'vitest';
import {
  joursRestantsPourJustifier, estHorsDelai, exigeJustificatif, synthetiser, trierParDate, etatAbsence,
  DELAI_JUSTIFICATIF_JOURS,
} from './absences';

const LE_15 = new Date(2026, 8, 15, 14, 30); // 15 septembre 2026, 14h30 (local)

describe('joursRestantsPourJustifier', () => {
  it('accorde le délai entier le jour même', () => {
    // Régression : le calcul mélangeait une date lue en UTC et l'heure locale,
    // si bien que le jour de l'absence affichait déjà « 6 jours ».
    expect(joursRestantsPourJustifier('2026-09-15', LE_15)).toBe(DELAI_JUSTIFICATIF_JOURS);
  });

  it('décompte les jours écoulés', () => {
    expect(joursRestantsPourJustifier('2026-09-12', LE_15)).toBe(4);
    expect(joursRestantsPourJustifier('2026-09-08', LE_15)).toBe(0);
  });

  it('passe en négatif au-delà du délai', () => {
    expect(joursRestantsPourJustifier('2026-09-01', LE_15)).toBe(-7);
  });

  it('ne dépend pas de l\'heure de consultation', () => {
    const tot = new Date(2026, 8, 15, 0, 5);
    const tard = new Date(2026, 8, 15, 23, 55);
    expect(joursRestantsPourJustifier('2026-09-14', tot))
      .toBe(joursRestantsPourJustifier('2026-09-14', tard));
  });

  it('gère une date à venir', () => {
    expect(joursRestantsPourJustifier('2026-09-18', LE_15)).toBe(10);
  });

  it('renvoie null pour une date inexploitable', () => {
    expect(joursRestantsPourJustifier('')).toBeNull();
    expect(joursRestantsPourJustifier(null)).toBeNull();
    expect(joursRestantsPourJustifier('pas-une-date')).toBeNull();
  });
});

describe('exigeJustificatif', () => {
  it('distingue les enseignements concernés', () => {
    expect(exigeJustificatif('TP')).toBe(true);
    expect(exigeJustificatif('CM')).toBe(true);
    expect(exigeJustificatif('Langue')).toBe(true);
    expect(exigeJustificatif('TD')).toBe(false);
  });
});

describe('estHorsDelai', () => {
  const absence = (extra) => ({ date: '2026-09-01', type: 'TP', statut: 'Non Justifié', ...extra });

  it('signale un justificatif attendu depuis trop longtemps', () => {
    expect(estHorsDelai(absence(), LE_15)).toBe(true);
  });

  it('ignore une absence déjà justifiée', () => {
    expect(estHorsDelai(absence({ statut: 'Justifié' }), LE_15)).toBe(false);
    expect(estHorsDelai(absence({ statut: 'Dispensé' }), LE_15)).toBe(false);
  });

  it('ignore un TD, qui n\'exige pas de justificatif', () => {
    expect(estHorsDelai(absence({ type: 'TD' }), LE_15)).toBe(false);
  });

  it('reste tolérant dans le délai', () => {
    expect(estHorsDelai(absence({ date: '2026-09-12' }), LE_15)).toBe(false);
  });
});

describe('synthetiser', () => {
  const absences = [
    { date: '2026-09-14', type: 'TP', statut: 'Non Justifié' },   // à justifier
    { date: '2026-09-01', type: 'TP', statut: 'Non Justifié' },   // hors délai
    { date: '2026-09-10', type: 'TD', statut: 'Non Justifié' },   // sans justificatif requis
    { date: '2026-09-05', type: 'CM', statut: 'Justifié' },
    { date: '2026-09-06', type: 'Langue', statut: 'En Attente' },
  ];

  it('ventile les absences par état', () => {
    expect(synthetiser(absences, LE_15)).toEqual({
      total: 5, justifiees: 1, enAttente: 1, aJustifier: 1, horsDelai: 1,
    });
  });

  it('supporte une liste absente', () => {
    expect(synthetiser(null).total).toBe(0);
  });

  it('compte aussi les absences saisies sous l’ancienne forme', () => {
    // Deux formes coexistent en base : `statut`, écrit par cette page, et
    // `justifiee`, laissé par des saisies plus anciennes. Ne lire que la
    // première rangeait les secondes nulle part : elles gonflaient le total
    // sans jamais apparaître comme « à justifier ».
    const anciennes = [
      { date: '2026-09-14', type: 'TP', justifiee: false },
      { date: '2026-09-05', type: 'CM', justifiee: true },
    ];
    expect(synthetiser(anciennes, LE_15)).toEqual({
      total: 2, justifiees: 1, enAttente: 0, aJustifier: 1, horsDelai: 0,
    });
  });
});

describe('etatAbsence', () => {
  it('lit le statut quand il est écrit', () => {
    expect(etatAbsence({ statut: 'Dispensé' })).toBe('Dispensé');
  });

  it('retombe sur le booléen des anciennes saisies', () => {
    expect(etatAbsence({ justifiee: false })).toBe('Non Justifié');
    expect(etatAbsence({ justifiee: true })).toBe('Justifié');
  });

  it('ne tranche pas quand rien n’est renseigné', () => {
    expect(etatAbsence({})).toBe('');
  });
});

describe('trierParDate', () => {
  it('classe de la plus récente à la plus ancienne', () => {
    const trie = trierParDate([
      { date: '2026-09-01' }, { date: '2026-09-15' }, { date: '2026-09-08' },
    ]);
    expect(trie.map(a => a.date)).toEqual(['2026-09-15', '2026-09-08', '2026-09-01']);
  });

  it('ne modifie pas la liste d\'origine', () => {
    const original = [{ date: '2026-09-01' }, { date: '2026-09-15' }];
    trierParDate(original);
    expect(original[0].date).toBe('2026-09-01');
  });
});
