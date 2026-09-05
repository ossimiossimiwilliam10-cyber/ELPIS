const { rassembler } = require('./connaissances');
const { repondre } = require('./reponses');
const { reconnaitre, normaliser, matiereCitee } = require('./intentions');

/**
 * Le Répétiteur.
 *
 * L'ancien coach appelait une API distante en lui joignant un contexte lu dans
 * `data/espoir_cours.json` et `data/espoir_historique.json` — des fichiers
 * disparus lors du passage à SQLite. Il envoyait donc `{}` et `[]` : il ne
 * connaissait que le règlement de la licence, rien de l'étudiant, et facturait
 * chaque réponse.
 *
 * Celui-ci lit les vraies tables et répond par calcul. Sur les questions qui
 * portent sur les données — programme du jour, retards, moyennes, avancement —
 * c'est strictement supérieur : il ne peut pas inventer une note, et il dispose
 * toujours de l'état courant. Sur le reste, il dit qu'il ne sait pas.
 */
function consulter(question) {
  const faits = rassembler();
  const reponse = repondre(question, faits);
  return { ...reponse, aujourdHui: faits.aujourdHui };
}

module.exports = { consulter, rassembler, repondre, reconnaitre, normaliser, matiereCitee };
