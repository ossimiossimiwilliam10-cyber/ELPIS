/**
 * Niveau de langue estimé par le temps de pratique.
 *
 * Une IA à qui l'on demande du vocabulaire sans rien préciser produit toujours
 * la même chose : des mots de manuel de première année. Il lui faut un repère.
 * Or ELPIS ne fait passer aucun test — et n'a pas vocation à en faire passer.
 *
 * Le repère retenu est donc le *temps de pratique*, la seule grandeur que
 * l'application mesure déjà : chaque séance de langue écrit sa durée dans
 * l'historique. Il ne s'agit pas d'une évaluation. Deux personnes ayant cumulé
 * trois cents heures n'ont pas le même niveau, et le savoir n'est pas ce qu'on
 * cherche ici : on cherche à ce que les mots générés ne soient ni triviaux ni
 * hors de portée. Pour cet usage, une estimation grossière vaut infiniment
 * mieux que rien.
 *
 * Deux références publiques servent d'étalon.
 *
 *   1. LES HEURES GUIDÉES DU CECR, telles que publiées par Cambridge English :
 *      environ 100 heures pour A1, 200 pour A2, 400 pour B1, 600 pour B2,
 *      800 pour C1 et 1 200 pour C2. Elles donnent l'échelle.
 *
 *   2. LES CATÉGORIES DU FOREIGN SERVICE INSTITUTE, qui classent les langues
 *      par distance à la langue de départ : de 600–750 heures pour les plus
 *      proches à 2 200 heures pour les plus lointaines. Elles donnent le
 *      facteur d'étirement de cette échelle.
 *
 * Le classement du FSI est calibré pour des anglophones ; la table ci-dessous
 * est ajustée pour un locuteur du français — l'anglais et les langues romanes
 * y descendent d'un cran. Elle ne sert de toute façon que de valeur par
 * défaut : la catégorie se règle langue par langue.
 *
 * Deux garde-fous complètent le modèle :
 *
 *   - LES HEURES DÉJÀ ACQUISES SE DÉCLARENT. Sans cela, dix ans d'anglais
 *     scolaire compteraient pour zéro et ELPIS générerait « the cat is on the
 *     table » à un locuteur avancé. C'est le réglage le plus important du
 *     module, et le seul qu'on ne puisse pas deviner.
 *
 *   - LE NIVEAU PEUT ÊTRE IMPOSÉ. Qui a passé une certification connaît son
 *     niveau mieux qu'une extrapolation horaire ; l'estimation cède alors la
 *     place.
 */

/**
 * Paliers du CECR et heures guidées cumulées pour les atteindre.
 * `attendu` décrit ce que le palier change pour la *génération de mots* — c'est
 * cette phrase, et non le code du niveau, qui pilote réellement le modèle.
 */
const PALIERS = [
  {
    code: 'A0',
    libelle: 'Grand débutant',
    heures: 0,
    attendu: "les tout premiers mots : salutations, nombres, couleurs, objets du quotidien, verbes les plus courants — rien qui suppose une phrase construite",
  },
  {
    code: 'A1',
    libelle: 'Découverte',
    heures: 100,
    attendu: "le noyau des quelques centaines de mots les plus fréquents : famille, nourriture, lieux, actions de base, formules de politesse",
  },
  {
    code: 'A2',
    libelle: 'Élémentaire',
    heures: 200,
    attendu: "le vocabulaire de la vie courante — courses, transports, travail, santé, loisirs — et les expressions figées les plus usuelles",
  },
  {
    code: 'B1',
    libelle: 'Seuil',
    heures: 400,
    attendu: "de quoi raconter, expliquer et donner un avis : verbes d'opinion, connecteurs logiques, premier vocabulaire abstrait",
  },
  {
    code: 'B2',
    libelle: 'Avancé',
    heures: 600,
    attendu: "la nuance : collocations naturelles, registres distincts, verbes à particule et faux-amis, vocabulaire de l'argumentation",
  },
  {
    code: 'C1',
    libelle: 'Autonome',
    heures: 800,
    attendu: "l'idiomatique et le connoté : locutions, tournures littéraires ou familières marquées, termes de domaines spécialisés",
  },
  {
    code: 'C2',
    libelle: 'Maîtrise',
    heures: 1200,
    attendu: "le rare et le subtil : mots savants, nuances que les natifs eux-mêmes hésitent à départager, vocabulaire régional ou daté",
  },
];

