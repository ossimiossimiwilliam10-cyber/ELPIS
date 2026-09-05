/**
 * Épreuve de validation par Anki.
 *
 * Valider un cours revenait jusqu'ici à cocher soi-même « je l'ai retenu ».
 * Or l'auto-évaluation après une relecture est systématiquement trop
 * optimiste : la familiarité d'un texte déjà lu se confond avec la maîtrise.
 * Faire trancher Anki supprime ce biais — le taux mesuré remplace l'impression.
 *
 * Le principe : chaque cours porte une requête de recherche Anki. Au moment de
 * le valider, ELPIS relève l'heure, ouvre Anki sur les cartes correspondantes,
 * puis lit après coup les révisions enregistrées depuis ce relevé. Le taux de
 * réussite obtenu devient la note transmise à FSRS.
 *
 * Deux précautions de conception :
 *
 *   - l'épreuve n'utilise pas le calendrier d'Anki. ELPIS et Anki appliquent
 *     chacun leur propre répétition espacée ; les faire dépendre l'un de
 *     l'autre produirait des sessions vides — le cours redemandé par ELPIS
 *     quand aucune carte n'est due — ou un calendrier Anki faussé ;
 *   - un taux calculé sur trop peu de cartes ne veut rien dire. En deçà d'un
 *     minimum, l'épreuve est déclarée non concluante plutôt que réussie.
 */

const http = require('http');

/** Délai au-delà duquel on considère qu'Anki ne répondra pas. */
const TIMEOUT_MS = 5000;

/**
 * Nombre minimal de cartes révisées pour qu'un taux soit exploitable.
 * Sous ce seuil, une seule erreur ferait chuter le résultat de vingt points.
 */
const CARTES_MINIMUM = 5;

/** Seuil de réussite par défaut, en pourcentage. */
const SEUIL_DEFAUT = 80;

/**
 * Une carte est réussie dès lors qu'elle n'a pas été oubliée.
 * C'est la convention d'Anki lui-même : seul « Again » compte comme un échec,
 * « Hard » signalant une réponse retrouvée, quoique laborieusement.
 */
const EASE_ECHEC = 1;

/** Appel à l'API locale d'AnkiConnect. */
function invoquer(action, params = {}) {
  return new Promise((resolve, reject) => {
    const corps = JSON.stringify({ action, version: 6, params });
    const requete = http.request({
      hostname: '127.0.0.1',
      port: 8765,
      method: 'POST',
      agent: false,
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps) },
    }, reponse => {
      let brut = '';
      reponse.on('data', c => { brut += c; });
      reponse.on('end', () => {
        try {
          const analyse = JSON.parse(brut);
          if (analyse.error) return reject(new Error(analyse.error));
          resolve(analyse.result);
        } catch (err) {
          reject(err);
        }
      });
    });

    requete.on('timeout', () => {
      requete.destroy();
      reject(new Error('Anki ne répond pas. Est-il lancé ?'));
    });
    requete.on('error', err => {
      reject(err.code === 'ECONNREFUSED'
        ? new Error("Anki n'est pas lancé, ou l'extension AnkiConnect est absente.")
        : err);
    });

    requete.write(corps);
    requete.end();
  });
}

/**
 * Cartes correspondant à une requête de recherche Anki.
 * La syntaxe est celle du navigateur d'Anki : `deck:Physique tag:gauss`.
 */
async function chercherCartes(requete, appel = invoquer) {
  if (!requete || !String(requete).trim()) return [];
  return appel('findCards', { query: String(requete).trim() });
}

/** Deck où les cartes sont rassemblées le temps d'une épreuve. */
const DECK_EPREUVE = 'Séance de révisions personnalisées';

/**
 * Lance une véritable séance de révision sur un échantillon de cartes.
 *
 * Trois contraintes commandent cette mécanique :
 *
 *   - `guiBrowse` n'ouvre que la liste des cartes ; on ne révise pas depuis le
 *     navigateur d'Anki ;
 *   - `createFilteredDeck` n'est pas exposé par cette version d'AnkiConnect, un
 *     deck filtré est donc hors d'atteinte ;
 *   - une carte dont l'échéance est lointaine ne sera pas proposée en révision,
 *     même dans le bon deck.
 *
 * Les cartes sont donc déplacées vers un deck d'accueil et rendues dues du
 * jour. Le suffixe `!` de `setDueDate` préserve leur intervalle : Anki
 * replanifiera à partir de celui-ci, si bien que l'épreuve avance la révision
 * sans dérégler le calendrier.
 *
 * Le retour à la normale est assuré par `rendreCartes`, appelé au relevé — et,
 * en cas d'interruption, par `rapatrierCartesOubliees` au démarrage suivant.
 */
