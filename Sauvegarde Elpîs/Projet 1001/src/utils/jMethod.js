// Les intervalles en jours pour la méthode des J sur 6 ans
export const J_INTERVALS = [
  0, 1, 3, 7, 14, 30, 60, 90, 180, 270, 365, 547, 730, 1095, 1460, 1825, 2190
];

/**
 * Calcule la prochaine date de révision basée sur la date initiale et l'index de l'intervalle actuel.
 * @param {string|Date} startDate La date où le cours a été vu pour la première fois.
 * @param {number} currentStepIndex L'index de l'étape actuelle dans J_INTERVALS.
 * @returns {Date|null} La prochaine date de révision ou null si toutes les étapes sont terminées.
 */
export const getNextRevisionDate = (startDate, currentStepIndex) => {
  if (currentStepIndex >= J_INTERVALS.length) {
    return null; // Fini !
  }
  
  const daysToAdd = J_INTERVALS[currentStepIndex];
  const date = new Date(startDate);
  // Remettre à minuit pour des comparaisons strictes par jour
  date.setHours(0, 0, 0, 0); 
  date.setDate(date.getDate() + daysToAdd);
  
  return date;
};

/**
 * Vérifie si une date correspond à aujourd'hui ou est dans le passé
 * @param {Date|string} dateToCheck 
 * @returns {boolean}
 */
export const isDueTodayOrPast = (dateToCheck) => {
  if (!dateToCheck) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const check = new Date(dateToCheck);
  check.setHours(0, 0, 0, 0);
  
  return check.getTime() <= today.getTime();
};

/**
 * Formate une date pour l'affichage
 * @param {Date|string} date 
 * @returns {string} Date formatée (ex: 12 oct. 2023)
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return new Intl.DateTimeFormat('fr-FR', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  }).format(d);
};