/**
 * Catégories du FSI : heures nécessaires pour atteindre l'autonomie
 * professionnelle, selon la distance de la langue à celle de départ.
 */
const CATEGORIES = {
  I: {
    heures: 700,
    libelle: 'Proche',
    exemples: 'anglais, espagnol, italien, portugais, roumain, catalan',
  },
  II: {
    heures: 900,
    libelle: 'Voisine',
    exemples: 'allemand, néerlandais, suédois, norvégien, danois, indonésien, swahili',
  },
  III: {
    heures: 1100,
    libelle: 'Éloignée',
    exemples: 'russe, polonais, grec, turc, hébreu, hindi, finnois, hongrois, vietnamien, thaï',
  },
  IV: {
    heures: 2200,
    libelle: 'Lointaine',
    exemples: 'arabe, chinois, japonais, coréen',
  },
};

const CATEGORIE_DEFAUT = 'III';

/** Catégorie de référence : celle dont l'échelle CECR n'est pas étirée. */
const CATEGORIE_ETALON = 'I';

/**
 * Catégorie présumée des langues courantes, du point de vue d'un francophone.
 * Toute langue absente de la table relève de la catégorie par défaut, la plus
 * fréquente — et reste réglable à la main.
 */
const CATEGORIES_PAR_LANGUE = {
  anglais: 'I', espagnol: 'I', castillan: 'I', italien: 'I', portugais: 'I',
  bresilien: 'I', roumain: 'I', catalan: 'I', occitan: 'I', corse: 'I',
  allemand: 'II', neerlandais: 'II', hollandais: 'II', suedois: 'II',
  norvegien: 'II', danois: 'II', islandais: 'III', afrikaans: 'II',
  indonesien: 'II', malais: 'II', swahili: 'II',
  russe: 'III', ukrainien: 'III', polonais: 'III', tcheque: 'III',
  slovaque: 'III', croate: 'III', serbe: 'III', bulgare: 'III',
  grec: 'III', turc: 'III', hebreu: 'III', hindi: 'III', ourdou: 'III',
  persan: 'III', farsi: 'III', finnois: 'III', hongrois: 'III',
  estonien: 'III', letton: 'III', lituanien: 'III', vietnamien: 'III',
  thai: 'III', tagalog: 'III', georgien: 'III', armenien: 'III',
  arabe: 'IV', chinois: 'IV', mandarin: 'IV', cantonais: 'IV',
  japonais: 'IV', coreen: 'IV',
};

/** Minutes de pratique en deçà desquelles une entrée d'historique est ignorée. */
const MINUTES_MINIMUM = 1;

/* --------------------------------------------------------------- Outils */

