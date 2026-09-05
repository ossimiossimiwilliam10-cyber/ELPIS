/**
 * Préparation des travaux pratiques.
 *
 * Un TP ne se travaille pas comme un exercice : il a une date fixe, une séance
 * où tout se joue, et un rendu le jour même. Ce qui décide de la note se passe
 * donc avant — la séance ne fait que dérouler ce qui a été préparé.
 *
 * Le cycle codé ici reprend une méthode éprouvée sur deux semestres :
 *
 *   1. **Découverte** — lire le sujet, chercher les notions inconnues.
 *   2. **Planification** — simuler le TP en entier : tableaux, code,
 *      plan de route, et jusqu'à la rédaction avec des données fictives.
 *      Ces deux étapes se font le même jour, le samedi précédant le TP.
 *   3. **Vérification** — relire le travail *le lendemain*. La tête fraîche
 *      voit ce que la veille laissait passer : c'est le point clé, et le seul
 *      qui impose un intervalle.
 *   4. **Révision finale** — la veille, remise en mémoire.
 *   5. **Séance et rendu** — le jour J, où tout est déjà fait.
 *
 * Deux règles structurent le rétro-planning : les deux premières étapes vont
 * ensemble, la troisième jamais le même jour que la deuxième. L'ancien code
 * appliquait l'inverse — il interdisait deux étapes le même jour, et
 * n'imposait aucun délai avant la vérification.
 */

const { normalizeDateStr, parseDateLocal } = require('./utils');

const JOUR = 86400000;

/** Les cinq temps de la préparation, dans l'ordre. */
const ETAPES = [
  { rang: 1, cle: 'decouverte', nom: 'Découverte',
    intention: 'Lire le sujet, chercher ce qui manque.' },
  { rang: 2, cle: 'planification', nom: 'Planification',
    intention: 'Simuler le TP : tableaux, code, plan de route, rédaction à blanc.' },
  { rang: 3, cle: 'verification', nom: 'Vérification',
    intention: 'Relire à tête reposée, le lendemain de la planification.' },
  { rang: 4, cle: 'revision', nom: 'Révision finale',
    intention: 'Tout remettre en tête, la veille.' },
  { rang: 5, cle: 'seance', nom: 'Séance et rendu',
    intention: 'Dérouler ce qui est déjà prêt, et rendre.' },
];

/** Journée logique, au format « AAAA-MM-JJ » — la journée bascule à 4 h. */
function journee(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 4);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre de jours entiers entre deux dates. */
function joursEntre(depuis, jusqua) {
  const a = new Date(depuis); a.setHours(0, 0, 0, 0);
  const b = new Date(jusqua); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / JOUR);
}

/**
 * Samedi qui précède immédiatement une date.
 * C'est l'ouverture de la fenêtre de préparation : plus tôt, le sujet aurait le
 * temps de se refroidir avant la séance.
 */
function samediPrecedent(dateTP) {
  const d = new Date(dateTP);
  d.setHours(0, 0, 0, 0);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() !== 6);
  return d;
}

/** Étape en cours d'un TP, d'après le nombre de passages déjà faits. */
function etapeCourante(tp) {
  const faites = Math.max(0, Number(tp?.nombrePratiques) || 0);
  return ETAPES[faites] || null;
}

/**
 * Décide si un TP doit figurer au programme du jour, et à quelle étape.
 *
 * Renvoie `null` quand il n'a rien à y faire — cycle terminé, séance encore
 * lointaine, ou étape déjà accomplie aujourd'hui.
 */
