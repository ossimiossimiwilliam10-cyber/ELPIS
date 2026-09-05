/**
 * Durée d'un engagement fixe, en minutes.
 *
 * Reproduit exactement le calcul de l'orchestrateur (`orchestrateur.js`), y
 * compris le franchissement de minuit : une fin antérieure au début est comprise
 * comme le lendemain. Une inversion accidentelle (10:00 → 08:00) devient donc un
 * engagement de 22 h qui absorbe toute la journée — d'où l'intérêt d'afficher
 * cette durée à l'utilisateur plutôt que de la laisser agir en coulisse.
 */
export function dureeEngagementMin(start, end) {
  if (!start || !end) return 0;

  const [h1, m1] = String(start).split(':').map(Number);
  const [h2, m2] = String(end).split(':').map(Number);
  if ([h1, m1, h2, m2].some(v => !Number.isFinite(v))) return 0;

  const debut = h1 * 60 + m1;
  const fin = h2 * 60 + m2;

  return fin >= debut ? fin - debut : (24 * 60 - debut) + fin;
}

/** Durée lisible : « 2 h », « 45 min », « 1 h 30 ». */
export function formaterDuree(minutes) {
  if (!minutes) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Au-delà, la saisie résulte presque toujours d'une inversion des horaires. */
export const SEUIL_DUREE_SUSPECTE_MIN = 12 * 60;

/** Vrai si la durée mérite d'être signalée à l'utilisateur. */
export function dureeSuspecte(start, end) {
  return dureeEngagementMin(start, end) > SEUIL_DUREE_SUSPECTE_MIN;
}
