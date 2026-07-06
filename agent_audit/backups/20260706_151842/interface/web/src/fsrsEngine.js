import { fsrs, generatorParameters, Rating, State, createEmptyCard } from 'ts-fsrs';

// 1. Initialisation de l'instance FSRS
const params = generatorParameters({
  maximum_interval: 36500, // Standard FSRS: 100 ans, on évite le cap prématuré à 1 an
  request_retention: 0.90, // Taux de rétention cible optimal
});
const f = fsrs(params);

export { Rating, State };

/**
 * 2. Rétrocompatibilité (Fallback)
 * Convertit un exercice existant (format SM-2) en une carte compatible FSRS.
 */
export function migrateToFSRSCard(cm) {
  // BUG #1 fix: createEmptyCard est une fonction standalone, pas une méthode de l'instance
  let card = createEmptyCard();
  
  if (cm.jActuel !== undefined && cm.jActuel > 0) {
    // La carte était déjà en cours d'apprentissage dans l'ancien système SM-2
    card.state = State.Review;
    card.reps = cm.repetitions || 1;
    
    // On estime la Stabilité initiale en fonction de l'ancien intervalle
    card.stability = Math.max(1, cm.jActuel); 
    
    // On fixe une difficulté moyenne (intervalle valide : 1-10)
    card.difficulty = 5.0; 
    
    card.elapsed_days = cm.jActuel;
    card.scheduled_days = cm.jActuel;
    
    if (cm.derniereRevision) {
       // Reconstruire last_review
       card.last_review = new Date(cm.derniereRevision + 'T12:00:00');
       
       // Reconstruire l'échéance (due)
       let nextDate = new Date(card.last_review);
       nextDate.setDate(nextDate.getDate() + cm.jActuel);
       card.due = nextDate;
    } else {
       // BUG #4 fix: Fallback pour les cartes sans derniereRevision
       // On suppose que la dernière révision a eu lieu il y a jActuel jours
       card.last_review = new Date();
       card.last_review.setDate(card.last_review.getDate() - cm.jActuel);
       card.due = new Date(); // Révision due maintenant
    }
  }
  
  return card;
}

/**
 * 3. Le Wrapper d'évaluation
 * Évalue la carte avec FSRS et applique les mécaniques spécifiques d'ELPIS.
 */
export function evaluateFSRS(card, rating, personalizedDecayMultiplier = 1.0) {
  // Mécanique Night Owl : On recule l'horloge de 4h
  const now = new Date();
  now.setHours(now.getHours() - 4);
  
  // BUG #3 fix: Correction de la précédence d'opérateurs
  let validCard = card;
  if (!validCard || validCard.state === undefined) {
      validCard = createEmptyCard(now);
  }

  // Axe 9 : Vélocité FSRS Pure — on ajuste la stabilité AVANT f.repeat()
  // pour que le modèle DSR intègre mathématiquement la vélocité dans le calcul
  // de la prochaine stabilité, difficulté, et intervalle.
  if (personalizedDecayMultiplier !== 1.0 && validCard.stability > 0) {
     validCard.stability = Math.max(0.1, validCard.stability * personalizedDecayMultiplier);
  }

  // Évaluation FSRS (calcule les 4 issues possibles)
  const scheduling_cards = f.repeat(validCard, now);
  
  // On récupère le Record correspondant au rating choisi
  const nextRecord = scheduling_cards[rating];
  let newCard = nextRecord.card;
  
  return newCard;
}
