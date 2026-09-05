/**
 * Langues — la pratique que rien ne vient réclamer.
 *
 * Tout le reste d'ELPIS est ordonnancé par une échéance : un examen approche,
 * une note manque, un TD figure au programme de la semaine. `scoring.js`
 * traduit cette pression en priorité, et l'orchestrateur sert d'abord ce qui
 * presse.
 *
 * Une langue n'a rien de tout cela. Aucun partiel ne l'attend, aucun
 * coefficient ne la défend. Passée par le même barème, elle ne recevrait aucun
 * boost d'urgence et se placerait derrière n'importe quelle matière du cursus
 * — c'est-à-dire jamais. Le module n'aurait alors plus servi qu'à ranger trois
 * liens, ce qu'un dossier de favoris fait déjà.
 *
 * Ce qui pilote une langue, c'est la régularité. On modélise donc non pas
 * l'urgence mais la *dette* : le retard pris sur la cadence que l'utilisateur
 * s'est lui-même fixée.
 *
 *     dette = jours écoulés depuis la dernière séance ÷ intervalle visé
 *
 * Elle vaut 0 au lendemain d'une séance, 1 le jour où la suivante est due, et
 * croît ensuite. En deçà de 1, la langue ne demande rien.
 *
 * Trois choix de conception méritent d'être justifiés.
 *
 *   1. LA CADENCE PORTE SUR LA LANGUE, PAS SUR LE VOLET. L'utilisateur déclare
 *      ce qu'il peut tenir — trois séances par semaine —, le système décide
 *      laquelle des trois. C'est la règle déjà retenue par `objectifs.js` :
 *      l'ambition règle l'emploi du temps, jamais son volume. Demander trois
 *      cadences séparées reviendrait à réclamer un arbitrage que personne ne
 *      sait faire correctement à l'avance.
 *
 *   2. LES TROIS VOLETS N'ONT PAS LA MÊME FRÉQUENCE NATURELLE. Le vocabulaire
 *      relève de l'entretien : il se perd vite et se reprend court. La
 *      grammaire relève de la découverte : une règle comprise tient des
 *      semaines. La conversation relève de l'entraînement, entre les deux.
 *      Un poids traduit ce rapport ; l'intervalle visé de chaque volet s'en
 *      déduit, et la rotation en découle sans qu'on ait à l'écrire.
 *
 *   3. LA DETTE EST PLAFONNÉE. C'est le défaut que `objectifs.js` avait relevé
 *      sur l'ancien modèle d'effort : faire dépendre l'exigence du retard rend
 *      le rattrapage toujours plus lourd, donc toujours plus improbable. Deux
 *      mois sans anglais ne doivent pas produire une dette de soixante jours
 *      qui écraserait le planning à la reprise et transformerait le retour en
 *      punition. Passé le plafond, la langue est due — elle n'est pas en faute.
 */

/**
 * Poids de fréquence relative des trois volets.
 *
 * Ces nombres ne se lisent pas isolément : seul leur rapport compte. 3/2/1
 * signifie que sur six séances, trois vont au vocabulaire, deux à la
 * conversation et une à la grammaire.
 */
const VOLETS = {
  vocabulaire: { libelle: 'Vocabulaire', poids: 3, dureeDefaut: 20, regime: 'entretien' },
  conversation: { libelle: 'Conversation', poids: 2, dureeDefaut: 20, regime: 'entrainement' },
  grammaire: { libelle: 'Grammaire', poids: 1, dureeDefaut: 30, regime: 'decouverte' },
};

/** Ordre d'affichage et de départage, du plus fréquent au plus rare. */
const CLES_VOLETS = ['vocabulaire', 'conversation', 'grammaire'];

const SOMME_POIDS = Object.values(VOLETS).reduce((s, v) => s + v.poids, 0);

/** Séances par semaine proposées à la création d'une langue. */
const CADENCE_DEFAUT = 3;

/** Bornes de la cadence : moins d'une séance par semaine n'entretient rien. */
const CADENCE_MIN = 1;
const CADENCE_MAX = 7;

/**
 * Plafond de la dette. Voir le point 3 de l'en-tête : au-delà, le retard cesse
 * de s'accumuler.
 */
const DETTE_MAX = 2;

/**
 * Fenêtre de priorité accordée aux langues, sur l'échelle bornée 0–100.
 *
 * Le plancher les place au-dessus du remplissage de fin de journée, le plafond
 * les maintient sous les cours en retard (priorité proche de 100) et sous la
 * routine Anki quotidienne (95). Une langue ne doit jamais faire sauter une
 * révision due : elle occupe le temps qui reste, pas celui qui manque.
 */
