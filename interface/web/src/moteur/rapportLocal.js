import { genererRapportQuotidien } from '../../../bridge/moteur/orchestrateur';
import { sourceExterne } from '../../../bridge/moteur/stockage';
import logger from '../utils/logger';

/**
 * Le programme du jour, calculé sur l'appareil.
 *
 * C'est ce qui rend le téléphone autonome. Jusqu'ici il demandait son rapport au
 * PC : PC éteint, ou câble débranché, et l'écran d'accueil restait vide — pour
 * une application dont tout l'intérêt est d'être consultée entre deux cours,
 * c'était la limite la plus gênante.
 *
 * Le moteur appelé ici est le même fichier que celui du PC, pas une adaptation.
 * Seule diffère la source qui l'alimente, et une suite de tests vérifie que les
 * deux produisent un rapport identique à partir des mêmes documents.
 *
 * Ce que le téléphone ne peut pas faire, en revanche : interroger Anki.
 * AnkiConnect écoute sur le port 8765 du PC. Le rapport local est donc produit
 * sans statistiques de cartes — et le dit, plutôt que de laisser croire que la
 * routine Anki a été prise en compte.
 */
export function calculerRapportLocal({ extraTime = 0, fillGap = false } = {}) {
  if (!sourceExterne()) {
    // Le moteur chercherait SQLite, absent ici. Mieux vaut le dire que rendre
    // un rapport bâti sur rien.
    return { error: 'MOTEUR_NON_BRANCHE' };
  }

  try {
    const rapport = genererRapportQuotidien(extraTime, fillGap, null);
    return {
      ...rapport,
      calculeLocalement: true,
      ankiIndisponible: true,
    };
  } catch (e) {
    logger.error('Calcul local du rapport', e);
    return { error: e?.message || 'MOTEUR_ERREUR', calculeLocalement: true };
  }
}
