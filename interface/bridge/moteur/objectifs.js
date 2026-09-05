/**
 * Objectifs et progression.
 *
 * Le système précédent pilotait la charge de travail par une note visée et un
 * rang visé. Trois défauts en découlaient :
 *
 *   1. L'effort exigé croissait linéairement avec l'ambition — viser 18 plutôt
 *      que 14 réclamait 40 % de temps en plus. C'est faux : l'écart entre 14 et
 *      18 se joue sur la *nature* du travail (récupération active, exercices
 *      difficiles, annales) bien plus que sur son volume.
 *   2. L'effort restant était divisé par les jours restants, si bien que tout
 *      retard augmentait mécaniquement l'exigence quotidienne — jusqu'au
 *      plafond de dix heures. Prendre du retard rendait donc le rattrapage
 *      toujours plus improbable, ce qui est exactement la spirale qu'un outil
 *      d'accompagnement doit éviter.
 *   3. L'objectif était un résultat lointain, atteint ou non. Tant qu'il n'est
 *      pas atteint — c'est-à-dire presque toujours — l'étudiant est en échec.
 *
 * Le modèle retenu inverse la logique : l'étudiant déclare le temps qu'il peut
 * réellement donner, et le système décide de son *emploi*, jamais de son
 * volume. L'ambition ne règle plus la quantité d'heures mais leur répartition
 * entre découverte, entretien et entraînement. La note projetée redevient ce
 * qu'elle aurait toujours dû être : un thermomètre, pas une cible.
 *
 * S'y ajoutent des objectifs de processus — des engagements hebdomadaires
 * atteignables — et des paliers franchissables qui rendent la progression
 * visible avant que les notes ne tombent.
 */

/**
 * Les trois régimes de travail.
 *
 * `repartition` indique la part du temps allouée à chaque usage :
 *   - `decouverte` : nouveaux cours, avancer dans le programme ;
 *   - `entretien`  : révisions espacées de ce qui est déjà vu ;
 *   - `entrainement` : TD, TP et annales, la mise en application.
 *
 * Viser haut ne veut pas dire travailler plus longtemps : cela veut dire
 * consacrer une part nettement plus grande à l'entraînement, là où se gagnent
 * les points au-delà de 14.
 */
const CAPS = {
  consolider: {
    libelle: 'Consolider',
    intention: 'Sécuriser la moyenne et ne plus subir les échéances.',
    joursParSemaine: 4,
    repartition: { decouverte: 0.45, entretien: 0.4, entrainement: 0.15 },
  },
  progresser: {
    libelle: 'Progresser',
    intention: 'Gagner des points sur la moyenne, régulièrement.',
    joursParSemaine: 5,
    repartition: { decouverte: 0.35, entretien: 0.35, entrainement: 0.3 },
  },
  'viser-haut': {
    libelle: 'Viser haut',
    intention: 'Jouer les premières places, en acceptant l\'exigence.',
    joursParSemaine: 6,
    repartition: { decouverte: 0.25, entretien: 0.3, entrainement: 0.45 },
  },
};

const CAP_DEFAUT = 'progresser';

/** Capacité déclarée par défaut, en heures par jour travaillé. */
const CAPACITE_DEFAUT = 2.5;

/** Bornes de la capacité déclarable : au-delà, ce n'est plus soutenable. */
const CAPACITE_MIN = 0.5;
const CAPACITE_MAX = 8;

const JOUR = 86400000;

/** Régime de travail correspondant à une clé, ou le régime par défaut. */
function capDe(cle) {
  return CAPS[cle] || CAPS[CAP_DEFAUT];
}

/** Capacité quotidienne retenue, bornée à ce qu'un humain peut tenir. */
function capaciteRetenue(config) {
  const declaree = Number(config?.capaciteQuotidienneH);
  if (!Number.isFinite(declaree)) return CAPACITE_DEFAUT;
  return Math.max(CAPACITE_MIN, Math.min(CAPACITE_MAX, declaree));
}

/**
 * Budget de la journée, en minutes, réparti par usage.
 *
 * Ce budget ne dépend ni du retard accumulé ni de l'ambition affichée : il
 * découle de ce que l'étudiant a déclaré pouvoir donner. Un programme trop
 * lourd se traite en réduisant le périmètre, pas en allongeant les journées.
 */
function budgetQuotidien(config) {
  const cap = capDe(config?.cap);
  const minutes = Math.round(capaciteRetenue(config) * 60);

  return {
    total: minutes,
    decouverte: Math.round(minutes * cap.repartition.decouverte),
    entretien: Math.round(minutes * cap.repartition.entretien),
    entrainement: Math.round(minutes * cap.repartition.entrainement),
  };
}

