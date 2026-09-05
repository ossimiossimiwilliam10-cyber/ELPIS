export const DIFFICULTY_LEVELS = [
  { key: 'difficile', label: '🔴', title: 'Difficile' },
  { key: 'assez_difficile', label: '🟠', title: 'Assez difficile' },
  { key: 'moyen', label: '🟡', title: 'Moyen' },
  { key: 'facile', label: '🟢', title: 'Facile' },
  { key: 'tres_facile', label: '🔵', title: 'Très facile' },
];

/**
 * Niveaux de rétention de l'algorithme FSRS.
 *
 * L'échelle vivait en double : « Oublié / Difficile / Correct / Évident » dans
 * la Session du Jour, « Échec / Difficile / Bon / Facile » dans la modale de
 * l'Accueil — avec le jargon anglais en clair (« Oubli total (Again) »). Le même
 * geste, le plus répété de l'année, portait donc deux noms selon l'écran d'où on
 * le validait, et le texte d'accueil en annonçait un troisième.
 *
 * « Échec » a disparu au passage : tout le propos de l'application est que
 * répondre « oublié » n'est pas un échec mais une mesure, et que se surévaluer
 * coûte plus cher que l'inverse. Le mot travaillait contre le reste.
 *
 * Le libellé accompagne le chiffre : « 3 » seul n'apprend rien à qui découvre
 * l'échelle, et ce choix conditionne tout l'espacement des révisions à venir.
 */
export const RETENTION = [
  { note: 1, libelle: 'Oublié', couleur: 'var(--danger)', aide: 'Aucun souvenir : à reprendre depuis le début' },
  { note: 2, libelle: 'Difficile', couleur: 'var(--attention)', aide: 'Retrouvé avec effort' },
  { note: 3, libelle: 'Correct', couleur: 'var(--accent)', aide: 'Retenu, avec un peu de réflexion' },
  { note: 4, libelle: 'Évident', couleur: 'var(--succes)', aide: 'Immédiat et sûr' },
];