const PRIORITE_MIN = 45;
const PRIORITE_MAX = 72;

/** Nombre de langues servies dans une même journée, sauf réglage contraire. */
const MAX_LANGUES_PAR_JOUR = 1;

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ Dates */

/** Date locale à minuit, ou null si la chaîne n'est pas une date ISO. */
function jourDepuisChaine(chaine) {
  if (typeof chaine !== 'string') return null;
  const m = chaine.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Nombre de jours entiers entre deux dates ISO, ou null si l'une est illisible.
 * Un résultat négatif — date de pratique postérieure à aujourd'hui, après un
 * changement d'horloge système — est ramené à 0 plutôt qu'ignoré.
 */
function joursEntre(depuis, jusqua) {
  const a = jourDepuisChaine(depuis);
  const b = jourDepuisChaine(jusqua);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b - a) / MS_PAR_JOUR));
}

/**
 * Jour logique d'un horodatage, avec la même période de grâce de quatre heures
 * que le reste de l'application : une séance de 1 h du matin appartient à la
 * journée qui s'achève, pas à celle qui commence.
 */
function jourLogique(horodatage) {
  if (!horodatage) return null;
  const d = new Date(horodatage);
  if (isNaN(d.getTime())) return null;
  d.setHours(d.getHours() - 4);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Libellé de volet — tel qu'écrit dans l'historique — vers sa clé. */
const CLE_PAR_LIBELLE = Object.fromEntries(
  Object.entries(VOLETS).map(([cle, v]) => [v.libelle.toLowerCase(), cle])
);

/**
 * Dernière séance relevée dans l'historique, par langue et par volet.
 *
 * Le champ `dernieresPratiques` d'une langue est écrit par la page Langues ;
 * l'historique, lui, est écrit par toute validation, y compris celle faite
 * depuis la Session du Jour. Sans cette lecture, une séance validée là-bas ne
 * remettrait pas le compteur à zéro et la tâche reviendrait le lendemain comme
 * si de rien n'était.
 */
function dernieresDepuisHistorique(historique) {
  const releve = {};
  if (!Array.isArray(historique)) return releve;

  for (const h of historique) {
    if (h?.type !== 'LANGUE' || !h.matiere) continue;
    const cle = CLE_PAR_LIBELLE[String(h.titre || '').toLowerCase()];
    if (!cle) continue;
    const jour = jourLogique(h.timestamp);
    if (!jour) continue;

    const index = `${h.matiere}␟${cle}`;
    if (!releve[index] || jour > releve[index]) releve[index] = jour;
  }
  return releve;
}

/* --------------------------------------------------------- Normalisation */

/**
 * Vrai si l'adresse peut être ouverte sans danger.
 *
 * Le contrôle existe déjà côté navigateur, mais la configuration est un
 * fichier : un lien `javascript:` déposé à la main ne doit pas être compté
 * comme une ressource exploitable, ni proposé comme tel.
 */
function estUrlSure(url) {
  try {
    const protocole = new URL(String(url).trim()).protocol;
    return protocole === 'http:' || protocole === 'https:';
  } catch {
    return false;
  }
}

/**
 * Liste de liens d'un volet.
 *
 * Un seul fil de discussion ne suffit pas : on ne travaille pas les temps du
 * passé et le vocabulaire de la cuisine dans la même conversation, et l'intérêt
 * d'un fil tient précisément à son historique. Chaque volet porte donc autant
 * d'adresses nommées que voulu.
 *
 * `heritage` reprend le lien unique des configurations antérieures, pour
 * qu'aucune ne se retrouve muette après la mise à jour.
 */
function normaliserLiens(brut, heritage) {
  const liste = Array.isArray(brut) ? brut : [];

  const liens = liste
    .map((l, i) => ({
      id: String(l?.id || '').trim() || `lien-${i + 1}`,
      libelle: String(l?.libelle || '').trim(),
      url: String(l?.url || '').trim(),
    }))
    .filter(l => estUrlSure(l.url));

  if (liens.length === 0 && estUrlSure(heritage)) {
    liens.push({ id: 'lien-1', libelle: 'Ma conversation', url: String(heritage).trim() });
  }

  // Un lien sans nom reste cliquable : on lui en donne un plutôt que d'afficher
  // un bouton vide.
  return liens.map((l, i) => ({ ...l, libelle: l.libelle || `Conversation ${i + 1}` }));
}

/** Cadence ramenée dans ses bornes, valeur par défaut si elle est absurde. */
function normaliserCadence(valeur) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return CADENCE_DEFAUT;
  return Math.min(CADENCE_MAX, Math.max(CADENCE_MIN, Math.round(n)));
}