/** Journée logique d'un horodatage — la journée bascule à 4 h du matin. */
function journeeLogique(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 4);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Journées distinctes travaillées sur les `jours` derniers jours. */
function joursTravailles(historique, jours, maintenant = Date.now()) {
  /*
   * Une fenêtre exprimée en `maintenant - N × 24 h` enjambe N + 1 journées
   * calendaires : sept jours glissants contiennent huit dates distinctes.
   * L’écran affichait donc « 8 / 5 jours » pour un engagement hebdomadaire, et
   * l'engagement se déclarait tenu sur cette seule arithmétique. On construit
   * donc la fenêtre à partir des journées logiques elles-mêmes.
   */
  const fenetre = new Set();
  for (let i = 0; i < Math.max(1, jours); i++) fenetre.add(journeeLogique(maintenant - i * JOUR));

  const distinctes = new Set();
  for (const h of historique || []) {
    const t = new Date(h?.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const jour = journeeLogique(t);
    if (fenetre.has(jour)) distinctes.add(jour);
  }
  return distinctes.size;
}

/** Nombre de semaines consécutives ayant atteint l'engagement de jours. */
function semainesTenues(historique, joursRequis, maintenant = Date.now()) {
  let compte = 0;
  for (let semaine = 0; semaine < 26; semaine++) {
    const fin = maintenant - semaine * 7 * JOUR;
    const debut = fin - 7 * JOUR;
    const distinctes = new Set();
    for (const h of historique || []) {
      const t = new Date(h?.timestamp).getTime();
      if (Number.isFinite(t) && t > debut && t <= fin) distinctes.add(journeeLogique(t));
    }
    if (distinctes.size < joursRequis) break;
    compte++;
  }
  return compte;
}

/** Parcourt les matières actives du cursus. */
function matieresActives(cursus) {
  const liste = [];
  for (const licence of cursus?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestre.archived === true || String(semestre.archived).toLowerCase() === 'true') continue;
      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          if (matiere?.nom) liste.push(matiere);
        }
      }
    }
  }
  return liste;
}

/** Part des cours ayant dépassé un seuil de stabilité mémoire. */
function partStabilite(cursus, seuilJours) {
  let total = 0;
  let atteints = 0;
  for (const matiere of matieresActives(cursus)) {
    for (const cm of matiere.listeCM || []) {
      total++;
      const s = Number(cm?.fsrsCard?.stability) || Number(cm?.jActuel) || 0;
      if (s >= seuilJours) atteints++;
    }
  }
  return total === 0 ? null : atteints / total;
}

/** Matières travaillées au moins une fois sur la fenêtre donnée. */
function matieresTouchees(historique, jours, maintenant = Date.now()) {
  const debut = maintenant - jours * JOUR;
  const noms = new Set();
  for (const h of historique || []) {
    const t = new Date(h?.timestamp).getTime();
    if (Number.isFinite(t) && t >= debut && h.matiere) noms.add(h.matiere);
  }
  return noms;
}

/**
 * Paliers de progression.
 *
 * Chacun se franchit en une à trois semaines et ne dépend d'aucune note : ce
 * sont des états du travail, observables bien avant les résultats. Le dernier
 * ne dit pas « tu as réussi » mais « le système est en place » — ce qui est la
 * seule chose qu'un outil puisse honnêtement promettre.
 */
const PALIERS = [
  {
    cle: 'demarrage',
    titre: 'Premiers pas',
    critere: 'Trois journées de travail sur les sept derniers jours.',
    mesure: (ctx) => ({ valeur: joursTravailles(ctx.historique, 7, ctx.maintenant), cible: 3 }),
  },
  {
    cle: 'semaine-pleine',
    titre: 'Une semaine tenue',
    critere: 'Une semaine complète à l\'engagement que tu t\'es fixé.',
    mesure: (ctx) => ({ valeur: semainesTenues(ctx.historique, ctx.joursParSemaine, ctx.maintenant), cible: 1 }),
  },
  {
    cle: 'reserve',
    titre: 'Réserve constituée',
    critere: 'Au moins une matière dispose de sept exercices jamais travaillés.',
    mesure: (ctx) => {
      const meilleure = matieresActives(ctx.cursus).reduce((max, m) => {
        const dispo = (m.listeTD || []).filter(td => !(td.nombrePratiques > 0)).length;
        return Math.max(max, dispo);
      }, 0);
      return { valeur: meilleure, cible: 7 };
    },
  },
  {
    cle: 'memoire-amorcee',
    titre: 'Mémoire amorcée',
    critere: 'Un quart de tes cours tiennent au moins une semaine en mémoire.',
    mesure: (ctx) => {
      const part = partStabilite(ctx.cursus, 7);
      return { valeur: part === null ? 0 : Math.round(part * 100), cible: 25 };
    },
  },
  {
    cle: 'regularite',
    titre: 'Régularité installée',
    critere: 'Trois semaines consécutives à ton engagement.',
    mesure: (ctx) => ({ valeur: semainesTenues(ctx.historique, ctx.joursParSemaine, ctx.maintenant), cible: 3 }),
  },
  {
    cle: 'couverture',
    titre: 'Aucune matière délaissée',
    critere: 'Toutes tes matières ont été travaillées dans les quinze derniers jours.',
    mesure: (ctx) => {
      const total = matieresActives(ctx.cursus).length;
      const touchees = matieresTouchees(ctx.historique, 15, ctx.maintenant);
      const couvertes = matieresActives(ctx.cursus).filter(m => touchees.has(m.nom)).length;
      return { valeur: couvertes, cible: Math.max(1, total) };
    },
  },
  {
    cle: 'memoire-consolidee',
    titre: 'Mémoire consolidée',
    critere: 'La moitié de tes cours tiennent trois semaines en mémoire.',
    mesure: (ctx) => {
      const part = partStabilite(ctx.cursus, 21);
      return { valeur: part === null ? 0 : Math.round(part * 100), cible: 50 };
    },
  },
  {
    cle: 'croisiere',
    titre: 'Rythme de croisière',
    critere: 'Six semaines consécutives à ton engagement.',
    mesure: (ctx) => ({ valeur: semainesTenues(ctx.historique, ctx.joursParSemaine, ctx.maintenant), cible: 6 }),
  },
];