function planifierTP(tp, maintenant = Date.now()) {
  const etape = etapeCourante(tp);
  if (!etape) return null; // les cinq temps sont passés

  const aujourdHui = journee(maintenant);
  const dejaFaitAujourdHui = normalizeDateStr(tp?.dernierePratique) === aujourdHui;

  // Sans date de séance, on retombe sur une préparation de week-end : c'est
  // tout ce qu'on peut dire d'un TP dont on ignore quand il a lieu.
  const brute = tp?.dateTP ? parseDateLocal(normalizeDateStr(tp.dateTP)) : null;
  if (!brute || Number.isNaN(brute.getTime())) {
    const jourSemaine = new Date(maintenant).getDay();
    const weekend = jourSemaine === 0 || jourSemaine === 6;
    if (!weekend || dejaFaitAujourdHui || etape.rang > 3) return null;
    return { etape, urgence: 'normale', motif: 'PREPARATION_WEEKEND', joursAvant: null };
  }

  const joursAvant = joursEntre(maintenant, brute);

  // --- Le jour de la séance ---
  if (joursAvant === 0) {
    return {
      etape: ETAPES[4],
      urgence: 'immediate',
      motif: 'SEANCE_AUJOURD_HUI',
      joursAvant: 0,
      // Toutes les étapes non faites sont rattrapées dans la foulée : mieux
      // vaut une préparation tardive qu'aucune.
      retard: 4 - (Number(tp?.nombrePratiques) || 0),
    };
  }

  // --- Séance passée : le cycle n'a plus lieu d'être ---
  if (joursAvant < 0) return null;

  // --- La veille : révision finale ---
  if (joursAvant === 1) {
    if (etape.rang >= 5) return null;
    return {
      // Si des étapes ont été sautées, on fait celle qui vient — pas la
      // révision d'un travail qui n'existe pas.
      etape,
      urgence: 'haute',
      motif: etape.rang === 4 ? 'REVISION_VEILLE' : 'RATTRAPAGE_VEILLE',
      joursAvant: 1,
    };
  }

  // --- Avant la veille : la fenêtre s'ouvre au samedi précédent ---
  const ouverture = samediPrecedent(brute);
  if (joursEntre(maintenant, ouverture) > 0) return null; // pas encore ouverte

  if (etape.rang >= 4) return null; // la révision finale attend la veille

  // Découverte et planification vont ensemble : les enchaîner dans la même
  // séance est précisément ce qui rend la simulation utile.
  if (etape.rang <= 2) {
    if (dejaFaitAujourdHui && etape.rang === 1) return null;
    return {
      etape,
      urgence: joursAvant <= 3 ? 'haute' : 'normale',
      motif: 'PREPARATION',
      joursAvant,
    };
  }

  // La vérification exige d'avoir dormi : jamais le jour de la planification.
  if (dejaFaitAujourdHui) return null;
  return { etape, urgence: 'normale', motif: 'VERIFICATION_LENDEMAIN', joursAvant };
}

/** Durée conseillée d'une étape, en minutes. */
function dureeEtape(rang, cfg = {}, tp = null) {
  const parDefaut = [
    cfg.defaultDurationTP_Etape1 || 45,
    cfg.defaultDurationTP_Etape2 || 180,
    cfg.defaultDurationTP_Etape3 || 90,
    cfg.defaultDurationTP_Etape4 || 30,
    cfg.defaultDurationTP_Seance || 120,
  ];

  // Le temps déjà constaté sur cette étape prime sur l'estimation.
  const mesures = tp?.tempsMoyenEtapes;
  const index = rang - 1;
  if (Array.isArray(mesures) && Number(mesures[index]) > 0) return Number(mesures[index]);

  return parDefaut[index] || 30;
}

/** Motif lisible, destiné à l'explication affichée sur la tâche. */
function motifLisible(plan) {
  if (!plan) return null;
  switch (plan.motif) {
    case 'SEANCE_AUJOURD_HUI':
      return plan.retard > 0
        ? `Séance aujourd'hui — ${plan.retard} étape${plan.retard > 1 ? 's' : ''} de préparation non faite${plan.retard > 1 ? 's' : ''}.`
        : "Séance aujourd'hui : tout est prêt.";
    case 'REVISION_VEILLE': return 'TP demain — dernière relecture.';
    case 'RATTRAPAGE_VEILLE': return 'TP demain et préparation incomplète.';
    case 'VERIFICATION_LENDEMAIN': return 'À relire à tête reposée.';
    case 'PREPARATION': return `TP dans ${plan.joursAvant} jours.`;
    case 'PREPARATION_WEEKEND': return 'Préparation de week-end (date de TP inconnue).';
    default: return null;
  }
}

module.exports = {
  ETAPES,
  planifierTP,
  etapeCourante,
  dureeEtape,
  motifLisible,
  samediPrecedent,
  joursEntre,
  journee,
};