async function ouvrirEpreuve(cartes, options = {}, appel = invoquer) {
  const liste = Array.isArray(cartes) ? cartes : [];
  if (liste.length === 0) {
    throw new Error('Aucune carte ne correspond à ce cours.');
  }

  // Les cartes jamais étudiées ne reçoivent pas d'échéance : `setDueDate` les
  // convertirait en cartes de révision, leur faisant sauter la phase
  // d'apprentissage qui est précisément ce qui les ancre.
  const neuves = new Set((options.nouvelles || []).map(Number));
  const aReplanifier = liste.filter(c => !neuves.has(Number(c)));

  // Mémoriser le deck d'origine de chaque carte avant de la déplacer.
  const infos = await appel('cardsInfo', { cards: liste });
  const origines = {};
  for (const carte of infos || []) {
    if (carte?.cardId && carte?.deckName) origines[carte.cardId] = carte.deckName;
  }

  await appel('createDeck', { deck: DECK_EPREUVE });
  await appel('changeDeck', { cards: liste, deck: DECK_EPREUVE });
  // « 0! » : due aujourd'hui, intervalle conservé.
  if (aReplanifier.length > 0) {
    await appel('setDueDate', { cards: aReplanifier, days: '0!' });
  }
  await appel('guiDeckReview', { name: DECK_EPREUVE });

  return {
    cartes: liste.length,
    replanifiees: aReplanifier.length,
    nouvelles: liste.length - aReplanifier.length,
    origines,
    deckEpreuve: DECK_EPREUVE,
  };
}

/**
 * Rend chaque carte à son deck d'origine.
 *
 * Les cartes sont regroupées par destination : un appel par deck plutôt qu'un
 * appel par carte, ce qui évite une centaine d'allers-retours avec Anki.
 */
async function rendreCartes(origines, appel = invoquer) {
  const parDeck = new Map();
  for (const [carte, deck] of Object.entries(origines || {})) {
    if (!deck || deck === DECK_EPREUVE) continue;
    if (!parDeck.has(deck)) parDeck.set(deck, []);
    parDeck.get(deck).push(Number(carte));
  }

  let rendues = 0;
  for (const [deck, cartes] of parDeck) {
    await appel('changeDeck', { cards: cartes, deck });
    rendues += cartes.length;
  }
  return rendues;
}

/**
 * Vide le deck d'épreuve des cartes qu'une séance interrompue y aurait laissées.
 *
 * Sans ce filet, une fermeture d'ELPIS au mauvais moment abandonnerait des
 * cartes dans un deck qui n'est pas le leur — et elles disparaîtraient
 * silencieusement des révisions de leur matière.
 */
async function rapatrierCartesOubliees(appel = invoquer) {
  const restantes = await appel('findCards', { query: requeteDeck(DECK_EPREUVE) });
  if (!restantes || restantes.length === 0) return { rapatriees: 0 };

  const infos = await appel('cardsInfo', { cards: restantes });
  const origines = {};
  for (const carte of infos || []) {
    // `odid` porte le deck d'origine d'une carte empruntée ; à défaut, on ne
    // peut pas deviner d'où elle vient et on la laisse où elle est.
    if (carte?.cardId && carte?.odid) origines[carte.cardId] = String(carte.odid);
  }

  return { rapatriees: await rendreCartes(origines, appel), restantes: restantes.length };
}

/**
 * Révisions enregistrées depuis un instant donné, pour un ensemble de cartes.
 *
 * `getReviewsOfCards` rend, pour chaque carte, l'historique complet de ses
 * révisions. L'identifiant d'une révision est son horodatage en millisecondes,
 * ce qui permet de ne retenir que celles postérieures au début de l'épreuve.
 */