/** Clé de comparaison d'un nom de langue : sans accents, sans casse. */
function clefLangue(nom) {
  return String(nom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Catégorie valide, ou celle présumée d'après le nom de la langue. */
function categoriePour(nom, categorieDeclaree) {
  const declaree = String(categorieDeclaree || '').toUpperCase();
  if (CATEGORIES[declaree]) return declaree;
  return CATEGORIES_PAR_LANGUE[clefLangue(nom)] || CATEGORIE_DEFAUT;
}

/**
 * Facteur d'étirement de l'échelle CECR pour une catégorie.
 * Vaut 1 pour la catégorie étalon, un peu plus de 3 pour la plus lointaine.
 */
function facteurCategorie(categorie) {
  const cat = CATEGORIES[categorie] || CATEGORIES[CATEGORIE_DEFAUT];
  return cat.heures / CATEGORIES[CATEGORIE_ETALON].heures;
}

/** Seuils du CECR étirés pour une langue de cette catégorie, en heures. */
function paliersAjustes(categorie) {
  const facteur = facteurCategorie(categorie);
  return PALIERS.map(p => ({
    ...p,
    heures: Math.round(p.heures * facteur),
    heuresReference: p.heures,
  }));
}

/* ------------------------------------------------------------- Heures */

/**
 * Heures de pratique relevées pour une langue.
 *
 * Aucune instrumentation n'a été nécessaire : chaque validation de séance
 * écrit déjà `type: 'LANGUE'`, la matière et la durée dans l'historique. Le
 * compteur est donc exact pour tout ce qui a été fait depuis ELPIS — et
 * aveugle à tout ce qui l'a précédé, d'où les heures déclarées.
 */
function heuresRelevees(nomLangue, historique) {
  if (!Array.isArray(historique)) return 0;

  const total = historique.reduce((somme, h) => {
    if (h?.type !== 'LANGUE' || h.matiere !== nomLangue) return somme;
    const minutes = Number(h.dureeMinutes);
    if (!Number.isFinite(minutes) || minutes < MINUTES_MINIMUM) return somme;
    return somme + minutes;
  }, 0);

  return Math.round((total / 60) * 10) / 10;
}

/** Heures déclarées comme déjà acquises avant l'arrivée dans ELPIS. */
function normaliserHeuresAcquises(valeur) {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(20000, Math.round(n));
}

/* -------------------------------------------------------------- Niveau */

/** Le palier correspondant à un code, ou null. */
function palierParCode(code) {
  return PALIERS.find(p => p.code === String(code || '').toUpperCase()) || null;
}

/**
 * Niveau estimé d'une langue.
 *
 * @param {object} langue      la langue, telle que normalisée par `langues.js`
 * @param {Array}  historique  journal des séances
 * @returns {object} palier atteint, progression vers le suivant, et le détail
 *                   du calcul — que l'interface affiche pour que l'estimation
 *                   reste lisible plutôt que magique.
 */
function niveauLangue(langue, historique) {
  const nom = String(langue?.nom || '');
  const categorie = categoriePour(nom, langue?.categorie);
  const facteur = facteurCategorie(categorie);
  const paliers = paliersAjustes(categorie);

  const relevees = heuresRelevees(nom, historique);
  const acquises = normaliserHeuresAcquises(langue?.heuresAcquises);
  const heures = Math.round((relevees + acquises) * 10) / 10;

  // Dernier palier dont le seuil est franchi. La liste étant croissante et
  // commençant à zéro, il en existe toujours un.
  let index = 0;
  for (let i = 0; i < paliers.length; i += 1) {
    if (heures >= paliers[i].heures) index = i;
  }

  const impose = palierParCode(langue?.niveauImpose);
  const atteint = impose
    ? paliers.find(p => p.code === impose.code)
    : paliers[index];
  const suivant = paliers[paliers.indexOf(atteint) + 1] || null;

  const progression = suivant && suivant.heures > atteint.heures
    ? Math.min(1, Math.max(0, (heures - atteint.heures) / (suivant.heures - atteint.heures)))
    : 1;

  return {
    code: atteint.code,
    libelle: atteint.libelle,
    attendu: atteint.attendu,
    impose: Boolean(impose),
    heures,
    heuresRelevees: relevees,
    heuresAcquises: acquises,
    categorie,
    categorieLibelle: CATEGORIES[categorie].libelle,
    facteur: Math.round(facteur * 100) / 100,
    seuilAtteint: atteint.heures,
    seuilSuivant: suivant ? suivant.heures : null,
    codeSuivant: suivant ? suivant.code : null,
    progression: Math.round(progression * 100) / 100,
    heuresRestantes: suivant ? Math.max(0, Math.round((suivant.heures - heures) * 10) / 10) : 0,
  };
}

module.exports = {
  PALIERS,
  CATEGORIES,
  CATEGORIE_DEFAUT,
  CATEGORIE_ETALON,
  CATEGORIES_PAR_LANGUE,
  clefLangue,
  categoriePour,
  facteurCategorie,
  paliersAjustes,
  heuresRelevees,
  normaliserHeuresAcquises,
  palierParCode,
  niveauLangue,
};
