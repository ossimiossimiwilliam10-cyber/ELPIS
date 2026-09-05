/**
 * Veille anti-épuisement.
 *
 * Trois défauts limitaient la détection :
 *
 *   - la moyenne quotidienne divisait toujours par sept, même pour quelqu'un
 *     qui venait de commencer : ses journées chargées passaient inaperçues ;
 *   - les signaux s'excluaient mutuellement. Quelqu'un cumulant dix jours sans
 *     repos et cinq séances nocturnes ne voyait que le premier, alors que le
 *     second est le plus actionnable — on décale une soirée plus facilement
 *     qu'on ne récupère une semaine ;
 *   - le décompte s'arrêtant à trente jours, quarante jours d'affilée
 *     s'affichaient comme trente, sans que rien ne l'indique.
 */

/** Profondeur d'analyse du décompte de jours sans repos. */
const FENETRE_MAX_JOURS = 30;

/** Fenêtre d'observation de la charge récente. */
const FENETRE_CHARGE_JOURS = 7;

/** Seuils déclenchant un repos imposé. */
const JOURS_REPOS_FORCE = 21;
const JOURS_AVEC_CHARGE = 14;
const MINUTES_CHARGE_LOURDE = 360;

/** Seuils d'alerte intermédiaire. */
const JOURS_ALERTE = 10;
const MINUTES_ALERTE = 480;

/** Nombre de séances nocturnes qui justifie un signalement. */
const SEANCES_TARDIVES_ALERTE = 3;

/** Heure à laquelle bascule la journée logique (travail nocturne). */
const DECALAGE_JOURNEE_H = 4;

const JOUR = 86400000;

/** Journée logique d'un horodatage, au format « AAAA-MM-JJ ». */
function journeeLogique(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - DECALAGE_JOURNEE_H);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Durée d'une séance, avec le repli propre à son type. */
function dureeSeance(entree, cfg = {}) {
  const minutes = Number(entree?.dureeMinutes);
  if (Number.isFinite(minutes) && minutes > 0) return minutes;

  switch (entree?.type) {
    case 'ANKI': return cfg.defaultDurationAnki || 30;
    case 'CM': return cfg.defaultDurationRevCM || 30;
    case 'TD': return cfg.defaultDurationTD || 20;
    case 'TP': return cfg.defaultDurationTP_Etape1 || 45;
    case 'ANNALE': return cfg.defaultDurationAnnales || 60;
    default: return 30;
  }
}

/**
 * Nombre de journées consécutives travaillées sans repos déclaré.
 * Le second membre du couple indique si le décompte a atteint le plafond
 * d'analyse — auquel cas la série est plus longue que le chiffre affiché.
 */
/**
 * Part de la capacité quotidienne en deçà de laquelle une journée reste du repos.
 *
 * Un repos déclaré puis travaillé n'est pas un repos — mais trente minutes
 * d'Anki un dimanche n'annulent pas une journée de pause. Le tout-ou-rien se
 * trompe dans les deux sens ; un seuil dit ce qui s'est réellement passé.
 */
const PART_REPOS_EFFECTIF = 0.25;

function compterJoursSansRepos(cfg, historique, maintenant = Date.now()) {
  const reposDeclares = new Set(cfg?.restDays || []);
  const joursTravailles = new Set(
    (historique || [])
      .filter(h => h?.timestamp)
      .map(h => journeeLogique(h.timestamp)),
  );

  /*
   * La série se cassait sur la seule déclaration de repos, sans regarder si la
   * journée avait été chômée. Poser un dimanche de repos puis y travailler
   * trois heures remettait le compteur à zéro : le repos imposé au bout de
   * vingt-et-un jours ne se déclenchait alors plus jamais, et la veille
   * anti-épuisement se trouvait désarmée pour exactement l'étudiant qui pose
   * une pause et la grille.
   *
   * `skippedRestDays` ne couvre pas ce cas : il n'enregistre qu'un refus
   * explicite, quand l'étudiant écarte lui-même un repos proposé.
   */
  const minutesParJour = new Map();
  for (const h of (historique || [])) {
    if (!h?.timestamp) continue;
    const jour = journeeLogique(h.timestamp);
    minutesParJour.set(jour, (minutesParJour.get(jour) || 0) + dureeSeance(h, cfg));
  }

  const capaciteMin = Math.max(
    60,
    (Number(cfg?.capaciteQuotidienneH) || Number(cfg?.maxStudyHoursPerDay) || 5) * 60,
  );
  const seuilRepos = capaciteMin * PART_REPOS_EFFECTIF;
  const reposEffectif = (jour) =>
    reposDeclares.has(jour) && (minutesParJour.get(jour) || 0) <= seuilRepos;

  let compte = 0;
  for (let i = 0; i < FENETRE_MAX_JOURS; i++) {
    const jour = journeeLogique(maintenant - i * JOUR);
    if (reposEffectif(jour)) break;
    // La journée en cours n'est pas encore finie : ne rien y avoir fait ne
    // signifie pas qu'elle sera une journée de repos.
    if (!joursTravailles.has(jour) && i > 0) break;
    compte++;
  }

  return { jours: compte, plafonne: compte >= FENETRE_MAX_JOURS };
}

