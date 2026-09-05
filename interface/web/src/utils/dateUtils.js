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

/**
 * Convertit un timestamp d'historique en date "logique" YYYY-MM-DD, avec la même
 * période de grâce Night Owl que getTodayStr(). Les entrées d'historique ne portent
 * qu'un `timestamp` ISO : c'est la seule façon correcte de les rattacher à un jour.
 *
 * @param {string|number|Date} timestamp
 * @returns {string|null} Date logique YYYY-MM-DD, ou null si le timestamp est invalide.
 */
export function toLogicalDateStr(timestamp) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;
  d.setHours(d.getHours() - 4);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Vrai si l'entrée d'historique appartient au jour logique courant.
 * @param {{timestamp?: string}} entry
 * @param {string} [todayStr] — jour de référence (par défaut : aujourd'hui)
 */
export function isFromToday(entry, todayStr = getTodayStr()) {
  return toLogicalDateStr(entry?.timestamp) === todayStr;
}

/**
 * Date locale à partir d'une valeur de calendrier, quelle que soit sa forme.
 *
 * Le découpage naïf sur les tirets suppose un `AAAA-MM-JJ` nu. Le simulateur
 * renvoie pourtant des instants complets (`2026-08-23T22:00:00.000Z`) : le
 * troisième morceau valait alors `23T22:00:00.000Z`, donc `NaN`, et les sept
 * en-têtes du Planning Annuel affichaient « Invalid Date ». Le repli ne
 * rattrapait rien, `toLocaleDateString` rendant la chaîne « Invalid Date »,
 * qui est vraie.
 *
 * On construit la date à midi, heure locale : à minuit, un décalage horaire
 * négatif ferait basculer l'affichage sur la veille.
 *
 * @returns {Date|null} `null` si la valeur ne décrit aucune date exploitable.
 */
export function dateCalendaire(valeur) {
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur;

  const texte = String(valeur ?? '').trim();
  if (!texte) return null;

  const parties = texte.split('T')[0].split('-').map(Number);
  if (parties.length < 3 || parties.some(n => !Number.isFinite(n))) return null;

  const [annee, mois, jour] = parties;
  const d = new Date(annee, mois - 1, jour, 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Instant où commence la journée logique contenant `reference`.
 *
 * Une fenêtre « des N derniers jours » exprimée en `maintenant - N × 24 h`
 * enjambe N + 1 journées calendaires : sept jours glissants contiennent huit
 * dates distinctes. L'écran affichait donc « 8 / 5 jours » pour un engagement
 * hebdomadaire, et une régularité de 103 % sur trente jours. Aligner le début
 * de la fenêtre sur une frontière de journée logique règle les deux.
 */
export function debutJourLogique(reference = Date.now()) {
  const d = new Date(reference);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() - 4);
  d.setHours(0, 0, 0, 0);
  d.setHours(d.getHours() + 4);
  return d.getTime();
}

/**
 * Début de la fenêtre couvrant exactement les `jours` dernières journées
 * logiques, journée en cours comprise.
 */
export function debutFenetreJours(jours, maintenant = Date.now()) {
  const n = Math.max(1, Number(jours) || 1);
  return debutJourLogique(maintenant - (n - 1) * 86400000);
}