async function revisionsDepuis(cartes, depuis, appel = invoquer) {
  if (!cartes || cartes.length === 0) return [];
  const parCarte = await appel('getReviewsOfCards', { cards: cartes });

  const retenues = [];
  for (const [carte, revisions] of Object.entries(parCarte || {})) {
    for (const revision of revisions || []) {
      const horodatage = Number(revision?.id);
      if (Number.isFinite(horodatage) && horodatage >= depuis) {
        retenues.push({ carte, ease: Number(revision.ease), horodatage });
      }
    }
  }
  return retenues.sort((a, b) => a.horodatage - b.horodatage);
}

/**
 * Taux de réussite d'une série de révisions.
 * Une carte révisée plusieurs fois dans la séance ne compte qu'une fois : c'est
 * sa dernière réponse qui vaut, celle où la mémoire a fini par céder ou tenir.
 */
function tauxReussite(revisions) {
  const derniere = new Map();
  for (const r of revisions || []) {
    if (!Number.isFinite(r.ease)) continue;
    derniere.set(r.carte, r.ease);
  }

  const eases = [...derniere.values()];
  if (eases.length === 0) return { taux: null, cartes: 0, reussies: 0 };

  const reussies = eases.filter(e => e > EASE_ECHEC).length;
  return {
    taux: Math.round((reussies / eases.length) * 1000) / 10,
    cartes: eases.length,
    reussies,
  };
}

/**
 * Note FSRS déduite d'un taux de réussite.
 *
 * Les paliers suivent ceux de la récupération active : rien retrouvé, retrouvé
 * péniblement, retrouvé, immédiat. Un taux mesuré sur des dizaines de cartes
 * est une bien meilleure estimation qu'une impression après relecture.
 */
function noteDepuisTaux(taux) {
  if (!Number.isFinite(taux)) return null;
  if (taux >= 95) return 4;
  if (taux >= 80) return 3;
  if (taux >= 60) return 2;
  return 1;
}

/**
 * Verdict d'une épreuve.
 *
 * `concluante` distingue l'échec — le taux est sous le seuil — du cas où trop
 * peu de cartes ont été revues pour que le résultat signifie quoi que ce soit.
 * Confondre les deux reviendrait à sanctionner une séance interrompue.
 */
function jugerEpreuve(revisions, seuil = SEUIL_DEFAUT, minimum = CARTES_MINIMUM, nouvelles = [], population = null) {
  // Une carte jamais vue ne peut pas être « retrouvée » : la compter
  // mesurerait l'ignorance, et ferait échouer toute épreuve portant sur un
  // chapitre fraîchement rempli.
  const neuves = new Set((nouvelles || []).map(String));
  const aMesurer = (revisions || []).filter(r => !neuves.has(String(r.carte)));
  const decouvertes = new Set(
    (revisions || []).filter(r => neuves.has(String(r.carte))).map(r => String(r.carte)),
  ).size;

  const mesure = { ...tauxReussite(aMesurer), decouvertes };

  if (mesure.cartes === 0 && decouvertes > 0) {
    return {
      ...mesure, seuil, concluante: false, reussie: false, note: null,
      premierContact: true,
      motif: `${decouvertes} nouvelles cartes découvertes. Rien à mesurer encore : reviens quand elles auront été revues.`,
    };
  }

  if (mesure.cartes === 0) {
    return {
      ...mesure, seuil, concluante: false, reussie: false, note: null,
      motif: 'Aucune carte révisée : l\'épreuve n\'a pas eu lieu.',
    };
  }

  if (mesure.cartes < minimum) {
    return {
      ...mesure, seuil, concluante: false, reussie: false, note: null,
      motif: `Seulement ${mesure.cartes} carte${mesure.cartes > 1 ? 's' : ''} révisée${mesure.cartes > 1 ? 's' : ''} : il en faut au moins ${minimum} pour que le taux ait un sens.`,
    };
  }

  const reussie = mesure.taux >= seuil;
  const marge = margeErreur(mesure.taux, mesure.cartes, population);

  // Le seuil tombe dans la marge : la mesure ne permet pas de trancher, et le
  // prétendre reviendrait à jouer à pile ou face autour de la limite.
  const serre = marge !== null && Math.abs(mesure.taux - seuil) <= marge;

  return {
    ...mesure,
    seuil,
    marge,
    serre,
    concluante: true,
    reussie,
    note: noteDepuisTaux(mesure.taux),
    motif: reussie
      ? `${mesure.reussies} cartes sur ${mesure.cartes} retrouvées, soit ${mesure.taux} %.`
      : `${mesure.taux} % de réussite, en deçà des ${seuil} % attendus.`,
  };
}

