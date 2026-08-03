/**
 * Utilitaire de dates partagé — Source unique de vérité pour la "période de grâce" Night Owl (-4h).
 * 
 * getTodayStr() : Retourne la date "logique" du jour au format YYYY-MM-DD.
 * Si l'utilisateur travaille après minuit (jusqu'à 4h du matin), la date retournée
 * est celle de la veille, afin que le travail nocturne soit comptabilisé correctement.
 */

/**
 * @returns {string} Date du jour au format YYYY-MM-DD, avec période de grâce Night Owl de 4h.
 */
export function getTodayStr() {
  const d = new Date();
  d.setHours(d.getHours() - 4);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