/**
 * Complète une langue saisie par l'utilisateur.
 *
 * L'objet vient de la configuration, donc d'un JSON que rien ne garantit :
 * chaque lecture passe par ici pour que le reste du moteur n'ait pas à tester
 * l'existence de chaque sous-objet.
 */
/**
 * Une langue déclarée, ramenée à la forme que le reste du module attend.
 *
 * Deux formes coexistent en base. La page écrit aujourd'hui des volets
 * imbriqués — `grammaire.livre`, `vocabulaire.deckAnki` — mais une version
 * antérieure posait ces champs à plat, à la racine de la langue : `livre`,
 * `lienGrammaire`. Une fiche restée dans l'ancienne forme n'avait donc plus
 * aucun volet exploitable, et le planificateur la traitait comme une langue
 * déclarée mais vide : jamais de séance, jamais d'explication.
 *
 * On lit donc les deux formes. L'ancienne ne sert que de repli : dès que la
 * page réenregistre la langue, la forme imbriquée l'emporte.
 */
function normaliserLangue(brute) {
  const l = brute && typeof brute === 'object' ? brute : {};
  const pratiques = l.dernieresPratiques && typeof l.dernieresPratiques === 'object'
    ? l.dernieresPratiques
    : {};

  return {
    id: String(l.id || ''),
    nom: String(l.nom || '').trim(),
    drapeau: String(l.drapeau || '🌍'),
    actif: l.actif !== false,
    cadence: normaliserCadence(l.cadence),
    // Repères de niveau — leur interprétation appartient à `niveauLangue.js`,
    // qui les valide à son tour : on se contente ici de les transporter.
    categorie: String(l.categorie || '').trim(),
    heuresAcquises: Number(l.heuresAcquises) || 0,
    niveauImpose: String(l.niveauImpose || '').trim(),
    dernieresPratiques: {
      vocabulaire: pratiques.vocabulaire || '',
      grammaire: pratiques.grammaire || '',
      conversation: pratiques.conversation || '',
    },
    vocabulaire: {
      // `deckAnki` a d'abord vécu à la racine sous le nom `deckVocabulaire`.
      deckAnki: String(l.vocabulaire?.deckAnki || l.deckVocabulaire || '').trim(),
      liens: normaliserLiens(l.vocabulaire?.liens, l.vocabulaire?.lienGeneration || l.lienVocabulaire),
      dureeMinutes: Number(l.vocabulaire?.dureeMinutes) || VOLETS.vocabulaire.dureeDefaut,
    },
    grammaire: {
      liens: normaliserLiens(l.grammaire?.liens, l.grammaire?.lienIA || l.lienGrammaire),
      livre: String(l.grammaire?.livre || l.livre || '').trim(),
      dureeMinutes: Number(l.grammaire?.dureeMinutes) || VOLETS.grammaire.dureeDefaut,
    },
    conversation: {
      liens: normaliserLiens(l.conversation?.liens, l.conversation?.lienIA || l.lienConversation),
      dureeMinutes: Number(l.conversation?.dureeMinutes) || VOLETS.conversation.dureeDefaut,
    },
  };
}

/** Les langues déclarées dans la configuration, normalisées et nommées. */
function chargerLangues(cfg) {
  const brutes = Array.isArray(cfg?.langues) ? cfg.langues : [];
  return brutes.map(normaliserLangue).filter(l => l.nom);
}

/* ------------------------------------------------------ Dette et rotation */

/**
 * Intervalle visé entre deux séances d'un volet, en jours.
 *
 * Une cadence de 3 séances par semaine répartie selon les poids 3/2/1 donne un
 * cycle de six séances en quatorze jours : le vocabulaire revient tous les
 * 4,7 jours, la conversation tous les 7, la grammaire tous les 14.
 */
function intervalleCible(cadence, cleVolet) {
  const volet = VOLETS[cleVolet];
  if (!volet) return Infinity;
  return (7 / normaliserCadence(cadence)) * (SOMME_POIDS / volet.poids);
}

/**
 * Un volet est exploitable si ELPIS a de quoi le lancer.
 *
 * Sans cette vérification, une langue tout juste créée serait planifiée avec
 * un bouton qui n'ouvre rien — la façon la plus sûre de faire abandonner un
 * module au bout de deux jours.
 */
function voletExploitable(langue, cleVolet) {
  const l = normaliserLangue(langue);
  if (cleVolet === 'vocabulaire') {
    return Boolean(l.vocabulaire.deckAnki || l.vocabulaire.liens.length);
  }
  if (cleVolet === 'grammaire') {
    return Boolean(l.grammaire.liens.length || l.grammaire.livre);
  }
  if (cleVolet === 'conversation') {
    return Boolean(l.conversation.liens.length);
  }
  return false;
}