/**
 * Déroulé complet, une fois la séance Anki terminée.
 * `depuis` est l'horodatage relevé au lancement de l'épreuve.
 */
async function releverEpreuve(requete, depuis, options = {}, appel = invoquer) {
  const cartes = await chercherCartes(requete, appel);
  const revisions = await revisionsDepuis(cartes, depuis, appel);
  return {
    ...jugerEpreuve(
      revisions,
      options.seuil ?? SEUIL_DEFAUT,
      options.minimum ?? CARTES_MINIMUM,
      options.nouvelles ?? [],
      options.population ?? null,
    ),
    cartesCiblees: cartes.length,
  };
}

/** Vrai si Anki répond. */
async function ankiDisponible(appel = invoquer) {
  try {
    await appel('version');
    return true;
  } catch {
    return false;
  }
}


// ---------------------------------------------------------------------------
// Ciblage des cartes d'un cours
// ---------------------------------------------------------------------------

/**
 * Bornes de l'échantillon interrogé lors d'une épreuve.
 *
 * La taille croît en racine carrée du chapitre : un chapitre deux fois plus
 * gros n'appelle pas une épreuve deux fois plus longue, mais il en appelle une
 * un peu plus large. Le plafond garde la séance sous les dix minutes — au-delà,
 * elle ne serait plus faite.
 */
const ECHANTILLON_MIN = 15;
const ECHANTILLON_MAX = 35;

/** Valeur de repli quand le nombre de cartes disponibles est inconnu. */
const TAILLE_ECHANTILLON = 20;

/** Quantile normal à 95 %, pour la marge d'erreur. */
const Z_MARGE = 1.96;

/** Part de l'échantillon réservée aux cartes qui ont déjà été oubliées. */
const PART_FRAGILES = 0.5;

/**
 * Cartes jamais étudiées ajoutées à une épreuve.
 *
 * Un chapitre fraîchement rempli en compte parfois plusieurs dizaines : les
 * présenter toutes transformerait la vérification en séance d'apprentissage.
 * Ce contingent les fait entrer par petits groupes, épreuve après épreuve.
 */
const NOUVELLES_PAR_EPREUVE = 5;

/**
 * Nombre de cartes à interroger pour un chapitre donné.
 * Croissance en racine carrée, bornée : quinze cartes au minimum pour qu'un
 * taux veuille dire quelque chose, trente-cinq au plus pour que l'épreuve reste
 * faisable après une révision de cours.
 */
function tailleEchantillon(disponibles) {
  const n = Number(disponibles);
  if (!Number.isFinite(n) || n <= 0) return TAILLE_ECHANTILLON;
  const propose = Math.ceil(Math.sqrt(n) * 2);
  const cible = Math.max(ECHANTILLON_MIN, Math.min(ECHANTILLON_MAX, propose));
  // Le plancher s'applique après les bornes, jamais avant : on ne tire pas
  // quinze cartes dans un chapitre qui n'en compte que dix.
  return Math.min(cible, n);
}

/**
 * Marge d'erreur d'un taux mesuré sur un échantillon, en points de pourcentage.
 *
 * L'intervalle de Wilson est employé plutôt que l'approximation normale usuelle,
 * qui s'effondre aux extrêmes : elle attribue une marge nulle à vingt réussites
 * sur vingt, comme si le score parfait d'un sondage garantissait la perfection
 * de l'ensemble. Wilson reste correct dans ce cas comme dans les autres.
 *
 * La correction pour population finie s'y ajoute : interroger vingt cartes sur
 * vingt-cinq laisse peu de place au hasard, vingt sur trois cents beaucoup.
 */
function margeErreur(taux, echantillon, population) {
  const n = Number(echantillon);
  if (!Number.isFinite(n) || n <= 1) return null;

  const p = Math.min(1, Math.max(0, (Number(taux) || 0) / 100));
  const z2 = Z_MARGE * Z_MARGE;

  // Demi-largeur de l'intervalle de Wilson.
  const demiLargeur = (Z_MARGE / (1 + z2 / n))
    * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  let marge = demiLargeur;

  const N = Number(population);
  if (Number.isFinite(N) && N > n) {
    marge *= Math.sqrt((N - n) / (N - 1));
  }

  return Number((marge * 100).toFixed(1));
}

