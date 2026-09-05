/**
 * Règles communes à toutes les validations d'exercice.
 *
 * Le Dashboard et la Session du Jour valident les mêmes exercices par deux chemins
 * différents. Tant que chacun calculait ses durées et ses difficultés dans son coin,
 * les deux écrivaient des valeurs divergentes dans la même base.
 */

/**
 * Durée à comptabiliser pour une validation, en minutes.
 *
 * Source unique de vérité : la même valeur alimente le `tempsMoyen` de l'exercice,
 * l'entrée d'historique et les barres de progression. Ces consommateurs calculaient
 * auparavant chacun leur repli, si bien qu'un TP d'étape 2 pesait 180 min dans ses
 * statistiques mais 30 min dans l'historique.
 */
export function dureeValidation(exo, elapsedMinutes, config, { etapeIndex = 0, estNouveauCM = false } = {}) {
  if (elapsedMinutes > 0) return elapsedMinutes;

  switch (exo?.type) {
    case 'CM':
      return estNouveauCM ? (config?.defaultDurationNewCM || 120) : (config?.defaultDurationRevCM || 30);
    case 'TD':
      return config?.defaultDurationTD || 20;
    case 'TP': {
      const etapes = [
        config?.defaultDurationTP_Etape1 || 45,
        config?.defaultDurationTP_Etape2 || 180,
        config?.defaultDurationTP_Etape3 || 90,
        config?.defaultDurationTP_Etape4 || 30
      ];
      return etapes[etapeIndex] || config?.defaultDurationTP || 45;
    }
    case 'ANNALE':
      return config?.defaultDurationAnnales || 60;
    case 'ANKI':
      return config?.defaultDurationAnki || 30;
    default:
      return exo?.dureeMinutes || 30;
  }
}

/**
 * Moyenne glissante du temps passé, pondérée sur les 5 dernières mesures.
 *
 * Une moyenne arithmétique classique fige l'estimation : après cinquante révisions,
 * une nouvelle mesure ne pèserait plus qu'un cinquante-et-unième et l'orchestrateur
 * ne verrait jamais un exercice devenir plus rapide.
 */
export function moyenneGlissante(moyenneActuelle, nombreMesures, nouvelleValeur) {
  const poids = Math.min(nombreMesures || 0, 4);
  return (((moyenneActuelle || 0) * poids) + nouvelleValeur) / (poids + 1);
}

/**
 * Difficulté déduite d'une note sur 20, dans le vocabulaire de `DIFFICULTY_LEVELS`.
 * Le moteur de score (`scoring.js`) n'accepte que ces clés : toute autre valeur est
 * silencieusement ramenée à « moyen ».
 */
export function difficulteDepuisNote(note) {
  if (note >= 18) return 'tres_facile';
  if (note >= 15) return 'facile';
  if (note >= 11) return 'moyen';
  if (note >= 9) return 'assez_difficile';
  return 'difficile';
}
