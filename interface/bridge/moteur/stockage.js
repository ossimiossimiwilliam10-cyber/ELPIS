/**
 * D'où le moteur tire ses données.
 *
 * Le moteur a été écrit pour un seul lieu d'exécution : le PC, avec SQLite en
 * dessous. Le faire tourner aussi sur le téléphone posait la question de la
 * duplication — et un moteur dupliqué finit toujours par diverger. Deux calculs
 * qui s'écartent en silence, c'est précisément la classe de bugs que ce projet
 * passe son temps à corriger.
 *
 * Il n'y a donc qu'un moteur, et deux façons de lui donner à lire. Ce registre
 * est le seul point où la différence existe :
 *
 *   - sur le PC, aucune source n'est déclarée et tout se passe comme avant :
 *     les modules lisent SQLite directement, et pas une ligne de leur code ne
 *     change ;
 *   - sur le téléphone, l'application déclare une source qui lit la copie RxDB
 *     — celle-là même que la synchronisation entretient.
 *
 * L'asymétrie est volontaire : le chemin historique reste le chemin par défaut.
 * Un oubli de branchement ne peut donc pas casser le PC ; il ne peut que priver
 * le téléphone, ce qui se voit tout de suite.
 *
 * Une source doit fournir, en synchrone :
 *   lireConfig() · ecrireConfig(c)
 *   lireCours()  · ecrireCours(c)
 *   lireHistorique() · ecrireHistorique(h)
 *   lireProjets() · ecrireProjets(p)
 *
 * Le synchrone n'est pas un caprice : `genererRapportQuotidien` est synchrone de
 * bout en bout, et le rendre asynchrone contaminerait les trente-trois modules.
 * Côté téléphone, cela impose de tenir les documents en mémoire — ce que RxDB
 * fait déjà, puisque l'interface les lit à chaque rendu.
 */

/*
 * L'état vit sur `globalThis`, et non dans une variable de module.
 *
 * Ce n'est pas de la superstition : un même fichier CommonJS chargé une fois par
 * `require` et une fois par `import` donne deux instances, chacune avec sa
 * propre variable. Vérifié ici même — le registre déclaré d'un côté restait
 * invisible de l'autre, et le moteur continuait de lire SQLite en croyant obéir.
 *
 * Un registre dont l'unicité dépend de la façon dont on l'a chargé n'est pas un
 * registre. On l'ancre donc à un endroit qui, lui, est unique par construction.
 */
const CLE = Symbol.for('elpis.moteur.source');

const lireEtat = () => (globalThis[CLE] === undefined ? null : globalThis[CLE]);
const ecrireEtat = (v) => { globalThis[CLE] = v; };

/** Déclare la source de données. `null` rétablit la lecture SQLite directe. */
function definirSource(nouvelle) {
  if (nouvelle === null) { ecrireEtat(null); return; }

  const requis = [
    'lireConfig', 'ecrireConfig',
    'lireCours', 'ecrireCours',
    'lireHistorique', 'ecrireHistorique',
    'lireProjets', 'ecrireProjets',
  ];
  const manquants = requis.filter(m => typeof nouvelle?.[m] !== 'function');
  if (manquants.length > 0) {
    // Mieux vaut refuser bruyamment qu'accepter une source à moitié gréée :
    // le moteur lirait alors les bonnes données et écrirait dans le vide.
    throw new Error(`Source de données incomplète, il manque : ${manquants.join(', ')}`);
  }
  ecrireEtat(nouvelle);
}

/** La source déclarée, ou `null` si l'on est sur le chemin SQLite. */
const sourceCourante = () => lireEtat();

/** Vrai quand le moteur ne doit pas toucher SQLite. */
const sourceExterne = () => lireEtat() !== null;

module.exports = { definirSource, sourceCourante, sourceExterne };
