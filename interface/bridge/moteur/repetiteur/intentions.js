/**
 * Reconnaissance de ce qui est demandé.
 *
 * Un modèle de langage devine l'intention ; ici on la reconnaît. La différence
 * tient en une phrase : quand rien ne correspond, ce module rend `null`, et le
 * Répétiteur le dit. Il ne brodera jamais une réponse plausible sur une
 * question qu'il n'a pas comprise — c'est précisément ce qu'on lui reprocherait
 * quand il s'agit de notes ou de programme.
 *
 * Chaque intention porte des *motifs* : des listes de termes qui doivent tous
 * apparaître. Un motif plus long l'emporte sur un motif plus court, si bien
 * qu'« où j'en suis en analyse » est reconnu comme une question sur une matière
 * plutôt que comme un état d'avancement général.
 *
 * Une intention peut aussi *emporter* la décision : elle gagne dès qu'un de ses
 * motifs correspond, quelle que soit la longueur des autres. Un seul cas s'en
 * sert, et il vaut d'être expliqué. « Que dois-je faire demain ? » contenait le
 * motif « que dois je faire » : la question partait vers le programme du jour
 * et recevait, avec aplomb, le programme d'aujourd'hui. Aucun mot n'était faux
 * dans cette réponse ; elle portait simplement sur un autre jour que celui
 * demandé. C'est la forme d'erreur la plus difficile à repérer pour qui lit,
 * donc celle qu'il faut intercepter.
 */

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
function normaliser(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Intentions reconnues.
 * L'ordre de cette liste ne décide de rien : c'est la longueur du motif qui
 * départage, et `emporte` qui tranche en dernier ressort.
 */
const INTENTIONS = [
  {
    cle: 'aide',
    motifs: [
      ['que', 'sais', 'faire'], ['qu', 'est', 'ce', 'que', 'tu', 'sais'],
      ['aide'], ['tu', 'peux', 'faire', 'quoi'], ['comment', 'utiliser'],
      ['a', 'quoi', 'tu', 'sers'], ['tes', 'capacites'], ['que', 'peux', 'tu', 'me', 'dire'],
    ],
  },
  {
    cle: 'salutation',
    motifs: [['bonjour'], ['bonsoir'], ['salut'], ['coucou'], ['hello']],
  },

  /* ------------------------------------------------------- La journée */

  {
    cle: 'demain',
    // Garde : voir l'en-tête du module. Toute question tournée vers demain doit
    // être interceptée, faute de quoi elle reçoit les chiffres d'aujourd'hui.
    emporte: true,
    motifs: [['demain'], ['la', 'semaine', 'prochaine'], ['apres', 'demain']],
  },
  {
    cle: 'programme_du_jour',
    motifs: [
      ['que', 'dois', 'je', 'faire'], ['quoi', 'faire'], ['programme', 'aujourd', 'hui'],
      ['mon', 'programme'], ['ma', 'journee'], ['quoi', 'reviser'], ['seance', 'du', 'jour'],
      ['taches', 'aujourd', 'hui'], ['aujourd', 'hui'], ['par', 'quoi', 'je', 'commence'],
    ],
  },
  {
    cle: 'pourquoi_repos',
    motifs: [
      ['pourquoi', 'du', 'repos'], ['pourquoi', 'jour', 'de', 'repos'],
      ['pourquoi', 'je', 'n', 'ai', 'rien', 'a', 'faire'], ['jour', 'de', 'repos'],
      ['pourquoi', 'tu', 'bloques'], ['je', 'peux', 'quand', 'meme', 'travailler'],
      ['pourquoi', 'rien', 'aujourd', 'hui'], ['repos'],
      // Sans ce motif, la question part vers `absence_du_programme`, qui
      // cherche alors une matière nommée « repos ».
      ['pourquoi', 'pas', 'de', 'repos'], ['pourquoi', 'pas', 'de', 'jour', 'de', 'repos'],
    ],
  },
  {
    cle: 'pourquoi',
    /*
     * « Pourquoi tu me proposes ça ? » et « pourquoi tu ne me proposes pas
     * ça ? » sont deux questions opposées. L'appariement ignore l'ordre des
     * mots et ne connaît pas la négation : les deux tombaient donc ici, et la
     * seconde recevait l'explication du programme retenu — une réponse
     * cohérente, chiffrée, et qui ne portait pas sur la question posée. Le motif
     * positif l'emportait de surcroît par sa seule longueur (23 contre 21).
     *
     * `exclut` règle cela sans toucher au classement : une question qui nie
     * n'est jamais une question sur ce qui a été retenu, elle appartient à
     * `absence_du_programme`.
     */
    exclut: ['pas'],
    motifs: [
      ['pourquoi', 'ce', 'cours'], ['pourquoi', 'cette', 'tache'], ['pourquoi', 'ce', 'td'],
      ['pourquoi', 'tu', 'me', 'proposes'], ['pourquoi', 'ca'], ['pourquoi'],
      ['pourquoi', 'cette', 'duree'], ['pourquoi', 'c', 'est', 'si', 'long'],
    ],
  },
  {
    cle: 'absence_du_programme',
    motifs: [
      ['pourquoi', 'il', 'n', 'y', 'a', 'pas'], ['pourquoi', 'pas', 'de'],
      ['n', 'apparait', 'pas'], ['ou', 'est', 'passee'], ['tu', 'ne', 'me', 'proposes', 'pas'],
      ['pourquoi', 'cette', 'matiere', 'n', 'est', 'pas'],
      // L'apostrophe devient une espace à la normalisation : « pas d'Optique »
      // s'écrit « pas d optique ».
      ['pourquoi', 'pas', 'd'], ['n', 'est', 'pas', 'au', 'programme'],
      ['je', 'n', 'ai', 'pas', 'de'], ['n', 'est', 'pas', 'dans', 'mon', 'programme'],
    ],
  },
  {
    cle: 'temps_libre_restant',
    motifs: [
      ['combien', 'de', 'temps', 'il', 'me', 'reste'], ['temps', 'libre'],
      ['il', 'me', 'reste', 'combien', 'de', 'temps'], ['j', 'ai', 'fini', 'ma', 'journee'],
      ['combien', 'de', 'temps', 'encore'],
    ],
  },

  /* ------------------------------------------------------- L'état des lieux */

  {
    cle: 'retard',
    motifs: [
      ['en', 'retard'], ['du', 'retard'], ['qu', 'est', 'ce', 'qui', 'traine'],
      ['j', 'ai', 'rate'], ['oublie'], ['decroche'],
    ],
  },
  {
    cle: 'moyenne',
    motifs: [
      ['ma', 'moyenne'], ['mes', 'notes'], ['moyenne', 'generale'], ['j', 'ai', 'combien'],
      ['mes', 'resultats'], ['moyenne'], ['notes'],
    ],
  },
  {
    cle: 'avancement',
    motifs: [
      ['ou', 'j', 'en', 'suis'], ['ma', 'progression'], ['mon', 'avancement'],
      ['combien', 'il', 'me', 'reste'], ['ou', 'en', 'suis', 'je'], ['avancement'],
    ],
  },
  {
    cle: 'contenu_matiere',
    motifs: [
      ['combien', 'de', 'chapitres'], ['combien', 'de', 'cours', 'dans'],
      ['qu', 'est', 'ce', 'que', 'je', 'n', 'ai', 'jamais'], ['jamais', 'travaille'],
      ['jamais', 'aborde'], ['mes', 'chapitres'],
    ],
  },
  {
    cle: 'temps_travaille',
    motifs: [
      ['combien', 'd', 'heures'], ['j', 'ai', 'travaille'], ['temps', 'travaille'],
      ['combien', 'de', 'temps', 'j', 'ai'], ['cette', 'semaine'], ['ce', 'mois'],
    ],
  },
  {
    cle: 'repartition_temps',
    motifs: [
      ['sur', 'quoi', 'je', 'passe', 'le', 'plus', 'de', 'temps'],
      ['repartition', 'de', 'mon', 'temps'], ['quelle', 'matiere', 'je', 'travaille', 'le', 'plus'],
    ],
  },
  {
    cle: 'derniere_activite',
    motifs: [
      ['derniere', 'fois', 'que', 'j', 'ai', 'travaille'], ['qu', 'est', 'ce', 'que', 'j', 'ai', 'fait', 'hier'],
      ['c', 'etait', 'quand', 'la', 'derniere', 'fois'], ['ma', 'derniere', 'seance'], ['hier'],
    ],
  },
  {
    cle: 'serie_jours',
    motifs: [
      ['plus', 'longue', 'serie'], ['ma', 'serie'], ['combien', 'de', 'jours', 'd', 'affilee'],
      ['jours', 'consecutifs'], ['ma', 'regularite'],
    ],
  },
  {
    cle: 'surcharge',
    motifs: [
      ['en', 'surcharge'], ['risque', 'le', 'burnout'], ['je', 'force', 'trop'],
      ['signes', 'de', 'fatigue'], ['je', 'suis', 'creve'], ['burnout'], ['surcharge'],
    ],
  },

  /* ------------------------------------------------------- Le cursus */

  {
    cle: 'saisie_incomplete',
    motifs: [
      ['qu', 'est', 'ce', 'qui', 'manque'], ['ma', 'saisie'], ['qu', 'est', 'ce', 'que', 'je', 'dois', 'remplir'],
      ['ce', 'qui', 'n', 'est', 'pas', 'saisi'], ['qu', 'est', 'ce', 'qu', 'il', 'me', 'manque'],
      ['par', 'ou', 'commencer'], ['par', 'ou', 'je', 'commence'],
    ],
  },
  {
    cle: 'cursus_structure',
    motifs: [
      ['structure', 'de', 'mon', 'cursus'], ['mon', 'cursus'], ['combien', 'de', 'matieres'],
      ['combien', 'd', 'ue'], ['mes', 'ue'], ['mes', 'matieres'], ['mes', 'semestres'],
    ],
  },
  {
    cle: 'coefficients',
    motifs: [
      ['quel', 'coefficient'], ['mes', 'coefficients'], ['coefficient'], ['coefficients'],
      ['combien', 'd', 'ects', 'vaut'], ['ects'],
    ],
  },
  {
    cle: 'volume_horaire',
    motifs: [
      ['combien', 'd', 'heures', 'de', 'cours'], ['volume', 'horaire'],
      ['heures', 'de', 'cm'], ['heures', 'de', 'td'], ['heures', 'de', 'tp'],
    ],
  },
  {
    cle: 'examens',
    motifs: [
      ['prochain', 'examen'], ['prochains', 'examens'], ['quand', 'est', 'mon', 'examen'],
      ['mes', 'examens'], ['partiel'], ['partiels'], ['examen'], ['examens'],
      ['mes', 'epreuves'], ['mes', 'controles'], ['controle', 'continu'], ['epreuves'],
    ],
  },
  {
    cle: 'date_rentree',
    motifs: [
      ['la', 'rentree'], ['quand', 'je', 'commence'], ['dans', 'combien', 'de', 'jours', 'la', 'rentree'],
      ['debut', 'des', 'cours'], ['rentree'],
    ],
  },
  {
    cle: 'emploi_du_temps_fixe',
    motifs: [
      ['emploi', 'du', 'temps'], ['mes', 'creneaux'], ['mes', 'cours', 'fixes'],
      ['engagements', 'fixes'], ['quand', 'j', 'ai', 'cours'],
    ],
  },

  /* ------------------------------------------------------- Le reste */

  {
    cle: 'capacite',
    motifs: [
      ['combien', 'd', 'heures', 'par', 'jour'], ['combien', 'de', 'temps', 'par', 'jour'],
      ['rythme'], ['ma', 'capacite'], ['charge'],
    ],
  },
  {
    cle: 'reglages',
    motifs: [
      ['mes', 'reglages'], ['ma', 'configuration'], ['quels', 'reglages'],
      ['mes', 'parametres'], ['comment', 'je', 'suis', 'regle'],
    ],
  },
  {
    cle: 'langues',
    motifs: [['mes', 'langues'], ['ma', 'langue'], ['langue'], ['langues'], ['mon', 'niveau', 'en']],
  },
  {
    cle: 'absences',
    motifs: [
      ['mes', 'absences'], ['absence'], ['absences'], ['assiduite'],
      ['justificatif'], ['a', 'justifier'],
    ],
  },
  {
    cle: 'projets',
    motifs: [['mes', 'projets'], ['projet'], ['projets']],
  },
  {
    cle: 'methode',
    motifs: [
      ['repetition', 'espacee'], ['comment', 'ca', 'marche'], ['comment', 'tu', 'choisis'],
      ['fsrs'], ['ta', 'methode'], ['algorithme'],
    ],
  },
  {
    cle: 'donnees_conservees',
    motifs: [
      ['qu', 'est', 'ce', 'que', 'tu', 'gardes'], ['mes', 'donnees'],
      ['qu', 'est', 'ce', 'que', 'tu', 'sais', 'de', 'moi'], ['ce', 'que', 'tu', 'stockes'],
    ],
  },

  /* --------------------------------------- Le règlement : on cite, on ne juge pas */

  {
    cle: 'reglement_assiduite',
    motifs: [
      ['presence', 'obligatoire'], ['la', 'presence', 'en', 'td'], ['assiduite', 'obligatoire'],
      ['combien', 'de', 'temps', 'pour', 'justifier'], ['delai', 'de', 'justificatif'],
    ],
  },
  {
    cle: 'reglement_absence_epreuve',
    motifs: [
      ['rate', 'un', 'controle'], ['manque', 'une', 'epreuve'], ['absent', 'a', 'un', 'examen'],
      ['ca', 'veut', 'dire', 'quoi', 'def'], ['defaillance'], ['def'], ['ac'], ['sc'],
    ],
  },
  {
    cle: 'reglement_compensation',
    motifs: [
      ['la', 'compensation'], ['comment', 'marche', 'la', 'compensation'], ['compense'],
      ['compensation'], ['compensable'],
    ],
  },
  {
    cle: 'reglement_progression',
    motifs: [
      ['passer', 'en', 'l3'], ['passe', 'en', 'l3'], ['l3'],
      ['ajac'], ['valider', 'mon', 'annee'], ['progression'],
      ['combien', 'd', 'ects', 'pour', 'valider'], ['redoubler'], ['capitalisation'],
      ['rattrapage'], ['rattrapages'], ['seconde', 'session'],
    ],
  },
  {
    cle: 'reglement_maquette',
    motifs: [
      ['la', 'maquette'], ['maquette'], ['quelles', 'ue', 'ce', 'semestre'], ['reglement'],
    ],
  },
];

/**
 * Matières évoquées dans la question.
 *
 * Deux passes. La première cherche le nom complet, normalisé : elle est sûre,
 * et la correspondance la plus longue l'emporte (« mathématiques pour les
 * sciences physiques 3 » plutôt que « mathématiques »). La seconde, un repli
 * sur les mots significatifs, ne l'est pas : elle rendait « Méthodes
 * mathématiques pour la physique » à qui demandait « physique expérimentale ».
 *
 * Un chiffre exact attribué à la mauvaise matière est plus trompeur qu'un aveu
 * d'ignorance : on rend donc *toutes* les correspondances du repli, et
 * l'appelant refuse de choisir quand il y en a plusieurs.
 *
 * @returns {string[]} noms retenus, du plus probable au moins probable
 */
function matieresCitees(question, noms = []) {
  const q = ` ${normaliser(question)} `;
  const complets = [];

  for (const nom of noms) {
    const n = normaliser(nom);
    if (n && q.includes(` ${n} `)) complets.push(nom);
  }
  if (complets.length > 0) {
    return complets.sort((a, b) => normaliser(b).length - normaliser(a).length);
  }

  // Repli : les intitulés officiels sont longs, on les cite rarement en entier.
  // Le mot le plus long qui correspond départage ; à égalité, on ne tranche pas.
  const motsQuestion = new Set(q.trim().split(' '));
  const candidats = [];

  for (const nom of noms) {
    // Les mots de l'intitulé sont dédoublonnés : sans cela « Mécanique 4 :
    // Mécanique des fluides » l'emportait sur « Mécanique 3 » pour la seule
    // raison qu'il répète le mot, ce qui ne dit rien de ce qui est demandé.
    const mots = [...new Set(normaliser(nom).split(' ').filter(m => m.length >= 5))];
    const communs = mots.filter(m => motsQuestion.has(m));
    if (communs.length > 0) {
      candidats.push({
        nom,
        poids: communs.reduce((a, m) => a + m.length, 0),
        nb: communs.length,
      });
    }
  }

  candidats.sort((a, b) => (b.nb - a.nb) || (b.poids - a.poids));
  if (candidats.length === 0) return [];

  // Un candidat strictement meilleur que les autres est retenu seul.
  const tete = candidats[0];
  const exaequo = candidats.filter(c => c.nb === tete.nb && c.poids === tete.poids);
  return exaequo.length === 1 ? [tete.nom] : exaequo.map(c => c.nom);
}

/**
 * Matière citée, ou `null` — y compris quand plusieurs conviennent.
 * L'ambiguïté se lit alors avec `matieresCitees`.
 */
function matiereCitee(question, noms = []) {
  const trouvees = matieresCitees(question, noms);
  return trouvees.length === 1 ? trouvees[0] : null;
}

/**
 * Intention reconnue, ou `null`.
 * @returns {{cle: string, precision: number}|null}
 */
function reconnaitre(question) {
  const q = ` ${normaliser(question)} `;
  if (!q.trim()) return null;

  let meilleure = null;

  for (const intention of INTENTIONS) {
    // Une intention peut refuser les questions qui portent certains mots :
    // c'est ainsi que la négation se distingue de l'affirmation.
    if (intention.exclut && intention.exclut.some(terme => q.includes(` ${terme} `))) continue;
    for (const motif of intention.motifs) {
      if (!motif.every(terme => q.includes(` ${terme} `))) continue;

      const precision = motif.join(' ').length;
      // `emporte` tranche avant toute comparaison de longueur.
      if (intention.emporte) return { cle: intention.cle, precision };
      if (!meilleure || precision > meilleure.precision) {
        meilleure = { cle: intention.cle, precision };
      }
    }
  }

  return meilleure;
}

module.exports = { normaliser, reconnaitre, matiereCitee, matieresCitees, INTENTIONS };