/**
 * État d'un volet à une date donnée.
 *
 * Une langue jamais pratiquée est *due*, pas en retard : sa dette vaut
 * exactement 1. La démarrer ne doit pas passer devant une langue réellement
 * délaissée depuis trois semaines.
 */
function etatVolet(langue, cleVolet, todayStr, dernieresHistorique = {}) {
  const l = normaliserLangue(langue);
  const intervalle = intervalleCible(l.cadence, cleVolet);

  // La plus récente des deux traces fait foi : la configuration et l'historique
  // sont deux chemins d'écriture, aucun des deux n'est exhaustif à lui seul.
  const declaree = l.dernieresPratiques[cleVolet] || '';
  const relevee = dernieresHistorique[`${l.nom}␟${cleVolet}`] || '';
  const derniere = declaree > relevee ? declaree : relevee;

  const jours = joursEntre(derniere, todayStr);

  const detteBrute = jours === null ? 1 : jours / intervalle;
  const dette = Math.min(DETTE_MAX, detteBrute);

  return {
    cle: cleVolet,
    libelle: VOLETS[cleVolet].libelle,
    regime: VOLETS[cleVolet].regime,
    intervalleJours: Math.round(intervalle * 10) / 10,
    derniere: derniere || null,
    joursDepuis: jours,
    dette: Math.round(dette * 100) / 100,
    du: dette >= 1,
    exploitable: voletExploitable(l, cleVolet),
    dureeMinutes: l[cleVolet].dureeMinutes,
    faitAujourdhui: derniere === todayStr,
  };
}

/**
 * Volet à proposer pour une langue, ou null s'il n'y a rien à proposer.
 *
 * On retient la dette la plus forte parmi les volets dus et exploitables. À
 * égalité — le cas au démarrage, où tout vaut 1 —, l'ordre de `CLES_VOLETS`
 * tranche en faveur du volet dont l'intervalle est le plus court : c'est celui
 * qui décrochera le premier.
 */
function voletAProposer(etats) {
  const eligibles = etats.filter(e => e.du && e.exploitable && !e.faitAujourdhui);
  if (eligibles.length === 0) return null;

  return eligibles.reduce((meilleur, candidat) => {
    if (candidat.dette > meilleur.dette) return candidat;
    if (candidat.dette < meilleur.dette) return meilleur;
    return CLES_VOLETS.indexOf(candidat.cle) < CLES_VOLETS.indexOf(meilleur.cle) ? candidat : meilleur;
  });
}

/**
 * Traduit une dette en priorité sur l'échelle bornée de l'orchestrateur.
 * Linéaire entre `PRIORITE_MIN` (tout juste due) et `PRIORITE_MAX` (plafonnée).
 */
function prioriteDepuisDette(dette) {
  const borne = Math.min(DETTE_MAX, Math.max(1, Number(dette) || 1));
  const part = (borne - 1) / (DETTE_MAX - 1);
  return Math.round(PRIORITE_MIN + part * (PRIORITE_MAX - PRIORITE_MIN));
}

/**
 * État complet d'une langue : ses trois volets, et celui qui serait proposé.
 * C'est ce que lit l'interface pour afficher la pastille « à faire ».
 */
function etatLangue(langue, todayStr, dernieresHistorique = {}) {
  const l = normaliserLangue(langue);
  const volets = CLES_VOLETS.map(cle => etatVolet(l, cle, todayStr, dernieresHistorique));
  const pratiqueAujourdhui = volets.some(v => v.faitAujourdhui);

  // Une séance par langue et par jour. Enchaîner grammaire et vocabulaire le
  // même après-midi n'avance à rien : l'espacement est précisément ce que la
  // cadence organise, et une langue qui réclamerait trois créneaux dans la
  // journée se ferait mettre en pause au bout d'une semaine.
  const propose = (l.actif && !pratiqueAujourdhui) ? voletAProposer(volets) : null;

  return {
    id: l.id,
    nom: l.nom,
    drapeau: l.drapeau,
    actif: l.actif,
    cadence: l.cadence,
    volets,
    propose: propose ? propose.cle : null,
    dette: propose ? propose.dette : 0,
    pratiqueAujourdhui,
    configuree: volets.some(v => v.exploitable),
  };
}

/** États de toutes les langues, triés par dette décroissante. */
function etatLangues(cfg, todayStr, historique = null) {
  const releve = dernieresDepuisHistorique(historique);
  return chargerLangues(cfg)
    .map(l => etatLangue(l, todayStr, releve))
    .sort((a, b) => b.dette - a.dette || a.nom.localeCompare(b.nom, 'fr'));
}

