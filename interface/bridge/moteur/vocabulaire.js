/**
 * Génération de vocabulaire : la consigne, et ce qu'on en fait.
 *
 * Une demande de mots sans contexte donne toujours la même chose — le lexique
 * du premier chapitre d'un manuel. Trois informations changent radicalement le
 * résultat, et ce module a pour seul objet de les réunir dans une consigne :
 *
 *   - LA LANGUE, évidemment ;
 *   - LE NIVEAU, non pas sous forme de code (« B1 » ne dit rien de précis à un
 *     modèle) mais sous forme de description de ce qu'on attend à ce palier.
 *     C'est `niveauLangue.js` qui la fournit ;
 *   - CE QUI EST DÉJÀ SU. Un deck de huit cents mots reçoit sinon, à chaque
 *     génération, les mêmes deux cents mots fréquents.
 *
 * Sur ce dernier point, deux mécanismes se complètent, et cette redondance est
 * délibérée. La liste d'exclusion transmise au modèle est *plafonnée* — envoyer
 * un deck entier coûterait cher et finirait par saturer sa fenêtre. Elle relève
 * donc du meilleur effort. Le filtrage local, lui, s'applique à la totalité des
 * mots connus et ne laisse passer aucun doublon : c'est lui qui garantit le
 * résultat, la consigne se contentant d'éviter le gaspillage.
 *
 * La même consigne sert des deux côtés : celle qu'ELPIS envoie lui-même, et
 * celle que l'on copie dans sa propre fenêtre de conversation. Il serait
 * absurde d'en entretenir deux versions qui divergeraient.
 */

/** Mots connus transmis au modèle. Au-delà, le filtrage local prend le relais. */
const PLAFOND_EXCLUSIONS = 400;

/** Bornes du nombre de mots demandés en une fois. */
const MOTS_MIN = 1;
const MOTS_MAX = 40;

/* ------------------------------------------------------------- Nettoyage */

/**
 * Texte brut d'un champ Anki.
 *
 * Les champs d'Anki contiennent du HTML : un mot saisi dans l'éditeur arrive
 * volontiers enveloppé d'un `<div>`, et les espaces y sont des `&nbsp;`.
 * Comparer ces chaînes telles quelles ferait échouer toute détection de
 * doublon sur des mots pourtant identiques.
 */
