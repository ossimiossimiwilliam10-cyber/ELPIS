import { describe, it, expect } from 'vitest';
import {
  PROFONDEUR, PILE_VIDE, empiler, annuler, retablir,
  peutAnnuler, peutRetablir, prochaineAnnulation, prochainRetablissement,
} from './annulation';

/** Geste minimal : un état avant, un état après, un nom. */
const geste = (avant, apres, libelle = 'Geste') => ({ avant, apres, libelle, collection: 'config' });

describe('Pile — enregistrement', () => {
  it('retient un geste', () => {
    const pile = empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    expect(peutAnnuler(pile)).toBe(true);
    expect(prochaineAnnulation(pile).libelle).toBe('Geste');
  });

  it('ignore un geste qui ne change rien', () => {
    // Les sauvegardes déclenchées par un simple affichage rempliraient sinon
    // la pile de doublons, et « annuler » semblerait ne rien faire.
    const pile = empiler(PILE_VIDE, geste({ a: 1 }, { a: 1 }));
    expect(peutAnnuler(pile)).toBe(false);
  });

  it('reconnaît l’égalité en profondeur, pas seulement par référence', () => {
    const pile = empiler(PILE_VIDE, geste({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
    expect(peutAnnuler(pile)).toBe(false);
  });

  it('ignore un geste incomplet', () => {
    expect(peutAnnuler(empiler(PILE_VIDE, null))).toBe(false);
    expect(peutAnnuler(empiler(PILE_VIDE, { avant: { a: 1 } }))).toBe(false);
    expect(peutAnnuler(empiler(PILE_VIDE, { apres: { a: 1 } }))).toBe(false);
  });

  it('ne conserve que les gestes les plus récents', () => {
    let pile = PILE_VIDE;
    for (let i = 0; i < PROFONDEUR + 10; i += 1) {
      pile = empiler(pile, geste({ n: i }, { n: i + 1 }, `Geste ${i}`));
    }
    expect(pile.passe).toHaveLength(PROFONDEUR);
    expect(prochaineAnnulation(pile).libelle).toBe(`Geste ${PROFONDEUR + 9}`);
  });

  it('respecte une profondeur imposée', () => {
    let pile = PILE_VIDE;
    for (let i = 0; i < 8; i += 1) pile = empiler(pile, geste({ n: i }, { n: i + 1 }), 3);
    expect(pile.passe).toHaveLength(3);
  });
});

describe('Pile — annulation', () => {
  it('rend l’état d’avant le dernier geste', () => {
    const pile = empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    const { etat, geste: defait } = annuler(pile);
    expect(etat).toEqual({ a: 1 });
    expect(defait.libelle).toBe('Geste');
  });

  it('défait les gestes du plus récent au plus ancien', () => {
    let pile = empiler(PILE_VIDE, geste({ n: 0 }, { n: 1 }, 'Premier'));
    pile = empiler(pile, geste({ n: 1 }, { n: 2 }, 'Second'));

    const un = annuler(pile);
    expect(un.geste.libelle).toBe('Second');
    expect(un.etat).toEqual({ n: 1 });

    const deux = annuler(un.pile);
    expect(deux.geste.libelle).toBe('Premier');
    expect(deux.etat).toEqual({ n: 0 });

    expect(peutAnnuler(deux.pile)).toBe(false);
  });

  it('ne fait rien sur une pile vide', () => {
    const { geste: aucun, etat } = annuler(PILE_VIDE);
    expect(aucun).toBeNull();
    expect(etat).toBeUndefined();
  });

  it('accepte une pile absente sans lever', () => {
    expect(() => annuler(undefined)).not.toThrow();
    expect(() => retablir(null)).not.toThrow();
  });
});

describe('Pile — rétablissement', () => {
  it('refait ce qui vient d’être annulé', () => {
    const pile = empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    const apresAnnulation = annuler(pile);
    expect(peutRetablir(apresAnnulation.pile)).toBe(true);

    const { etat, geste: refait } = retablir(apresAnnulation.pile);
    expect(etat).toEqual({ a: 2 });
    expect(refait.libelle).toBe('Geste');
  });

  it('un nouveau geste efface le futur', () => {
    // Après avoir annulé puis fait autre chose, « rétablir » n'a plus de sens :
    // l'état rétabli ne serait plus la suite de celui où l'on se trouve.
    const pile = empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    const annulee = annuler(pile).pile;
    expect(peutRetablir(annulee)).toBe(true);

    const apresNouveauGeste = empiler(annulee, geste({ a: 1 }, { a: 9 }, 'Autre'));
    expect(peutRetablir(apresNouveauGeste)).toBe(false);
    expect(prochainRetablissement(apresNouveauGeste)).toBeNull();
  });

  it('ne fait rien quand il n’y a rien à rétablir', () => {
    expect(retablir(PILE_VIDE).geste).toBeNull();
  });

  it('supporte plusieurs allers-retours', () => {
    let pile = empiler(PILE_VIDE, geste({ n: 0 }, { n: 1 }, 'A'));
    pile = empiler(pile, geste({ n: 1 }, { n: 2 }, 'B'));

    pile = annuler(pile).pile;
    pile = annuler(pile).pile;
    expect(peutAnnuler(pile)).toBe(false);

    const refaitA = retablir(pile);
    expect(refaitA.geste.libelle).toBe('A');
    const refaitB = retablir(refaitA.pile);
    expect(refaitB.geste.libelle).toBe('B');
    expect(refaitB.etat).toEqual({ n: 2 });
    expect(peutRetablir(refaitB.pile)).toBe(false);
  });
});

describe('Pile — immuabilité', () => {
  it('n’altère jamais la pile qu’on lui donne', () => {
    const depart = empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    const copie = JSON.parse(JSON.stringify(depart));

    annuler(depart);
    empiler(depart, geste({ a: 2 }, { a: 3 }));

    expect(depart).toEqual(copie);
  });

  it('la pile vide partagée reste vide', () => {
    empiler(PILE_VIDE, geste({ a: 1 }, { a: 2 }));
    expect(PILE_VIDE.passe).toHaveLength(0);
  });
});
