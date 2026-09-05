/**
 * Équilibre entre théorie et pratique.
 *
 * La règle précédente interdisait tout exercice tant que 70 % des cours d'une
 * matière n'avaient pas été vus. Elle partait d'une intuition juste — on ne
 * résout pas un exercice sur une notion qu'on ignore — mais son application
 * produisait deux effets indésirables :
 *
 *   - en début de semestre, aucune matière n'atteint 70 %. Pendant six à huit
 *     semaines, plus aucun TD n'était proposé, alors que c'est précisément la
 *     période où les exercices ancrent le mieux les notions fraîches ;
 *   - la règle bloquait aussi les travaux pratiques. Or un TP a une date
 *     imposée : reporter sa préparation parce que la théorie n'est pas assez
 *     avancée, c'est arriver en séance sans l'avoir préparé.
 *
 * Le principe retenu tient en une phrase : la pratique ne doit pas prendre
 * d'avance sur la théorie, mais elle doit la suivre au plus près. Un cours vu
 * ouvre droit à quelques exercices ; le quota grandit avec le programme
 * parcouru, sans jamais imposer d'attente initiale.
 */

/** Cours à avoir vus avant de commencer les exercices d'une matière. */
const COURS_MINIMUM = 1;

/** Exercices que chaque cours vu autorise. */
const EXERCICES_PAR_COURS = 3;

/** Part des cours à avoir vus avant d'aborder les annales. */
const RATIO_ANNALES = 0.5;

/** Cours d'une matière déjà abordés au moins une fois. */
function coursVus(matiere) {
  return (matiere?.listeCM || []).filter(cm => cm?.derniereRevision).length;
}

/** Exercices dirigés déjà travaillés, tous passages confondus. */
function exercicesFaits(matiere) {
  return (matiere?.listeTD || []).filter(td => (td?.nombrePratiques || 0) > 0).length;
}

/**
 * La matière est-elle ouverte aux travaux dirigés ?
 *
 * Une matière sans cours enregistré n'est contrainte par rien : c'est le cas
 * de celles qui ne se travaillent que par la pratique, et rien ne justifie de
 * les bloquer.
 */
function autoriseTD(matiere) {
  const total = (matiere?.listeCM || []).length;
  if (total === 0) return { autorise: true, motif: 'aucun-cours' };

  const vus = coursVus(matiere);
  if (vus < COURS_MINIMUM) {
    return {
      autorise: false,
      motif: 'theorie-absente',
      message: 'Aborde d\'abord un premier cours de cette matière.',
    };
  }

  // Le quota grandit avec le programme parcouru : trois exercices par cours vu
  // suffisent à suivre, sans permettre d'épuiser toute la réserve sur les deux
  // premiers chapitres.
  const quota = vus * EXERCICES_PAR_COURS;
  const faits = exercicesFaits(matiere);
  if (faits >= quota) {
    return {
      autorise: false,
      motif: 'avance-sur-theorie',
      message: `${faits} exercices faits pour ${vus} cours vus : avance dans le cours avant d'aller plus loin.`,
      quota,
      faits,
    };
  }

  return { autorise: true, motif: 'equilibre', quota, faits, vus };
}

/**
 * Les travaux pratiques ne sont jamais bloqués.
 *
 * Leur date est imposée par l'emploi du temps, et toute la note se joue sur la
 * préparation. Les subordonner à l'avancement du cours revenait à sanctionner
 * un retard de théorie par un TP raté.
 */
function autoriseTP() {
  return { autorise: true, motif: 'date-imposee' };
}

/**
 * Les annales demandent, elles, une vraie assise.
 *
 * Un sujet d'examen porte sur l'ensemble du programme : s'y confronter trop
 * tôt ne mesure rien et décourage. Le seuil reste donc élevé, mais il cède
 * devant une échéance proche — mieux vaut une annale imparfaite que pas
 * d'annale du tout à trois semaines de l'épreuve.
 */
function autoriseAnnales(matiere, options = {}) {
  if (options.urgent) return { autorise: true, motif: 'echeance-proche' };
  if (options.dejaCommencees) return { autorise: true, motif: 'deja-entamees' };

  const total = (matiere?.listeCM || []).length;
  if (total === 0) return { autorise: true, motif: 'aucun-cours' };

  const part = coursVus(matiere) / total;
  if (part < RATIO_ANNALES) {
    return {
      autorise: false,
      motif: 'programme-trop-partiel',
      message: `${Math.round(part * 100)} % du cours vu : une annale porte sur l'ensemble du programme.`,
      part: Number(part.toFixed(2)),
    };
  }

  return { autorise: true, motif: 'assise-suffisante', part: Number(part.toFixed(2)) };
}

module.exports = {
  autoriseTD,
  autoriseTP,
  autoriseAnnales,
  coursVus,
  exercicesFaits,
  COURS_MINIMUM,
  EXERCICES_PAR_COURS,
  RATIO_ANNALES,
};