/** Normalise pour comparer des noms de decks : casse, accents et ponctuation. */
function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Deck Anki correspondant à un cours.
 *
 * On cherche d'abord un sous-deck portant le titre du cours sous le deck de la
 * matière. À défaut, l'épreuve porte sur la matière entière — c'est moins
 * précis, et le résultat le signale plutôt que de le taire.
 */
function resoudreDeckCours(deckMatiere, titreCours, deckNames, deckExplicite = null) {
  // Un deck déclaré sur le cours lui-même l'emporte sur toute déduction : avec
  // une arborescence descendant jusqu'à la sous-section, aucun rapprochement
  // par le nom ne peut deviner qu'un « Cours 1 » couvre « Chapitre 1::I ».
  if (deckExplicite && String(deckExplicite).trim()) {
    const voulu = String(deckExplicite).trim();
    const existant = (deckNames || []).find(d => d === voulu)
      || (deckNames || []).find(d => normaliser(d) === normaliser(voulu));
    if (existant) return { deck: existant, precision: 'explicite' };
    return { deck: voulu, precision: 'explicite-introuvable' };
  }

  if (!deckMatiere) return { deck: null, precision: 'aucune' };

  const prefixe = normaliser(deckMatiere);
  const cible = normaliser(titreCours);

  if (cible) {
    const sousDecks = (deckNames || []).filter(d => {
      const n = normaliser(d);
      return n !== prefixe && n.startsWith(prefixe);
    });

    // Le sous-deck dont le dernier segment correspond au titre du cours.
    const exact = sousDecks.find(d => normaliser(d.split('::').pop()) === cible);
    if (exact) return { deck: exact, precision: 'cours' };

    // À défaut, celui qui contient le titre — le plus court, donc le plus proche.
    const partiels = sousDecks
      .filter(d => normaliser(d).includes(cible))
      .sort((a, b) => a.length - b.length);
    if (partiels.length > 0) return { deck: partiels[0], precision: 'cours' };
  }

  return { deck: deckMatiere, precision: 'matiere' };
}

/** Requête Anki visant un deck et ses sous-decks. */
function requeteDeck(deck) {
  return `deck:"${String(deck).replace(/"/g, '\\"')}"`;
}

/**
 * Compose l'échantillon soumis à l'épreuve.
 *
 * Les cartes déjà oubliées passent en premier — c'est ce qui résiste qu'il faut
 * vérifier — mais elles ne remplissent que la moitié de l'échantillon. Le reste
 * est tiré au sort parmi les autres : une épreuve composée des seules cartes
 * fragiles rendrait le seuil de réussite structurellement inatteignable, et ne
 * dirait rien de la maîtrise d'ensemble.
 */
function composerEchantillon(fragiles, toutes, taille = TAILLE_ECHANTILLON, tirage = Math.random) {
  const retenues = [];
  const dejaPrise = new Set();

  const placesFragiles = Math.floor(taille * PART_FRAGILES);
  for (const carte of melanger(fragiles || [], tirage)) {
    if (retenues.length >= placesFragiles) break;
    retenues.push(carte);
    dejaPrise.add(carte);
  }

  for (const carte of melanger(toutes || [], tirage)) {
    if (retenues.length >= taille) break;
    if (dejaPrise.has(carte)) continue;
    retenues.push(carte);
    dejaPrise.add(carte);
  }

  return retenues;
}

