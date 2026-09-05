/**
 * Pile d'annulation — rendre chaque action réversible, y compris celles
 * auxquelles personne n'a pensé.
 *
 * L'application savait créer bien mieux qu'elle ne savait défaire : une licence
 * ajoutée par mégarde restait pour toujours, faute d'un bouton. On peut
 * combler ces trous un par un — c'est nécessaire, et c'est fait — mais cela ne
 * couvrira jamais que les cas recensés. Il en restera toujours un.
 *
 * Une pile d'annulation prend le problème par l'autre bout : plutôt que de
 * prévoir une action inverse par action possible, on retient l'état d'avant.
 * Toute modification devient alors réversible du même geste, qu'il s'agisse
 * d'un ajout, d'une suppression, d'un renommage ou d'un réglage — et les
 * suppressions accidentelles, qu'aucun bouton ne rattrape, le deviennent aussi.
 *
 * Trois décisions méritent d'être expliquées.
 *
 *   1. ON RETIENT DES ÉTATS, PAS DES OPÉRATIONS. C'est plus coûteux en mémoire
 *      qu'un journal d'opérations inversibles, mais infiniment plus sûr : il n'y
 *      a pas d'inverse à écrire, donc pas d'inverse à écrire faux. Les données
 *      d'ELPIS sont déjà manipulées comme des documents entiers, à chaque
 *      sauvegarde ; on ne fait ici que garder les précédents.
 *
 *   2. LA PILE NE SURVIT PAS À LA FERMETURE. Annuler sert à réparer un geste
 *      qu'on vient de faire, pas à remonter le temps d'une session à l'autre.
 *      La conserver obligerait à arbitrer ce qu'elle devient après une
 *      synchronisation venue d'un autre appareil — question sans bonne réponse.
 *
 *   3. UNE NOUVELLE ACTION EFFACE LE FUTUR. Après avoir annulé puis fait autre
 *      chose, « rétablir » n'a plus de sens : l'état qu'on rétablirait n'est
 *      plus la suite de celui où l'on se trouve.
 */

/** Nombre de gestes conservés. Au-delà, les plus anciens tombent. */
export const PROFONDEUR = 25;

/** Pile neuve : rien à annuler, rien à rétablir. */
export const PILE_VIDE = Object.freeze({ passe: [], futur: [] });

/**
 * Enregistre un geste.
 *
 * Un geste qui ne change rien n'est pas enregistré : sans ce filtre, les
 * sauvegardes déclenchées par un simple affichage rempliraient la pile de
 * doublons, et « annuler » semblerait ne rien faire plusieurs fois de suite.
 */
export function empiler(pile, geste, profondeur = PROFONDEUR) {
  if (!geste || geste.avant === undefined || geste.apres === undefined) return pile;
  if (identiques(geste.avant, geste.apres)) return pile;

  const passe = [...(pile?.passe || []), geste];
  return {
    passe: passe.length > profondeur ? passe.slice(passe.length - profondeur) : passe,
    futur: [],
  };
}

/**
 * Retire le dernier geste et rend l'état à restaurer.
 * Le geste passe dans le futur : il reste rétablissable tant qu'aucun autre
 * ne vient le remplacer.
 */
export function annuler(pile) {
  const passe = pile?.passe || [];
  if (passe.length === 0) return { pile: pile || PILE_VIDE, geste: null, etat: undefined };

  const geste = passe[passe.length - 1];
  return {
    pile: { passe: passe.slice(0, -1), futur: [geste, ...(pile.futur || [])] },
    geste,
    etat: geste.avant,
  };
}

/** Refait le dernier geste annulé. */
export function retablir(pile) {
  const futur = pile?.futur || [];
  if (futur.length === 0) return { pile: pile || PILE_VIDE, geste: null, etat: undefined };

  const geste = futur[0];
  return {
    pile: { passe: [...(pile.passe || []), geste], futur: futur.slice(1) },
    geste,
    etat: geste.apres,
  };
}

/** Ce que « annuler » défera, pour pouvoir le nommer avant de le faire. */
export const prochaineAnnulation = (pile) => {
  const passe = pile?.passe || [];
  return passe.length ? passe[passe.length - 1] : null;
};

/** Ce que « rétablir » refera. */
export const prochainRetablissement = (pile) => (pile?.futur || [])[0] || null;

export const peutAnnuler = (pile) => (pile?.passe || []).length > 0;
export const peutRetablir = (pile) => (pile?.futur || []).length > 0;

/**
 * Égalité structurelle, pour reconnaître un geste sans effet.
 *
 * On compare par sérialisation plutôt que champ à champ : les états sont des
 * documents JSON, produits par immer, dont l'ordre des clés est stable d'une
 * copie à l'autre. Une comparaison approximative ici ne ferait qu'enregistrer
 * un geste vide de temps en temps — sans conséquence.
 */
function identiques(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