/* ---------------------------------------------------------- Tâches du jour */

/**
 * Tâches de langue à injecter dans le rapport quotidien.
 *
 * Contrairement au mémoire de stage, ces tâches ne sont pas obligatoires :
 * elles ne s'ajoutent que s'il reste du temps. Une journée déjà saturée par le
 * cursus ne se voit pas rallonger de vingt minutes au nom de la régularité —
 * la dette, plafonnée, attendra sans grossir indéfiniment.
 *
 * @param {object} cfg              configuration complète
 * @param {string} todayStr         date du jour, format ISO
 * @param {number} tempsRestantMin  minutes encore libres dans la journée
 * @param {Array}  historique       journal des séances, pour repérer celles du jour
 * @returns {Array} tâches au format attendu par l'orchestrateur
 */
function tachesLangues(cfg, todayStr, tempsRestantMin, historique = null) {
  const budgetInitial = Number.isFinite(tempsRestantMin) ? tempsRestantMin : 0;
  if (budgetInitial <= 0) return [];

  const maxParJour = Math.max(0, Number(cfg?.maxLanguesParJour ?? MAX_LANGUES_PAR_JOUR));
  if (maxParJour === 0) return [];

  const taches = [];
  let budget = budgetInitial;

  for (const etat of etatLangues(cfg, todayStr, historique)) {
    if (taches.length >= maxParJour) break;
    // `propose` est déjà nul pour une langue en pause ou déjà pratiquée
    // aujourd'hui : la règle est portée par `etatLangue`, pas répétée ici.
    if (!etat.propose) continue;

    const volet = etat.volets.find(v => v.cle === etat.propose);
    if (!volet || volet.dureeMinutes > budget) continue;

    budget -= volet.dureeMinutes;
    const priorite = prioriteDepuisDette(volet.dette);

    taches.push({
      matiere: etat.nom,
      type: 'LANGUE',
      titre: volet.libelle,
      volet: volet.cle,
      langueId: etat.id,
      dureeMinutes: volet.dureeMinutes,
      // L'échelle historique, non bornée, sert encore au tri de la tâche
      // forcée. On reste très en dessous de PRIO_MAX_RETARD (999) : une langue
      // ne passe jamais devant un cours en retard.
      prio: priorite * 10,
      priorite,
      raisons: ['REGULARITE_LANGUE'],
      explication: {
        composantes: [],
        modificateurs: [],
        raisons: [
          volet.joursDepuis === null
            ? `${volet.libelle} jamais pratiqué`
            : `${volet.joursDepuis} j depuis la dernière séance (visé : ${volet.intervalleJours} j)`,
        ],
      },
    });
  }

  return taches;
}

/* ------------------------------------------------------------- Régularité */

/**
 * Régularité tenue sur les `fenetre` derniers jours, comparée à la cadence.
 *
 * On compte les *jours* de pratique et non les séances : deux volets faits le
 * même jour ne valent pas deux jours de régularité, et c'est bien la
 * régularité qu'on cherche à mesurer.
 */
function regulariteRecente(nomLangue, cadence, historique, todayStr, fenetre = 30) {
  const fin = jourDepuisChaine(todayStr);
  const vise = Math.round((normaliserCadence(cadence) * fenetre) / 7);
  if (!fin || !Array.isArray(historique)) return { tenu: 0, vise, fenetre };

  const debut = new Date(fin.getTime() - (fenetre - 1) * MS_PAR_JOUR);
  const jours = new Set();

  for (const h of historique) {
    if (h?.type !== 'LANGUE' || h.matiere !== nomLangue) continue;
    const d = jourDepuisChaine(h.timestamp);
    if (!d || d < debut || d > fin) continue;
    jours.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  return { tenu: jours.size, vise, fenetre };
}

module.exports = {
  VOLETS,
  CLES_VOLETS,
  CADENCE_DEFAUT,
  CADENCE_MIN,
  CADENCE_MAX,
  DETTE_MAX,
  PRIORITE_MIN,
  PRIORITE_MAX,
  MAX_LANGUES_PAR_JOUR,
  estUrlSure,
  normaliserLiens,
  normaliserCadence,
  normaliserLangue,
  chargerLangues,
  jourLogique,
  dernieresDepuisHistorique,
  intervalleCible,
  voletExploitable,
  etatVolet,
  voletAProposer,
  prioriteDepuisDette,
  etatLangue,
  etatLangues,
  tachesLangues,
  regulariteRecente,
  joursEntre,
};