function texteBrut(valeur) {
  return String(valeur ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clé de comparaison d'un mot.
 *
 * La casse et la ponctuation d'encadrement ne distinguent pas deux entrées ;
 * les accents et les signes diacritiques, si — en espagnol, en vietnamien ou
 * en français, les retirer confondrait des mots différents. On ne normalise
 * donc que ce qui est sûrement du bruit.
 */
function clefMot(mot) {
  return texteBrut(mot)
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[\s"'«»„“”‘’([{.,;:!?¡¿-]+/u, '')
    .replace(/[\s"'«»„“”‘’)\]}.,;:!?-]+$/u, '')
    .trim();
}

/** Nombre de mots demandé, ramené dans ses bornes. */
function normaliserNombre(valeur, defaut = 10) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return defaut;
  return Math.min(MOTS_MAX, Math.max(MOTS_MIN, Math.round(n)));
}

/* ---------------------------------------------------------- Extraction */

/**
 * Extrait les cartes d'une réponse de modèle.
 *
 * Les modèles encadrent volontiers leur JSON de commentaires ou de balises de
 * code, et cette réponse peut aussi bien venir d'un appel d'API que d'un
 * copier-coller depuis une fenêtre de conversation. Échouer sur cet emballage
 * rendrait la fonctionnalité aléatoire sans aucune raison de fond.
 */
function extraireCartes(texte) {
  const brut = String(texte || '');
  const sansBalises = brut.replace(/```(?:json)?/gi, '').trim();
  const debut = sansBalises.indexOf('[');
  const fin = sansBalises.lastIndexOf(']');
  if (debut === -1 || fin === -1 || fin < debut) return [];

  let analyse;
  try {
    analyse = JSON.parse(sansBalises.slice(debut, fin + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(analyse)) return [];

  const vues = new Set();
  const cartes = [];

  for (const brute of analyse) {
    const recto = texteBrut(brute?.recto ?? brute?.mot ?? '');
    const verso = texteBrut(brute?.verso ?? brute?.traduction ?? '');
    if (!recto || !verso) continue;

    // Un modèle se répète parfois à l'intérieur d'une même réponse.
    const clef = clefMot(recto);
    if (vues.has(clef)) continue;
    vues.add(clef);

    cartes.push({ recto, verso });
  }

  return cartes;
}

/**
 * Sépare les cartes nouvelles de celles déjà présentes dans le deck.
 * C'est ce filtre, et non la consigne, qui garantit l'absence de doublon.
 */
function filtrerDoublons(cartes, motsConnus) {
  const connus = new Set((motsConnus || []).map(clefMot).filter(Boolean));
  const retenues = [];
  const ecartees = [];

  for (const carte of cartes || []) {
    if (connus.has(clefMot(carte.recto))) ecartees.push(carte);
    else retenues.push(carte);
  }

  return { retenues, ecartees };
}

/* -------------------------------------------------------------- Consigne */

/**
 * Consigne de génération, adaptée à la langue, au niveau et au déjà-su.
 *
 * @param {object}  options.langue       nom de la langue étudiée
 * @param {object}  options.niveau       sortie de `niveauLangue.js`
 * @param {number}  options.nombre       nombre d'entrées demandées
 * @param {string}  options.theme        thème facultatif
 * @param {Array}   options.motsConnus   rectos déjà présents dans le deck
 * @param {boolean} options.autonome     consigne destinée à être collée
 *                                       ailleurs, donc rappelant son propre
 *                                       format de réponse
 * @returns {{systeme: string, consigne: string, complet: string, exclusions: object}}
 */
function promptVocabulaire({ langue, niveau, nombre = 10, theme = '', motsConnus = [], autonome = false } = {}) {
  const nom = String(langue || 'la langue étudiée').trim();
  const quantite = normaliserNombre(nombre);
  const sujet = String(theme || '').trim();

  const connus = [...new Set((motsConnus || []).map(texteBrut).filter(Boolean))];
  const transmis = connus.slice(0, PLAFOND_EXCLUSIONS);
  const tronquee = connus.length > transmis.length;

  const systeme =
    "Tu prépares des cartes de vocabulaire pour Anki, destinées à un francophone. " +
    "Tu réponds UNIQUEMENT par un tableau JSON, sans texte autour et sans balise de code. " +
    'Chaque élément a exactement deux clés : "recto", le mot ou l\'expression dans la langue étudiée, ' +
    'seul et sans traduction ; "verso", la traduction française suivie entre parenthèses ' +
    "d'une phrase d'exemple courte dans la langue étudiée.";

  const lignes = [];

  lignes.push(`Langue étudiée : ${nom}.`);

  if (niveau) {
    lignes.push(
      `Niveau visé : ${niveau.code}${niveau.libelle ? ` (${niveau.libelle})` : ''} du CECR, ` +
      `estimé d'après ${niveau.heures} heures de pratique cumulées.`
    );
    if (niveau.attendu) {
      lignes.push(`À ce palier, vise ${niveau.attendu}.`);
    }
    lignes.push(
      "Écarte ce qui serait trivial à ce niveau comme ce qui le dépasserait nettement : " +
      "le bon mot est celui que l'apprenant est prêt à rencontrer, mais ne connaît pas encore."
    );
  }

  lignes.push('');
  lignes.push(
    `Propose exactement ${quantite} ${quantite > 1 ? 'entrées' : 'entrée'}` +
    (sujet ? ` sur le thème « ${sujet} »` : '') + '.'
  );
  lignes.push(
    "Varie les catégories grammaticales — pas uniquement des noms — et privilégie " +
    "ce qui sert réellement à s'exprimer plutôt que les curiosités lexicales."
  );

  if (transmis.length > 0) {
    const annonce = transmis.length > 1
      ? `Ces ${transmis.length} entrées figurent déjà dans le paquet : n'en propose aucune`
      : "Cette entrée figure déjà dans le paquet : ne la propose pas";

    lignes.push('');
    lignes.push(
      `${annonce}, ni aucune variante trop proche.` +
      (tronquee ? ` (Liste partielle : ${connus.length} entrées au total.)` : '')
    );
    lignes.push(transmis.join(' · '));
  }

  if (autonome) {
    lignes.push('');
    lignes.push('FORMAT DE RÉPONSE');
    lignes.push(
      "Réponds uniquement par un tableau JSON, sans texte autour ni balise de code. " +
      'Chaque élément a exactement deux clés : "recto" (le mot ou l\'expression en ' +
      `${nom}, seul) et "verso" (la traduction française, puis entre parenthèses une ` +
      `phrase d'exemple courte en ${nom}).`
    );
    lignes.push('Je collerai ta réponse telle quelle dans mon application de révision.');
  }

  const consigne = lignes.join('\n');

  return {
    systeme,
    consigne,
    complet: autonome ? consigne : `${systeme}\n\n${consigne}`,
    exclusions: { transmises: transmis.length, connues: connus.length, tronquee },
  };
}

module.exports = {
  PLAFOND_EXCLUSIONS,
  MOTS_MIN,
  MOTS_MAX,
  texteBrut,
  clefMot,
  normaliserNombre,
  extraireCartes,
  filtrerDoublons,
  promptVocabulaire,
};