/** Mélange de Fisher-Yates, sur une copie. */
function melanger(liste, tirage = Math.random) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(tirage() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * Prépare l'épreuve d'un cours : trouve son deck, compose l'échantillon.
 * Renvoie de quoi ouvrir Anki, sans rien ouvrir encore.
 */
async function preparerEpreuve(deckMatiere, titreCours, options = {}, appel = invoquer) {
  const deckNames = await appel('deckNames');
  const { deck, precision } = resoudreDeckCours(deckMatiere, titreCours, deckNames, options.deckExplicite);

  if (!deck) {
    return { cartes: [], deck: null, precision, requete: null };
  }

  const base = requeteDeck(deck);
  // Les cartes jamais étudiées sont tenues à part : elles ne se révisent pas,
  // elles s'apprennent, et les mêler aux autres fausserait la mesure.
  const vues = await appel('findCards', { query: `${base} -is:new` });
  const nouvelles = await appel('findCards', { query: `${base} is:new` });
  const fragiles = await appel('findCards', { query: `${base} prop:lapses>0 -is:new` });

  const taille = options.taille ?? tailleEchantillon(vues.length);
  const revision = composerEchantillon(
    fragiles, vues, taille,
    options.tirage ?? Math.random,
  );

  // Un contingent de nouveautés à chaque épreuve : le chapitre finit couvert
  // sans qu'une seule séance ait à tout absorber.
  const contingent = options.nouvelles ?? NOUVELLES_PAR_EPREUVE;
  const aDecouvrir = melanger(nouvelles || [], options.tirage ?? Math.random).slice(0, contingent);

  const cartes = [...revision, ...aDecouvrir];

  return {
    cartes,
    revision,
    nouvelles: aDecouvrir,
    deck,
    precision,
    fragiles: fragiles.length,
    // Population de référence du sondage : seules les cartes déjà vues
    // peuvent être « retrouvées », donc seules elles comptent.
    population: vues.length,
    disponibles: vues.length + (nouvelles || []).length,
    aApprendre: (nouvelles || []).length,
    // `cid:` permet de rouvrir exactement cet échantillon dans Anki.
    requete: cartes.length > 0 ? `cid:${cartes.join(',')}` : null,
  };
}


// ---------------------------------------------------------------------------
// Diagnostic d'échec
// ---------------------------------------------------------------------------

/** Notions listées au retour d'une épreuve manquée. */
const NOTIONS_LISTEES = 6;

/**
 * Texte lisible du recto d'une carte.
 *
 * Le contenu d'Anki est du HTML, souvent chargé de balises de mise en forme et
 * de LaTeX. On n'en garde que la question, tronquée : il s'agit de reconnaître
 * la notion, pas de relire la carte.
 */
function questionLisible(carte, longueurMax = 90) {
  const champs = carte?.fields || {};
  const premier = champs.Recto?.value ?? champs.Front?.value ?? Object.values(champs)[0]?.value ?? '';

  const nu = String(premier)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return nu.length > longueurMax ? nu.slice(0, longueurMax - 1) + '…' : nu;
}

/**
 * Ce qui n'est pas passé, formulé en notions plutôt qu'en pourcentage.
 *
 * Un taux de 55 % dit qu'il faut retravailler ; il ne dit pas quoi. Or les
 * cartes échouées sont connues carte par carte : les nommer transforme un
 * constat en point de départ.
 */
async function diagnostiquerEchecs(revisions, appel = invoquer) {
  // Dernière réponse de chaque carte : une carte ratée puis retrouvée a fini
  // par tenir, elle n'a pas à figurer dans les lacunes.
  const derniere = new Map();
  for (const r of revisions || []) {
    if (Number.isFinite(r.ease)) derniere.set(String(r.carte), r.ease);
  }

  const echouees = [...derniere.entries()]
    .filter(([, ease]) => ease <= EASE_ECHEC)
    .map(([carte]) => Number(carte));

  if (echouees.length === 0) return { notions: [], total: 0, affichees: 0 };

  const infos = await appel('cardsInfo', { cards: echouees.slice(0, NOTIONS_LISTEES) });
  const notions = (infos || [])
    .map(carte => ({
      carte: carte.cardId,
      question: questionLisible(carte),
      // Une carte déjà oubliée plusieurs fois signale une lacune installée,
      // pas un simple trou de mémoire.
      recurrente: (Number(carte.lapses) || 0) >= 2,
    }))
    .filter(n => n.question);

  return { notions, total: echouees.length, affichees: notions.length };
}

module.exports = {
  invoquer,
  diagnostiquerEchecs,
  questionLisible,
  resoudreDeckCours,
  requeteDeck,
  composerEchantillon,
  melanger,
  preparerEpreuve,
  normaliser,
  TAILLE_ECHANTILLON,
  NOUVELLES_PAR_EPREUVE,
  tailleEchantillon,
  margeErreur,
  ECHANTILLON_MIN,
  ECHANTILLON_MAX,
  chercherCartes,
  ouvrirEpreuve,
  rendreCartes,
  rapatrierCartesOubliees,
  DECK_EPREUVE,
  revisionsDepuis,
  tauxReussite,
  noteDepuisTaux,
  jugerEpreuve,
  releverEpreuve,
  ankiDisponible,
  SEUIL_DEFAUT,
  CARTES_MINIMUM,
  EASE_ECHEC,
};
