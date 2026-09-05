import { consulter } from '../../../bridge/moteur/repetiteur';
import { definirTexteReglement } from '../../../bridge/moteur/repetiteur/reglement';
import { sourceExterne } from '../../../bridge/moteur/stockage';
import reglementBrut from '../../../../data/reglement_etudes.md?raw';
import logger from '../utils/logger';

/**
 * Le Répétiteur, sur l'appareil.
 *
 * Le moteur était embarqué, mais pas lui : le panneau interrogeait le PC par le
 * réseau. Câble débranché ou PC éteint, chaque question se terminait par « le
 * serveur est-il lancé ? » — alors que le téléphone tenait déjà toutes les
 * données nécessaires et calculait déjà son programme du jour tout seul. Le
 * Répétiteur ne fait que lire ces mêmes tables : rien ne justifiait qu'il ait
 * besoin d'un autre appareil pour répondre.
 *
 * C'est le même code que sur le PC, aux mêmes fichiers, comme pour le reste du
 * moteur. Deux choses seulement diffèrent :
 *
 *  — le règlement des études, que `reglement.js` lit sur le disque, est ici
 *    fourni en clair : il est embarqué dans le paquet à la compilation ;
 *  — la conversation, que le PC garde dans `data/espoir_chat.json`, vit ici
 *    dans le stockage local du navigateur. Elle est propre à l'appareil et ne
 *    se synchronise pas : ce sont des questions posées, pas des données
 *    d'étude.
 */

const CLE_CONVERSATION = 'elpis.repetiteur.conversation';
const MAX_MESSAGES = 200;

let reglementFourni = false;

/** Fournit le texte du règlement au moteur, une seule fois. */
function brancherReglement() {
  if (reglementFourni) return;
  try {
    definirTexteReglement(reglementBrut);
    reglementFourni = true;
  } catch (erreur) {
    // Le Répétiteur dira alors qu'il ne peut pas citer le règlement, ce qui
    // vaut infiniment mieux qu'une citation approximative.
    logger.error('Règlement des études indisponible sur cet appareil', erreur);
  }
}

/**
 * Répond à une question, sans réseau.
 *
 * Rend la même forme que `POST /api/chat`, pour que le panneau n'ait pas à
 * connaître deux protocoles.
 */
export function consulterLocal(question) {
  if (!sourceExterne()) {
    return {
      content: 'Le moteur n’est pas branché sur les données de cet appareil : je ne peux rien te dire de fiable.',
      intention: null,
      compris: false,
      calculeLocalement: true,
    };
  }

  brancherReglement();

  try {
    const reponse = consulter(question);
    return {
      content: reponse.texte,
      intention: reponse.intention,
      compris: reponse.compris,
      calculeLocalement: true,
    };
  } catch (erreur) {
    logger.error('Le Répétiteur a échoué sur cet appareil', erreur);
    return {
      content: 'Je n’ai pas réussi à établir cette réponse. Rien ne vaut un chiffre inventé : je préfère m’arrêter là.',
      intention: null,
      compris: false,
      calculeLocalement: true,
    };
  }
}

/** La conversation gardée sur cet appareil. */
export function lireConversationLocale() {
  try {
    const brut = localStorage.getItem(CLE_CONVERSATION);
    if (!brut) return [];
    const messages = JSON.parse(brut);
    return Array.isArray(messages) ? messages : [];
  } catch {
    // Navigation privée, stockage refusé, contenu corrompu : une conversation
    // perdue n'est pas une panne.
    return [];
  }
}

/** Enregistre la conversation, en la bornant. */
export function ecrireConversationLocale(messages) {
  try {
    const bornee = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    localStorage.setItem(CLE_CONVERSATION, JSON.stringify(bornee));
  } catch (erreur) {
    logger.error('Conversation du Répétiteur non enregistrée', erreur);
  }
}

/** Vide la conversation de cet appareil. */
export function viderConversationLocale() {
  try {
    localStorage.removeItem(CLE_CONVERSATION);
  } catch (erreur) {
    logger.error('Conversation du Répétiteur non vidée', erreur);
  }
}
