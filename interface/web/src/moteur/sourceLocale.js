import useStore from '../store';
import { definirSource } from '../../../bridge/moteur/stockage';

/**
 * La source de données du moteur, côté appareil.
 *
 * Le moteur lit en synchrone : `genererRapportQuotidien` l'est de bout en bout,
 * et le rendre asynchrone contaminerait les trente-trois modules pour un gain
 * nul. Or RxDB, lui, est asynchrone. La conciliation ne demande pourtant aucune
 * acrobatie : le store tient déjà ces quatre documents en mémoire — c'est de là
 * que l'interface les affiche à chaque rendu — et RxDB les y a déposés au
 * démarrage. On lit donc le store, qui est la projection synchrone de RxDB.
 *
 * Les écritures repassent par les mutateurs du store, et non par RxDB
 * directement : ce sont eux qui déclenchent la persistance locale, préviennent
 * les composants abonnés et alimentent la réconciliation. Court-circuiter cette
 * chaîne produirait des données que l'écran ne verrait pas et que la
 * synchronisation ne transporterait jamais.
 */

const etat = () => useStore.getState();

/**
 * Le moteur reçoit des copies, jamais l'état du store lui-même.
 *
 * Deux raisons, et la première s'est manifestée dès le premier essai sur
 * l'appareil : le store est gelé par Immer, et l'orchestrateur annote les objets
 * qu'il parcourt — il attache un `_ueMatieres` à chaque matière pour retrouver
 * son UE. Sur un objet figé, l'écriture échoue, et tout le rapport tombait avec
 * elle : « Cannot add property _ueMatieres, object is not extensible ». L'écran
 * d'accueil montrait alors un cursus vide, exactement comme s'il n'y avait rien
 * à afficher.
 *
 * La seconde raison vaut même sans gel : un moteur qui écrirait directement dans
 * l'état du store le modifierait dans le dos de React, sans déclencher de rendu
 * et sans passer par la persistance. Une copie coûte quelques millisecondes par
 * rapport ; elle évite une classe entière de bugs invisibles.
 */
const copier = (valeur, defaut) => {
  if (valeur === undefined || valeur === null) return defaut;
  try {
    return structuredClone(valeur);
  } catch {
    // `structuredClone` refuse fonctions et proxies ; le détour par JSON suffit
    // pour des documents de données.
    try { return JSON.parse(JSON.stringify(valeur)); } catch { return defaut; }
  }
};

export const sourceLocale = {
  lireConfig: () => copier(etat().config, {}),
  ecrireConfig: (c) => etat().setConfig(c),

  lireCours: () => copier(etat().coursConfig, { licences: [] }),
  ecrireCours: (c) => etat().setCoursConfig(c),

  lireHistorique: () => copier(etat().historique, []),
  ecrireHistorique: (h) => etat().setHistorique(h),

  lireProjets: () => copier(etat().projets, []),
  ecrireProjets: (p) => etat().setProjets(p),
};

let branchee = false;

/**
 * Branche le moteur sur les données de cet appareil.
 *
 * Appelé une seule fois, au démarrage. Tant que ce n'est pas fait, le moteur
 * chercherait SQLite — absent ici — et le substitut lèverait une erreur nommée
 * plutôt que de rendre un chiffre inventé.
 */
export function brancherMoteurLocal() {
  if (branchee) return;
  definirSource(sourceLocale);
  branchee = true;
}

/** Utilisé par les tests pour repartir d'un état propre. */
export function debrancherMoteurLocal() {
  definirSource(null);
  branchee = false;
}