/**
 * Charge de travail récente.
 * La fenêtre se limite à l'ancienneté réelle de l'historique : diviser par sept
 * les trois premiers jours d'utilisation revient à diviser la charge par deux.
 */
function mesurerCharge(cfg, historique, maintenant = Date.now()) {
  const seances = (historique || []).filter(h => h?.timestamp);
  const debut = maintenant - FENETRE_CHARGE_JOURS * JOUR;
  const recentes = seances.filter(h => new Date(h.timestamp).getTime() >= debut);

  const horodatages = seances
    .map(h => new Date(h.timestamp).getTime())
    .filter(Number.isFinite);

  const premiere = horodatages.length > 0 ? Math.min(...horodatages) : maintenant;
  // Journées couvertes, aujourd'hui compris : une première séance datant
  // d'avant-hier couvre trois journées, pas deux.
  const anciennete = Math.floor((maintenant - premiere) / JOUR) + 1;
  const fenetre = Math.min(FENETRE_CHARGE_JOURS, Math.max(1, anciennete));

  const totalMinutes = recentes.reduce((s, h) => s + dureeSeance(h, cfg), 0);

  return {
    totalMinutes,
    fenetre,
    moyenneQuotidienne: totalMinutes / fenetre,
    seances: recentes,
  };
}

/** Séances entamées après l'heure de coucher, ou avant la bascule de journée. */
function compterSeancesTardives(cfg, seances) {
  const heureCoucher = cfg?.bedtime ? parseInt(String(cfg.bedtime).split(':')[0], 10) : 23;
  const seuil = Number.isFinite(heureCoucher) ? heureCoucher : 23;

  return seances.filter(h => {
    if (!h?.timestamp) return false;
    const heure = new Date(h.timestamp).getHours();
    return heure >= seuil || heure < DECALAGE_JOURNEE_H;
  }).length;
}

/**
 * État de fatigue, avec tous les signaux relevés.
 *
 * `riskLevel`, `reason` et `shouldForceRest` conservent leur sens d'origine
 * pour l'orchestrateur et l'interface ; `signaux` les accompagne désormais, ce
 * qui permet de tout montrer plutôt que le seul motif le plus grave.
 */
function evaluerFatigue(cfg = {}, historique = [], maintenant = Date.now()) {
  const repos = compterJoursSansRepos(cfg, historique, maintenant);
  const charge = mesurerCharge(cfg, historique, maintenant);
  const tardives = compterSeancesTardives(cfg, charge.seances);

  const heures = Math.round(charge.moyenneQuotidienne / 60 * 10) / 10;
  const serie = repos.plafonne ? `plus de ${repos.jours}` : `${repos.jours}`;

  const signaux = [];

  if (repos.jours >= JOURS_REPOS_FORCE) {
    signaux.push({
      cle: 'serie-tres-longue',
      gravite: 'high',
      texte: `${serie} jours consécutifs sans un seul jour de repos.`,
    });
  } else if (repos.jours >= JOURS_AVEC_CHARGE && charge.moyenneQuotidienne > MINUTES_CHARGE_LOURDE) {
    signaux.push({
      cle: 'serie-chargee',
      gravite: 'high',
      texte: `${serie} jours sans repos, à ${heures} h de travail par jour.`,
    });
  } else if (repos.jours >= JOURS_ALERTE) {
    signaux.push({
      cle: 'serie-longue',
      gravite: 'medium',
      texte: `${serie} jours consécutifs de travail. Une pause serait bienvenue.`,
    });
  }

  if (charge.moyenneQuotidienne > MINUTES_ALERTE) {
    signaux.push({
      cle: 'charge-lourde',
      gravite: 'medium',
      texte: `${heures} h de travail par jour en moyenne sur les ${charge.fenetre} derniers jours.`,
    });
  }

  // Relevé indépendamment des autres : c'est le signal sur lequel il est le
  // plus facile d'agir, et il disparaissait dès qu'un autre était présent.
  if (tardives >= SEANCES_TARDIVES_ALERTE) {
    signaux.push({
      cle: 'seances-tardives',
      gravite: 'low',
      texte: `${tardives} séances entamées après ton heure de coucher cette semaine.`,
    });
  }

  const gravites = signaux.map(s => s.gravite);
  const riskLevel = gravites.includes('high') ? 'high'
    : gravites.includes('medium') ? 'medium'
      : gravites.includes('low') ? 'low'
        : 'none';

  const shouldForceRest = signaux.some(s => s.cle === 'serie-tres-longue' || s.cle === 'serie-chargee');

  return {
    riskLevel,
    shouldForceRest,
    reason: signaux.map(s => s.texte).join(' '),
    signaux,
    daysWithoutRest: repos.jours,
    daysWithoutRestCapped: repos.plafonne,
    avgDailyMinutes: charge.moyenneQuotidienne,
    observationWindowDays: charge.fenetre,
    lateSessionCount: tardives,
  };
}

module.exports = {
  PART_REPOS_EFFECTIF,
  evaluerFatigue,
  compterJoursSansRepos,
  mesurerCharge,
  compterSeancesTardives,
  dureeSeance,
  journeeLogique,
  JOURS_REPOS_FORCE,
  JOURS_ALERTE,
  MINUTES_ALERTE,
  SEANCES_TARDIVES_ALERTE,
};