/**
 * État de la progression.
 *
 * Renvoie les paliers franchis, celui en cours et sa progression exacte. Un
 * seul palier est « en cours » à la fois : afficher huit objectifs simultanés
 * disperse au lieu d'orienter.
 */
function evaluerPaliers(config, historique, cursus, maintenant = Date.now()) {
  const cap = capDe(config?.cap);
  const contexte = {
    historique: historique || [],
    cursus,
    maintenant,
    joursParSemaine: cap.joursParSemaine,
  };

  const evalues = PALIERS.map(palier => {
    const { valeur, cible } = palier.mesure(contexte);
    return {
      cle: palier.cle,
      titre: palier.titre,
      critere: palier.critere,
      valeur,
      cible,
      franchi: valeur >= cible,
      progression: cible > 0 ? Math.min(1, valeur / cible) : 0,
    };
  });

  const franchis = evalues.filter(p => p.franchi);
  const enCours = evalues.find(p => !p.franchi) || null;

  return {
    paliers: evalues,
    franchis: franchis.length,
    total: evalues.length,
    enCours,
  };
}

/**
 * Engagements de la semaine en cours.
 *
 * Ce sont des objectifs de processus : ils ne dépendent que de ce que
 * l'étudiant contrôle, et se vérifient chaque dimanche soir plutôt qu'en
 * janvier.
 */
function engagementsHebdo(config, historique, maintenant = Date.now()) {
  const cap = capDe(config?.cap);
  const budget = budgetQuotidien(config);

  const tenus = joursTravailles(historique, 7, maintenant);
  const minutesSemaine = (historique || [])
    .filter(h => {
      const t = new Date(h?.timestamp).getTime();
      return Number.isFinite(t) && t >= maintenant - 7 * JOUR;
    })
    .reduce((s, h) => s + (Number(h.dureeMinutes) > 0 ? Number(h.dureeMinutes) : 30), 0);

  const minutesVisees = cap.joursParSemaine * budget.total;

  return {
    joursVises: cap.joursParSemaine,
    joursTenus: tenus,
    joursAtteints: tenus >= cap.joursParSemaine,
    minutesVisees,
    minutesTenues: minutesSemaine,
    minutesAtteintes: minutesSemaine >= minutesVisees,
    // Une semaine reste « réussie » dès que la régularité est là, même si le
    // volume est un peu court : c'est la régularité qui construit la mémoire.
    reussie: tenus >= cap.joursParSemaine,
  };
}

/**
 * Synthèse complète, destinée au tableau de bord.
 */
function etatObjectifs(config, historique, cursus, maintenant = Date.now()) {
  return {
    cap: { cle: config?.cap || CAP_DEFAUT, ...capDe(config?.cap) },
    capacite: capaciteRetenue(config),
    budget: budgetQuotidien(config),
    engagements: engagementsHebdo(config, historique, maintenant),
    progression: evaluerPaliers(config, historique, cursus, maintenant),
  };
}

module.exports = {
  CAPS,
  CAP_DEFAUT,
  CAPACITE_DEFAUT,
  CAPACITE_MIN,
  CAPACITE_MAX,
  PALIERS,
  capDe,
  capaciteRetenue,
  budgetQuotidien,
  joursTravailles,
  semainesTenues,
  evaluerPaliers,
  engagementsHebdo,
  etatObjectifs,
  matieresActives,
  partStabilite,
};
