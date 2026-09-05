const { reconnaitre, matieresCitees } = require('./intentions');
const { LIBELLE_ABSENCE } = require('./connaissances');
const { citer, reglementLisible, RESERVE } = require('./reglement');

/**
 * Mise en mots des faits rassemblés.
 *
 * Rien n'est inventé ici : chaque phrase se compose de valeurs calculées. Quand
 * une donnée manque, la réponse le dit au lieu de combler — c'est la seule
 * façon de faire du Répétiteur une source à laquelle on peut se fier pour ses
 * propres notes.
 *
 * Trois règles tiennent tout le fichier :
 *
 *   1. Un zéro qui vient d'une absence de mesure n'est pas un zéro constaté.
 *      « Aucune séance enregistrée » et « tu n'as pas travaillé » ne sont pas
 *      la même phrase, et seule la première est vérifiable.
 *   2. Un chiffre exact attribué à la mauvaise matière est pire qu'un aveu :
 *      quand plusieurs matières correspondent, on demande laquelle.
 *   3. Sur le règlement, on cite ; on ne conclut pas. Déduire « tu es donc
 *      défaillant » d'un article et d'une absence, c'est rendre un avis de
 *      scolarité à la place du jury.
 */

const heures = (minutes) => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const reste = m % 60;
  if (h === 0) return `${reste} min`;
  if (reste === 0) return `${h} h`;
  return `${h} h ${String(reste).padStart(2, '0')}`;
};

/**
 * Accord en nombre.
 * Les mots déjà terminés par s, x ou z sont invariables : « 3 cours » et non
 * « 3 courss ». Le pluriel irrégulier se passe en troisième argument.
 */
const pluriel = (n, singulier, plurielMot) => {
  if (n <= 1) return singulier;
  if (plurielMot) return plurielMot;
  // Invariables : cours, prix, nez.
  if (/[sxz]$/i.test(singulier)) return singulier;
  // Créneaux, jeux, travaux : le « s » naïf donnait « 2 créneaus ».
  if (/(eau|eu)$/i.test(singulier)) return `${singulier}x`;
  if (/al$/i.test(singulier)) return `${singulier.slice(0, -2)}aux`;
  return `${singulier}s`;
};

/** Liste à la française : « a, b et c ». */
function enumerer(elements) {
  const l = (elements || []).filter(Boolean);
  if (l.length === 0) return '';
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`;
}

/** Liste tronquée : « a, b et 12 autres ». */
function enumererPartiel(elements, max = 4) {
  const l = (elements || []).filter(Boolean);
  if (l.length <= max) return enumerer(l);
  return `${l.slice(0, max).join(', ')} et ${l.length - max} ${pluriel(l.length - max, 'autre')}`;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Date ISO rendue lisible : « 7 septembre 2026 ». */
function dateLisible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const jour = Number(m[3]);
  return `${jour === 1 ? '1er' : jour} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** « dans 8 jours », « demain », « aujourd'hui », « il y a 3 jours ». */
function quand(jours) {
  if (!Number.isFinite(jours)) return '';
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  if (jours === -1) return 'hier';
  return jours > 0 ? `dans ${jours} jours` : `il y a ${-jours} jours`;
}

const CAPACITES = [
  'ton programme du jour, et pourquoi chaque tâche y figure',
  'ce qui a pris du retard, et ce qui manque encore à ta saisie',
  'tes moyennes, tes coefficients, tes épreuves déclarées',
  'ton avancement, ton temps de travail, ta régularité',
  'la structure de ton cursus et tes réglages',
  'tes langues, tes absences et les délais qui courent',
  'ce que dit le règlement des études — en le citant',
  'la méthode que suit le planificateur',
];

function aide() {
  return [
    'Je réponds à partir de tes données, pas d’un modèle de langage : les chiffres que je donne sont ceux de ton application, au moment où tu me poses la question.',
    '',
    'Ce que je sais dire :',
    ...CAPACITES.map(c => `• ${c}`),
    '',
    'Si je ne comprends pas une question, je te le dirai plutôt que d’improviser. Et si plusieurs matières peuvent correspondre à ce que tu écris, je te demanderai laquelle.',
  ].join('\n');
}

function salutation(f) {
  const r = f.rentree;
  const attente = r && r.jours > 0
    ? ` La rentrée est ${quand(r.jours)}, le ${dateLisible(r.date)}.`
    : '';

  if (f.contenuVide) {
    return `Bonjour.${attente} Ton cursus est en place — ${f.structure.nbMatieres} matières, ${f.structure.nbUE} UE — mais aucun chapitre n’y figure encore. Demande-moi « qu’est-ce qui manque ? » et je te dis par quoi commencer.`;
  }
  const t = f.rapport?.tachesDuJour?.length || 0;
  if (t === 0) return `Bonjour. Rien n’est prévu aujourd’hui.${attente}`;
  return `Bonjour. ${t} ${pluriel(t, 'tâche')} ${pluriel(t, 't’attend', 't’attendent')} aujourd’hui. Demande-moi « pourquoi ? » si tu veux savoir ce qui les a fait remonter.`;
}

/* ------------------------------------------------------------- La journée */

function programmeDuJour(f) {
  if (f.contenuVide) {
    return 'Je ne peux rien te proposer : aucun cours ni exercice n’est enregistré. Ajoute tes chapitres dans la Bibliothèque, le programme se construira tout seul.';
  }
  const r = f.rapport;
  if (!r) return 'Je n’arrive pas à lire le programme du jour. Le serveur répond-il ?';

  if (r.statut === 'REPOS' || r.statut === 'REPOS_OPTIONNEL') return pourquoiRepos(f);

  const taches = r.tachesDuJour || [];
  if (taches.length === 0) return 'Rien n’est prévu aujourd’hui.';

  const parType = {};
  for (const t of taches) parType[t.type] = (parType[t.type] || 0) + 1;
  const detail = Object.entries(parType).map(([type, n]) => `${n} ${type}`);

  const lignes = taches.slice(0, 8).map(t =>
    `• ${t.type} — ${t.titre}${t.matiere && t.matiere !== 'Routine' ? ` (${t.matiere})` : ''}, ~${t.dureeMinutes} min`);
  if (taches.length > 8) lignes.push(`• … et ${taches.length - 8} de plus`);

  return [
    `${taches.length} ${pluriel(taches.length, 'tâche')} aujourd’hui — ${enumerer(detail)} — pour ${heures(r.tempsRequisMin)} de travail.`,
    '',
    ...lignes,
  ].join('\n');
}

/**
 * Garde : toute question tournée vers demain.
 *
 * L'orchestrateur ne sait produire que le programme du jour — `genererRapport
 * Quotidien` n'accepte aucune date. Répondre à « que dois-je faire demain ? »
 * avec les tâches d'aujourd'hui donnerait une réponse dont chaque mot est vrai
 * et dont l'ensemble est faux : c'est l'erreur la plus difficile à repérer pour
 * qui lit. On refuse, et on dit pourquoi.
 */
function demain(f) {
  const lignes = [
    'Je ne sais pas dire ce que tu auras à faire demain, et je préfère te le dire : le programme est recalculé chaque matin, à partir de ce que tu auras révisé d’ici là. Te donner celui d’aujourd’hui en le présentant comme celui de demain serait faux.',
  ];

  const prochain = (f.examens || [])[0];
  if (prochain) {
    lignes.push('', `Ce que je peux te dire de la suite : ${prochain.matiere} — ${prochain.nom}, le ${dateLisible(prochain.date)}, ${quand(prochain.joursRestants)}.`);
  }

  const engagements = f.emploiDuTemps?.liste || [];
  if (engagements.length > 0) {
    lignes.push('', `Tes créneaux fixes, eux, ne bougent pas : ${enumerer(engagements.map(e => `${e.jour} ${e.debut}–${e.fin}${e.matiere ? ` (${e.matiere})` : ''}`))}.`);
  }
  return lignes.join('\n');
}

/**
 * Pourquoi la journée est en repos.
 *
 * Cinq causes distinctes produisent le même statut, et une seule est
 * l'anti-épuisement. Les confondre ferait croire à une alerte de fatigue là où
 * il n'y a qu'un week-end avant la rentrée.
 */
function pourquoiRepos(f) {
  const r = f.rapport;
  if (!r) return 'Je n’arrive pas à lire l’état du jour.';

  if (r.statut !== 'REPOS' && r.statut !== 'REPOS_OPTIONNEL') {
    return 'Aujourd’hui n’est pas un jour de repos : le programme est actif.';
  }

  const impose = r.statut === 'REPOS';
  const fatigue = r.intelligence?.burnoutRisk;

  const lignes = [
    impose
      ? 'Aujourd’hui est un jour de repos imposé.'
      : 'Aujourd’hui est proposé en repos — proposé, pas imposé : tu peux le lever depuis le tableau de bord.',
  ];

  if (r.message) lignes.push('', r.message.replace(/^🛡️\s*/, ''));

  lignes.push('');
  if (fatigue?.shouldForceRest) {
    lignes.push(`Cause : l’anti-épuisement. ${fatigue.reason || ''}`.trim());
  } else {
    lignes.push('Ce n’est pas l’anti-épuisement : aucun signal de fatigue n’est levé en ce moment.');
    const rentree = f.rentree;
    if (rentree && rentree.jours > 0) {
      lignes.push(`Ta reprise est fixée au ${dateLisible(rentree.date)} — d’ici là, les week-ends sont proposés en repos.`);
    }
  }

  return lignes.join('\n');
}

function pourquoi(f) {
  const taches = f.rapport?.tachesDuJour || [];
  if (taches.length === 0) return 'Il n’y a aucune tâche à expliquer aujourd’hui.';

  const lignes = taches.slice(0, 6).map(t => {
    const raisons = t.explication?.raisons || [];
    const motif = raisons.length ? raisons.join(' · ') : 'échéance de révision atteinte';
    return `• ${t.titre} — ${motif}${Number.isFinite(t.priorite) ? ` (priorité ${t.priorite}/100)` : ''}`;
  });

  return [
    'Voici ce qui a fait remonter chaque tâche :',
    '',
    ...lignes,
    '',
    'La priorité mêle l’échéance d’oubli, la proximité des examens, la faiblesse de la matière — moyenne sous 12/20 — et la part du contenu jamais abordée.',
  ].join('\n');
}

/** Réponse type quand plusieurs matières peuvent correspondre. */
function ambiguite(noms) {
  return [
    `Plusieurs matières peuvent correspondre : ${enumerer(noms)}.`,
    '',
    'Je préfère te demander laquelle plutôt que d’en choisir une — un chiffre juste attribué à la mauvaise matière serait plus trompeur qu’une question.',
  ].join('\n');
}

/**
 * Pourquoi une matière n'est pas au programme.
 *
 * Le Répétiteur ne voit pas les candidats écartés : l'orchestrateur n'expose pas
 * ses viviers. Il ne peut donc nommer qu'un motif qu'il a lui-même reconstaté.
 * Quand plusieurs garde-fous pourraient s'appliquer sans qu'aucun ne soit
 * vérifiable, il le dit plutôt que de désigner le plus plausible.
 */
/**
 * Ce que veut dire chaque refus de l'ordonnanceur, en français.
 *
 * Les trois situations — « elle est à jour », « le quota l'a sortie », « un
 * prérequis la bloque » — appellent trois conduites opposées : attendre,
 * insister, ou aller lire le cours d'abord. Les confondre coûte une semaine.
 */
const MOTIFS_ECART = {
  QUOTA_MATIERES_PAR_JOUR: 'ton réglage limite le nombre de matières par jour, et d’autres sont passées devant au classement',
  BUDGET_JOURNEE: 'le temps de ta journée était déjà entièrement pris',
  BUDGET_DECOUVERTE: 'la moitié de la journée est réservée aux révisions dues, et le matériau neuf avait déjà sa part',
  PLAFOND_NOUVEAUX_CHAPITRES: 'le plafond de nouveaux chapitres par semestre était atteint pour aujourd’hui',
  LIMITE_PAR_MATIERE: 'cette matière avait déjà son quota de tâches pour la journée',
};

function absenceDuProgramme(f, question) {
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const nom = citees[0];
  const constats = [];

  if (f.contenuVide) {
    constats.push('aucun chapitre n’est enregistré, donc le planificateur n’a rien à proposer — ni pour cette matière ni pour une autre');
  } else if (nom) {
    const m = f.matieres.find(x => x.nom === nom);
    if (m && m.cours === 0) constats.push(`aucun chapitre n’est saisi en ${nom}`);
  }

  const r = f.rapport;
  if (r && (r.statut === 'REPOS' || r.statut === 'REPOS_OPTIONNEL')) {
    constats.push('la journée est en repos, donc aucun programme n’a été produit');
  }

  const engagement = (f.emploiDuTemps?.liste || []).find(e => nom && e.matiere === nom);
  if (engagement) {
    constats.push(`tu as un créneau fixe ${engagement.jour} ${engagement.debut}–${engagement.fin} sur cette matière, qui occupe déjà ${heures(engagement.minutes)} de ta semaine`);
  }

  /*
   * L'ordonnanceur écarte des candidats par une demi-douzaine de règles, et ne
   * gardait aucune trace de ses refus : cette réponse ne pouvait qu'avouer son
   * ignorance, alors que la cause est déterministe et tient souvent dans un
   * réglage. Le rapport porte désormais `candidatsEcartes` ; on le lit.
   */
  const ecartes = Array.isArray(r?.candidatsEcartes) ? r.candidatsEcartes : null;
  const siennes = ecartes && nom ? ecartes.filter(c => c.matiere === nom) : [];
  if (siennes.length > 0) {
    const parMotif = new Map();
    for (const c of siennes) parMotif.set(c.motif, (parMotif.get(c.motif) || 0) + 1);
    for (const [motif, combien] of parMotif) {
      const quoi = `${combien} ${pluriel(combien, 'tâche')} de cette matière ${combien > 1 ? 'ont été examinées' : 'a été examinée'} puis écartée${combien > 1 ? 's' : ''}`;
      constats.push(`${quoi} : ${MOTIFS_ECART[motif] || motif}`);
    }
  } else if (ecartes && nom && !f.contenuVide) {
    constats.push(`aucune tâche de cette matière n’était candidate aujourd’hui — rien n’y était dû, ou son contenu manque`);
  }

  const entete = nom
    ? `Pourquoi ${nom} n’est pas au programme :`
    : 'Pourquoi une matière peut ne pas être au programme :';

  if (constats.length === 0) {
    return [
      entete,
      '',
      ecartes
        ? 'Je lis les tâches écartées, mais aucune ne concerne cette matière — nomme-la moi précisément si je me suis trompé de matière.'
        : 'Je ne peux pas te le dire avec certitude. Je vois le programme retenu, pas les tâches écartées en cours de route — plusieurs règles peuvent avoir joué (nombre de matières par jour, alternance cours/exercices, prérequis non levé) sans que je puisse constater laquelle.',
      '',
      'Demande-moi « pourquoi ? » pour savoir ce qui a fait remonter les tâches retenues : c’est l’autre bout de la même explication.',
    ].join('\n');
  }

  return [entete, '', ...constats.map(c => `• ${c}`)].join('\n');
}

function tempsLibreRestant(f) {
  const t = f.tempsLibre;
  if (t.capaciteMin === null) {
    return 'Tu n’as pas déclaré de capacité quotidienne : je n’ai pas de total dont retrancher ton travail du jour.';
  }

  const lignes = [
    `Tu t’es fixé ${heures(t.capaciteMin)} par jour. Aujourd’hui tu en as utilisé ${heures(t.travailleMin)} sur ${t.seances} ${pluriel(t.seances, 'séance')} — il te reste ${heures(t.resteMin)}.`,
  ];

  const r = f.rapport;
  if (r && (r.statut === 'REPOS' || r.statut === 'REPOS_OPTIONNEL')) {
    lignes.push('', 'À noter : la journée est en repos, donc aucun programme n’a été produit — ce temps est libre, pas planifié.');
  } else if (r && Number.isFinite(r.tempsRequisMin) && r.tempsRequisMin > 0) {
    lignes.push('', `Le programme du jour en demande ${heures(r.tempsRequisMin)}.`);
  }

  return lignes.join('\n');
}

/* --------------------------------------------------------- L'état des lieux */

/**
 * Les retards sont lus sur le cursus, pas sur le rapport du jour : celui-ci
 * s'arrête avant de les calculer les jours de repos, et répondre « rien n'a
 * décroché » un dimanche où trois chapitres traînent serait exactement le
 * genre d'affirmation que ce Répétiteur doit s'interdire.
 */
function retard(f) {
  if (f.contenuVide) {
    return 'Rien ne peut être en retard : aucun cours n’est encore enregistré.';
  }

  const t = f.retards;
  const n = t.enSouffrance.length;

  if (n === 0) {
    return t.dues === 0
      ? 'Rien n’a décroché, et aucune révision n’est arrivée à échéance aujourd’hui.'
      : `Rien n’a décroché. ${t.dues} ${pluriel(t.dues, 'révision')} ${pluriel(t.dues, 'est due', 'sont dues')}, toutes dans les délais.`;
  }

  const lignes = t.enSouffrance.slice(0, 5).map(d =>
    `• ${d.titre} (${d.matiere}) — ${d.joursEnRetard} ${pluriel(d.joursEnRetard, 'jour')} de retard sur un cycle de ${d.intervalle}`);
  if (n > 5) lignes.push(`• … et ${n - 5} de plus`);

  return [
    `${n} ${pluriel(n, 'cours')} ${pluriel(n, 'attend', 'attendent')} depuis plus du double du délai prévu, jusqu’à ${t.retardMax} ${pluriel(t.retardMax, 'jour')} — soit ${heures(t.minutesEnSouffrance)} à reprendre.`,
    '',
    ...lignes,
    '',
    'Un chapitre délaissé est repris chaque jour en priorité, sans alourdir ta journée : l’arriéré se résorbe de lui-même si tu tiens le rythme.',
  ].join('\n');
}

function moyennes(f, question) {
  const n = f.notes;
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  if (n.nbNotees === 0) {
    const s = f.saisie;
    return [
      `Aucune note n’est saisie pour l’instant, sur ${s.epreuves} ${pluriel(s.epreuves, 'épreuve')} ${pluriel(s.epreuves, 'déclarée')}.`,
      '',
      'Dès que tu en entreras dans le Bulletin, je pourrai te donner tes moyennes par matière, par UE et en général.',
    ].join('\n');
  }

  const citee = citees[0];
  if (citee) {
    const m = n.matieres.find(x => x.nom === citee);
    if (!m) return `Aucune note n’est saisie en ${citee}.`;
    /*
     * Une matière défaillante porte une moyenne calculable — le moteur en a
     * besoin pour ses priorités — mais le bulletin y affiche DEF. Annoncer le
     * chiffre seul reviendrait à contredire l'autre écran sans le dire.
     */
    const chiffre = `En ${citee}, ta moyenne est de ${m.moyenne.toFixed(2)}/20 (coefficient ${m.coefficient}).`;
    return m.defaillante
      ? `${chiffre}\nMais une épreuve y est marquée défaillante : le bulletin affiche DEF, et le règlement exclut la compensation quels que soient les autres résultats.`
      : chiffre;
  }

  const meilleures = n.matieres.slice(0, 3).map(m => `${m.nom} ${m.moyenne.toFixed(2)}`);
  const faibles = n.matieres.slice(-3).reverse().map(m => `${m.nom} ${m.moyenne.toFixed(2)}`);

  return [
    n.generale !== null
      ? `Ta moyenne générale est de ${n.generale.toFixed(2)}/20, sur ${n.nbNotees} ${pluriel(n.nbNotees, 'matière')} ${pluriel(n.nbNotees, 'notée')}.`
      : `${n.nbNotees} ${pluriel(n.nbNotees, 'matière')} ${pluriel(n.nbNotees, 'notée')}, pas encore de quoi calculer une générale.`,
    '',
    `Tes meilleures : ${enumerer(meilleures)}.`,
    faibles.length ? `Les plus basses : ${enumerer(faibles)}.` : '',
    '',
    'Tant qu’une UE compte moins de trois notes, sa moyenne reste provisoire — le règlement en attend au moins trois, dont aucune ne pèse plus de la moitié.',
  ].filter(Boolean).join('\n');
}

function avancement(f, question) {
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const citee = citees[0];
  if (citee) {
    const m = f.matieres.find(x => x.nom === citee);
    if (m.cours === 0) {
      return [
        `Aucun chapitre n’est saisi en ${m.nom} — je n’ai rien à mesurer.`,
        m.exercices > 0 ? `${m.exercices} ${pluriel(m.exercices, 'exercice')} y ${pluriel(m.exercices, 'figure')} en revanche.` : '',
        m.moyenne !== null ? `Moyenne actuelle : ${m.moyenne.toFixed(2)}/20.` : '',
      ].filter(Boolean).join('\n');
    }
    const part = Math.round((m.coursAbordes / m.cours) * 100);
    return [
      `En ${m.nom} : ${m.coursAbordes} ${pluriel(m.coursAbordes, 'cours')} ${pluriel(m.coursAbordes, 'abordé')} sur ${m.cours} (${part} %), ${m.exercices} ${pluriel(m.exercices, 'exercice')} au programme.`,
      m.moyenne !== null ? `Moyenne actuelle : ${m.moyenne.toFixed(2)}/20.` : 'Aucune note saisie dans cette matière.',
      m.defaillante ? 'Une épreuve y est marquée défaillante : le bulletin affiche DEF.' : '',
    ].filter(Boolean).join('\n');
  }

  if (f.contenuVide) {
    return `Ton cursus compte ${f.structure.nbMatieres} ${pluriel(f.structure.nbMatieres, 'matière')} et ${f.structure.nbUE} UE, mais aucun cours ni exercice n’y est encore saisi. Demande-moi « qu’est-ce qui manque ? » pour la marche à suivre.`;
  }

  const c = f.couverture;
  return [
    `Tu as abordé ${c.faits} éléments sur ${c.total}, soit ${c.part} % du cursus.`,
    `Dans le détail : ${c.coursAbordes} cours sur ${c.cours}, et ${c.exercicesFaits} exercices sur ${c.exercices}.`,
  ].join('\n');
}

function contenuMatiere(f, question) {
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const citee = citees[0];
  if (citee) {
    const m = f.matieres.find(x => x.nom === citee);
    return m.cours === 0 && m.exercices === 0
      ? `Rien n’est encore saisi en ${m.nom} : ni chapitre, ni exercice.`
      : `En ${m.nom} : ${m.cours} ${pluriel(m.cours, 'chapitre')}, ${m.exercices} ${pluriel(m.exercices, 'exercice')}.`;
  }

  const s = f.saisie;
  if (s.chapitres === 0) {
    return `Aucun chapitre n’est saisi, dans aucune des ${s.nbMatieres} matières. C’est la première chose à faire : demande-moi « qu’est-ce qui manque ? ».`;
  }

  const vides = s.sansChapitre;
  return [
    `${s.chapitres} ${pluriel(s.chapitres, 'chapitre')} ${pluriel(s.chapitres, 'saisi')} au total.`,
    vides.length > 0
      ? `${vides.length} ${pluriel(vides.length, 'matière')} n’en ${pluriel(vides.length, 'a', 'ont')} aucun : ${enumererPartiel(vides)}.`
      : 'Toutes tes matières en comptent au moins un.',
  ].join('\n');
}

function tempsTravaille(f, question) {
  const mois = String(question).toLowerCase().includes('mois');
  const t = mois ? f.mois : f.semaine;

  if (t.minutes === 0) {
    return t.seances === 0
      ? `Aucune séance enregistrée sur les ${t.fenetreJours} derniers jours.`
      : `${t.seances} ${pluriel(t.seances, 'séance')} ${pluriel(t.seances, 'enregistrée')} sur les ${t.fenetreJours} derniers jours, mais aucune ne porte de durée : je ne peux pas te donner de total.`;
  }

  const parJour = t.joursActifs > 0 ? t.minutes / t.joursActifs : 0;
  const top = t.parMatiere.slice(0, 3).map(m => `${m.nom} (${heures(m.minutes)})`);

  return [
    `${heures(t.minutes)} sur les ${t.fenetreJours} derniers jours, répartis sur ${t.joursActifs} ${pluriel(t.joursActifs, 'jour')} — soit ${heures(parJour)} par jour travaillé.`,
    top.length ? `Le plus travaillé : ${enumerer(top)}.` : '',
    t.sansDuree > 0
      ? `${t.sansDuree} ${pluriel(t.sansDuree, 'séance')} ne ${pluriel(t.sansDuree, 'porte', 'portent')} aucune durée : ${pluriel(t.sansDuree, 'elle n’est pas comptée', 'elles ne sont pas comptées')} dans ce total.`
      : '',
  ].filter(Boolean).join('\n');
}

function repartitionTemps(f) {
  const t = f.mois;
  if (t.parMatiere.length === 0) {
    return `Aucune séance chronométrée sur les ${t.fenetreJours} derniers jours : je n’ai rien à répartir.`;
  }

  const lignes = t.parMatiere.slice(0, 6).map(m => {
    const part = t.minutes > 0 ? Math.round((m.minutes / t.minutes) * 100) : 0;
    return `• ${m.nom} — ${heures(m.minutes)} (${part} %)`;
  });

  const connues = new Set(f.matieres.map(m => m.nom));
  const etrangeres = t.parMatiere.filter(m => !connues.has(m.nom) && m.nom !== 'Routine');

  return [
    `Sur les ${t.fenetreJours} derniers jours, ${heures(t.minutes)} au total :`,
    '',
    ...lignes,
    etrangeres.length > 0
      ? `\n${etrangeres.length} de ces ${pluriel(etrangeres.length, 'matière')} ne ${pluriel(etrangeres.length, 'figure', 'figurent')} pas dans ton cursus actuel : ce temps porte sur un programme antérieur.`
      : '',
  ].filter(Boolean).join('\n');
}

function derniereActivite(f) {
  const d = f.derniereSeance;
  if (!d) return 'Aucune séance n’est enregistrée dans ton historique.';

  const situe = d.ilYAJours === 0 ? 'aujourd’hui'
    : d.ilYAJours === 1 ? 'hier'
      : `il y a ${d.ilYAJours} jours`;

  const lignes = [
    `Ta dernière séance enregistrée date du ${dateLisible(d.jour)}, ${situe} : ${d.type || 'séance'} — ${d.titre || 'sans titre'}${d.matiere ? ` (${d.matiere})` : ''}${d.dureeMinutes > 0 ? `, ${heures(d.dureeMinutes)}` : ''}.`,
  ];

  if (d.ilYAJours > 1) {
    lignes.push('', 'Rien n’est enregistré depuis — ce qui veut dire qu’aucune séance n’a été validée dans l’application, pas nécessairement que tu n’as pas travaillé.');
  }
  return lignes.join('\n');
}

/**
 * Séries de jours travaillés.
 *
 * Deux nombres coexistent dans l'application et ne mesurent pas la même chose.
 * Le badge 🔥 de la barre latérale affiche `config.currentStreak`, un compteur
 * qu'on incrémente à chaque tâche validée et qui ne retombe à zéro que le jour
 * où l'application s'ouvre et constate la rupture — s'il ne parvient pas à
 * s'enregistrer, il reste figé sur sa dernière valeur. Ici, la série est
 * recomptée depuis le registre des séances.
 *
 * Quand les deux divergent, le taire donnerait au Répétiteur l'air de
 * contredire l'écran d'à côté. On dit donc les deux, et ce que chacun compte.
 */
function serieJours(f) {
  const s = f.series;
  if (s.joursTravailles === 0) return 'Aucune journée travaillée n’est enregistrée.';

  const lignes = [
    `Ta plus longue série est de ${s.record} ${pluriel(s.record, 'jour')} ${pluriel(s.record, 'consécutif')}, du ${dateLisible(s.debutRecord)} au ${dateLisible(s.finRecord)}.`,
    s.enCours > 0
      ? `Série en cours : ${s.enCours} ${pluriel(s.enCours, 'jour')}.`
      : 'Aucune série en cours : la dernière journée enregistrée n’est ni aujourd’hui ni hier.',
    `En tout, ${s.joursTravailles} ${pluriel(s.joursTravailles, 'journée')} ${pluriel(s.joursTravailles, 'porte', 'portent')} au moins une séance.`,
  ];

  const badge = Number(f.config?.currentStreak);
  if (Number.isFinite(badge) && badge !== s.enCours) {
    const derniere = f.config?.lastActiveDate;
    lignes.push(
      '',
      `Le badge 🔥 affiche ${badge} ${pluriel(badge, 'jour')} : ce compteur-là s’incrémente à chaque tâche validée et ne se remet à zéro qu’à l’ouverture suivante de l’application${derniere ? `, sa dernière activité étant datée du ${dateLisible(derniere)}` : ''}. Mon chiffre, lui, est recompté sur tes séances enregistrées.`
    );
  }

  return lignes.join('\n');
}

function surcharge(f) {
  const risque = f.rapport?.intelligence?.burnoutRisk;
  const t = f.semaine;

  if (!risque) {
    return 'Je n’arrive pas à lire l’évaluation de fatigue — le programme du jour n’a pas pu être produit.';
  }

  if (t.seances === 0) {
    return [
      `Aucune séance n’est enregistrée sur les ${t.fenetreJours} derniers jours : je ne peux rien mesurer de ton rythme actuel.`,
      '',
      'Ce n’est pas la même chose que « tu vas bien » — c’est l’absence de mesure, pas un constat.',
    ].join('\n');
  }

  const signaux = Array.isArray(risque.signaux) ? risque.signaux : [];

  if (signaux.length === 0) {
    return [
      `Aucun signal de fatigue. Sur les ${t.fenetreJours} derniers jours tu as travaillé ${heures(t.minutes)}, sur ${t.joursActifs} ${pluriel(t.joursActifs, 'jour')}.`,
      `Série en cours : ${f.series.enCours} ${pluriel(f.series.enCours, 'jour')}.`,
    ].join('\n');
  }

  return [
    `Niveau de risque : ${risque.riskLevel}.`,
    '',
    // Les textes des signaux portent déjà leurs chiffres : les reformuler
    // reviendrait à recalculer, donc à risquer un écart.
    ...signaux.map(s => `• ${typeof s === 'string' ? s : (s.texte || s.libelle || s.cle || '')}`),
    risque.shouldForceRest ? '\nUn jour de repos est imposé pour cette raison.' : '',
  ].filter(Boolean).join('\n');
}

/* ---------------------------------------------------------------- Le cursus */

function saisieIncomplete(f) {
  const s = f.saisie;
  const manques = [];

  if (s.sansChapitre.length > 0) {
    manques.push(`Les chapitres. ${s.sansChapitre.length} ${pluriel(s.sansChapitre.length, 'matière')} sur ${s.nbMatieres} n’en ${pluriel(s.sansChapitre.length, 'a', 'ont')} aucun. C’est ce qui bloque tout le reste : sans chapitre, pas de révision, pas de couverture, pas de programme.`);
  }
  if (s.epreuves > 0 && s.epreuvesDatees === 0) {
    manques.push(`Les dates d’épreuve. Tes ${s.epreuves} épreuves sont déclarées — nom, type, coefficient, durée — mais aucune n’est datée. La proximité d’une épreuve pèse pour trente points sur cent dans le classement des révisions : ce critère reste sans effet tant qu’aucune date n’est saisie.`);
  }
  if (s.nbMatieres > 0 && s.sansDeck.length === s.nbMatieres) {
    manques.push('Les paquets Anki. Aucune matière n’est rattachée à un deck, donc aucune tâche Anki ne peut être planifiée.');
  } else if (s.sansDeck.length > 0) {
    manques.push(`Les paquets Anki. ${s.sansDeck.length} ${pluriel(s.sansDeck.length, 'matière')} sans deck : ${enumererPartiel(s.sansDeck)}.`);
  }
  if (s.sansAnnale.length > 0 && s.sansAnnale.length < s.nbMatieres) {
    manques.push(`Les annales. ${s.sansAnnale.length} ${pluriel(s.sansAnnale.length, 'matière')} n’en ${pluriel(s.sansAnnale.length, 'a', 'ont')} aucune : ${enumererPartiel(s.sansAnnale)}.`);
  }
  if (s.sansCoefficient.length > 0) {
    manques.push(`Les coefficients. ${s.sansCoefficient.length} ${pluriel(s.sansCoefficient.length, 'matière')} sans coefficient : ${enumererPartiel(s.sansCoefficient)}.`);
  }
  if (s.chapitres > 0 && s.chapitresSansDocument > 0) {
    manques.push(`Les documents. ${s.chapitresSansDocument} ${pluriel(s.chapitresSansDocument, 'chapitre')} sur ${s.chapitres} n’${pluriel(s.chapitresSansDocument, 'a', 'ont')} aucun PDF rattaché.`);
  }

  if (manques.length === 0) {
    return 'Ta saisie est complète : chaque matière a ses chapitres, ses coefficients, ses épreuves datées et son paquet Anki. Il n’y a rien à ajouter de mon côté.';
  }

  const r = f.rentree;
  const entete = r && r.jours > 0
    ? `Il te reste ${r.jours} ${pluriel(r.jours, 'jour')} avant la reprise du ${dateLisible(r.date)}. Voici ce qui manque, dans l’ordre où ça débloque le reste :`
    : 'Voici ce qui manque, dans l’ordre où ça débloque le reste :';

  return [entete, ...manques.map((m, i) => `${i + 1}. ${m}`)].join('\n\n');
}

function dateRentree(f) {
  const r = f.rentree;
  if (!r) return 'Aucune date de reprise n’est déclarée dans tes réglages.';

  if (r.jours > 0) {
    return [
      `Ta reprise est fixée au ${dateLisible(r.date)}, ${quand(r.jours)}.`,
      '',
      'D’ici là, les week-ends sont proposés en repos plutôt qu’imposés, et tu peux les lever depuis le tableau de bord.',
    ].join('\n');
  }
  if (r.jours === 0) return `La reprise, c’est aujourd’hui — ${dateLisible(r.date)}.`;
  return `Ta reprise était fixée au ${dateLisible(r.date)}, ${quand(r.jours)}.`;
}

function cursusStructure(f) {
  const st = f.structure;
  if (st.nbMatieres === 0) {
    return 'Je ne lis aucune matière dans ta base. Si tu en as saisi, c’est que la lecture a échoué — ce n’est pas la même chose qu’un cursus vide.';
  }

  const lignes = [];
  for (const licence of st.licences) {
    lignes.push(`${licence.nom}`);
    for (const semestre of licence.semestres) {
      const fin = semestre.dateFin ? `, jusqu’au ${dateLisible(semestre.dateFin)}` : '';
      lignes.push(`  ${semestre.nom} — ${semestre.ues.length} UE, ${semestre.ects} ECTS${fin}`);
      for (const ue of semestre.ues) {
        lignes.push(`    • ${ue.nom} (${ue.ects || '?'} ECTS) : ${ue.matieres.length} ${pluriel(ue.matieres.length, 'matière')}`);
      }
    }
  }

  return [
    `${st.nbMatieres} matières réparties en ${st.nbUE} UE, pour ${st.ectsTotal} ECTS.`,
    '',
    ...lignes,
  ].join('\n');
}

function coefficients(f, question) {
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const toutesUE = f.structure.licences.flatMap(l => l.semestres).flatMap(s => s.ues);

  const citee = citees[0];
  if (citee) {
    const m = f.matieres.find(x => x.nom === citee);
    const ue = toutesUE.find(u => u.matieres.some(x => x.nom === citee));
    return `${m.nom} : coefficient ${m.coefficient}, dans ${m.ue}${ue?.ects ? ` (${ue.ects} ECTS)` : ''}.`;
  }

  const lignes = [];
  for (const licence of f.structure.licences) {
    for (const semestre of licence.semestres) {
      lignes.push(`${semestre.nom}`);
      for (const ue of semestre.ues) {
        const detail = ue.matieres.map(m => `${m.nom} (${m.coefficient ?? '?'})`).join(', ');
        lignes.push(`• ${ue.nom} — ${ue.ects || '?'} ECTS : ${detail}`);
      }
    }
  }
  return ['Coefficients par matière, et ECTS par UE :', '', ...lignes].join('\n');
}

function volumeHoraire(f, question) {
  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const toutes = f.structure.licences.flatMap(l => l.semestres).flatMap(s => s.ues).flatMap(u => u.matieres);

  const citee = citees[0];
  if (citee) {
    const m = toutes.find(x => x.nom === citee);
    if (!m) return `Je ne trouve pas ${citee} dans ton cursus.`;
    const parts = [
      m.cm_h ? `${m.cm_h} h de CM` : '',
      m.td_h ? `${m.td_h} h de TD` : '',
      m.tp_h ? `${m.tp_h} h de TP` : '',
    ].filter(Boolean);
    return parts.length === 0
      ? `Aucun volume horaire n’est renseigné pour ${citee}.`
      : `${citee} : ${enumerer(parts)}.`;
  }

  const h = f.structure.heures;
  const renseignees = {
    cm: toutes.filter(m => m.cm_h > 0).length,
    td: toutes.filter(m => m.td_h > 0).length,
    tp: toutes.filter(m => m.tp_h > 0).length,
  };

  return [
    `Ta maquette déclare ${h.cm} h de CM, ${h.td} h de TD et ${h.tp} h de TP, soit ${h.cm + h.td + h.tp} h d’enseignement.`,
    '',
    `Le détail est renseigné pour ${renseignees.cm} matières en CM, ${renseignees.td} en TD et ${renseignees.tp} en TP, sur ${toutes.length}.`,
    '',
    'C’est le volume encadré, pas ton travail personnel : la convention ECTS situe celui-ci entre 15 et 20 heures par crédit, en plus.',
  ].join('\n');
}

function epreuves(f, question) {
  const liste = f.epreuves || [];
  if (liste.length === 0) return 'Aucune épreuve n’est déclarée dans ton cursus.';

  const citees = matieresCitees(question, f.matieres.map(m => m.nom));
  if (citees.length > 1) return ambiguite(citees);

  const citee = citees[0];
  const retenues = citee ? liste.filter(e => e.matiere === citee) : liste;
  if (retenues.length === 0) return `Aucune épreuve déclarée en ${citee}.`;

  const datees = retenues
    .filter(e => e.date && e.joursRestants >= 0)
    .sort((a, b) => a.joursRestants - b.joursRestants);

  if (datees.length > 0) {
    const p = datees[0];
    return [
      `Ta prochaine épreuve est ${p.matiere} — ${p.nom}, le ${dateLisible(p.date)}, ${quand(p.joursRestants)}.`,
      '',
      ...datees.slice(0, 6).map(e =>
        `• ${dateLisible(e.date)} — ${e.matiere} : ${e.nom}${e.type ? ` (${e.type})` : ''}, coefficient ${e.coefficient}${e.dureeMinutes ? `, ${heures(e.dureeMinutes)}` : ''}`),
    ].join('\n');
  }

  // Aucune date : décrire ce qui est réellement déclaré vaut mieux que se taire.
  const parType = {};
  for (const e of retenues) parType[e.type || 'sans type'] = (parType[e.type || 'sans type'] || 0) + 1;

  const entete = citee
    ? `En ${citee}, ${retenues.length} ${pluriel(retenues.length, 'épreuve')} ${pluriel(retenues.length, 'est déclarée', 'sont déclarées')}, aucune datée :`
    : `${retenues.length} ${pluriel(retenues.length, 'épreuve')} ${pluriel(retenues.length, 'est déclarée', 'sont déclarées')} dans ton cursus, mais aucune n’est datée.`;

  const lignes = citee
    ? retenues.map(e => `• ${e.nom}${e.type ? ` (${e.type})` : ''}, coefficient ${e.coefficient}${e.dureeMinutes ? `, ${heures(e.dureeMinutes)}` : ''}`)
    : [`Répartition : ${enumerer(Object.entries(parType).map(([t, n]) => `${n} en ${t}`))}.`];

  return [
    entete,
    '',
    ...lignes,
    '',
    'Sans date, la proximité d’une épreuve — trente points sur cent dans le classement des révisions — reste sans effet. Les dates se saisissent dans le Bulletin, sur chaque évaluation.',
  ].join('\n');
}

function reglages(f) {
  const c = f.config || {};
  const lignes = [];

  if (Number.isFinite(Number(c.maxStudyHoursPerDay))) lignes.push(`• Capacité : ${c.maxStudyHoursPerDay} h par jour`);
  if (Number.isFinite(Number(c.maxSubjectsPerDay))) lignes.push(`• Au plus ${c.maxSubjectsPerDay} matières dans une journée`);
  if (c.wakeTime && c.bedtime) lignes.push(`• Journée : ${c.wakeTime} – ${c.bedtime}`);
  else if (c.bedtime) lignes.push(`• Coucher déclaré : ${c.bedtime}`);
  else if (c.wakeTime) lignes.push(`• Lever déclaré : ${c.wakeTime}`);
  if (c.profil?.chronobiologie) lignes.push(`• Chronobiologie déclarée : ${c.profil.chronobiologie}`);
  if (f.rentree) lignes.push(`• Reprise : ${dateLisible(f.rentree.date)}`);

  const durees = [
    ['nouveau CM', c.defaultDurationNewCM],
    ['révision de CM', c.defaultDurationRevCM],
    ['TD', c.defaultDurationTD],
    ['annale', c.defaultDurationAnnales],
    ['Anki', c.defaultDurationAnki],
  ].filter(([, v]) => Number.isFinite(Number(v)));

  if (durees.length > 0) {
    lignes.push(`• Durées par défaut : ${enumerer(durees.map(([n, v]) => `${n} ${v} min`))}`);
  }

  if (lignes.length === 0) return 'Aucun réglage n’est lisible dans ta configuration.';

  return ['Tes réglages, tels qu’ils sont enregistrés :', '', ...lignes].join('\n');
}

function emploiDuTemps(f) {
  const e = f.emploiDuTemps;
  if (!e || e.liste.length === 0) {
    return 'Aucun créneau fixe n’est déclaré. Ceux que tu ajouteras seront retranchés de ta capacité du jour, et la matière rattachée sera considérée comme déjà travaillée ce jour-là.';
  }

  return [
    `${e.liste.length} ${pluriel(e.liste.length, 'créneau')} ${pluriel(e.liste.length, 'fixe')}, soit ${heures(e.minutesParSemaine)} par semaine :`,
    '',
    ...e.liste.map(c =>
      `• ${c.jour} ${c.debut}–${c.fin}${c.matiere ? ` — ${c.matiere}` : ''}${c.minutes ? ` (${heures(c.minutes)})` : ''}`),
    '',
    'Ce temps est retranché de ta capacité ce jour-là, et la matière rattachée est considérée comme déjà travaillée : elle ne remontera pas dans le programme du même jour.',
  ].join('\n');
}

function capacite(f) {
  const cfg = f.config || {};
  const declaree = Number(cfg.capaciteQuotidienneH) || Number(cfg.maxStudyHoursPerDay) || null;
  const r = f.rapport;

  return [
    declaree
      ? `Tu as déclaré pouvoir donner ${declaree} h par jour.`
      : 'Tu n’as pas encore déclaré ta capacité quotidienne.',
    r && Number.isFinite(r.tempsRequisMin) && r.tempsRequisMin > 0
      ? `Aujourd’hui, le programme demande ${heures(r.tempsRequisMin)}.`
      : '',
    '',
    'Repère utile : la convention ECTS situe le travail personnel d’une année à 60 crédits entre 927 et 1227 heures. Réparti sur trente semaines, cela place la barre entre 4 et 7 h par jour selon le nombre de jours travaillés.',
  ].filter(Boolean).join('\n');
}

function langues(f, question) {
  if (f.langues.length === 0) {
    return 'Aucune langue n’est déclarée. Tu peux en ajouter dans l’onglet Langues : elles se planifient à la régularité, pas à l’urgence.';
  }

  const citees = matieresCitees(question, f.langues.map(l => l.nom));
  const liste = citees.length === 1 ? f.langues.filter(l => l.nom === citees[0]) : f.langues;

  const lignes = [];
  for (const l of liste) {
    const derniere = l.derniereSeanceJours === null ? 'jamais pratiquée'
      : l.derniereSeanceJours === 0 ? 'pratiquée aujourd’hui'
        : `dernière séance il y a ${l.derniereSeanceJours} ${pluriel(l.derniereSeanceJours, 'jour')}`;
    lignes.push(`• ${l.nom} — ${l.heuresAcquises} h déclarées, ${l.cadence} ${pluriel(l.cadence, 'séance')} par semaine, ${derniere}.`);

    // Une langue déclarée n'est pas une langue planifiable : sans matière à
    // travailler, le planificateur passe son chemin sans rien dire.
    if (!l.planifiable) {
      lignes.push(`   ⚠️ Aucune séance ne peut être planifiée : il manque de quoi travailler${l.voletsManquants.length ? ` (${enumerer(l.voletsManquants)})` : ''}. Ajoute un paquet Anki, un livre ou un lien dans l’onglet Langues.`);
    } else if (l.voletsManquants.length > 0) {
      lignes.push(`   Volets actifs : ${enumerer(l.voletsExploitables)}. Sans matière pour ${enumerer(l.voletsManquants)}, ${pluriel(l.voletsManquants.length, 'ce volet ne sera', 'ces volets ne seront')} jamais ${pluriel(l.voletsManquants.length, 'proposé')}.`);
    }
    if (l.voletDu) lignes.push(`   À faire maintenant : ${l.voletDu}.`);
  }

  return [
    ...lignes,
    '',
    'Les heures ci-dessus sont celles que tu as déclarées, pas un relevé de tes séances : je ne mesure que ce qui est validé dans l’application.',
  ].join('\n');
}

/** Date limite de dépôt d'un justificatif. */
function echeanceJustificatif(dateStr, delai) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return String(dateStr || '');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  d.setDate(d.getDate() + delai);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Absences.
 *
 * Deux corrections tiennent dans cette fonction. La première : l'état se lit
 * dans `justifiee` autant que dans `statut`, faute de quoi les absences réelles
 * étaient rangées en « non renseigné » et la seule injustifiée devenait
 * invisible. La seconde : le texte affirmait qu'« une absence injustifiée vaut
 * défaillance ». C'est faux. Le règlement réserve la défaillance aux épreuves ;
 * pour les enseignements, il prévoit qu'à partir de la troisième absence non
 * justifiée l'étudiant *peut* être convoqué.
 */
function absences(f) {
  const a = f.absences;
  if (a.total === 0) return 'Aucune absence déclarée.';

  const detail = Object.entries(a.parEtat).map(([etat, n]) => {
    const formes = LIBELLE_ABSENCE[etat] || [etat, etat];
    return `${n} ${formes[n > 1 ? 1 : 0]}`;
  });

  const lignes = [
    `${a.total} ${pluriel(a.total, 'absence')} ${pluriel(a.total, 'déclarée')} : ${enumerer(detail)}.`,
  ];

  for (const abs of a.horsDelai) {
    const depasse = -abs.joursPourJustifier;
    lignes.push('', `⚠️ ${abs.matiere || 'Absence'} du ${dateLisible(abs.date)} : le délai de ${a.delaiJours} jours pour déposer un justificatif est dépassé de ${depasse} ${pluriel(depasse, 'jour')}.`);
  }

  for (const abs of a.aJustifierBientot) {
    const reste = abs.joursPourJustifier;
    lignes.push('', `À justifier : ${abs.matiere || 'absence'} du ${dateLisible(abs.date)} — il te reste ${reste} ${pluriel(reste, 'jour')}, jusqu’au ${dateLisible(echeanceJustificatif(abs.date, a.delaiJours))}.`);
    // Le règlement n'exige un justificatif qu'en TP, CM et langues : sans type
    // d'enseignement saisi, je signale l'échéance sans affirmer qu'elle
    // s'applique. Passer l'un ou l'autre sous silence serait un choix à ta place.
    if (!abs.type) {
      lignes.push(`Le type d’enseignement n’est pas renseigné : en TD, le règlement n’exige pas de justificatif — vérifie avant de t’en occuper.`);
    }
  }

  if (a.nonJustifiees >= 3) {
    lignes.push('', `Tu en comptes ${a.nonJustifiees} non justifiées. Le règlement prévoit qu’à partir de la troisième, le responsable de formation peut convoquer l’étudiant. Demande-moi « le règlement sur l’assiduité » pour le texte exact.`);
  }

  return lignes.join('\n');
}

function projets(f) {
  if (!f.projets || f.projets.length === 0) return 'Aucun projet personnel enregistré.';

  return f.projets.map(p => {
    const phases = p.phases || [];
    const faites = phases.filter(x => x.complete).length;
    return `• ${p.titre}${p.dateFin ? ` — échéance ${dateLisible(p.dateFin)}` : ''}${phases.length ? ` — ${faites}/${phases.length} phases` : ''}`;
  }).join('\n');
}

function methode() {
  return [
    'Le planificateur mesure une seule chose : le moment où tu es sur le point d’oublier.',
    '',
    'Après chaque révision, ta réponse — oublié, difficile, correct, évident — alimente FSRS, qui calcule la date du prochain passage. Plus tu retiens, plus l’intervalle s’allonge.',
    '',
    'Le classement des tâches combine quatre critères : l’échéance d’oubli, la proximité d’une épreuve pondérée par le coefficient, la faiblesse de la matière — une moyenne sous 12/20, seuil fixe et non réglable —, et la part du contenu jamais abordée. La moitié de chaque journée est réservée aux révisions dues, pour que la découverte ne les étouffe pas.',
    '',
    'Une matière laissée de côté est reprise chaque jour en priorité : aucun chapitre ne peut être abandonné indéfiniment.',
  ].join('\n');
}

function donneesConservees(f) {
  const s = f.saisie;
  return [
    'Tout est sur cette machine : rien n’est envoyé nulle part, et je n’appelle aucun service extérieur.',
    '',
    'Ce que je lis pour te répondre :',
    `• ton cursus — ${f.structure.nbMatieres} ${pluriel(f.structure.nbMatieres, 'matière')}, ${f.structure.nbUE} UE, ${s.chapitres} ${pluriel(s.chapitres, 'chapitre')}, ${s.epreuves} ${pluriel(s.epreuves, 'épreuve')}`,
    `• ton historique — ${f.volumes.historique} ${pluriel(f.volumes.historique, 'séance')} ${pluriel(f.volumes.historique, 'enregistrée')}`,
    '• tes réglages, tes langues, tes absences et tes projets',
    '• le rapport du jour, celui-là même qu’affiche ton tableau de bord',
    '',
    'Notre conversation est enregistrée dans un fichier que tu peux vider à tout moment, avec la corbeille en haut de ce panneau.',
  ].join('\n');
}

/* ------------------------------------------------------------- Le règlement */

/**
 * Citation du règlement.
 *
 * Ici le Répétiteur change de registre : il ne calcule plus, il recopie. Le
 * fichier existait depuis le début du projet sans qu'aucun code ne le lise —
 * les questions de règlement tombaient dans l'incompris alors que la réponse
 * dormait sur le disque.
 */
function reglement(cle) {
  if (!reglementLisible()) {
    return 'Je n’arrive pas à lire le règlement des études (data/reglement_etudes.md).';
  }
  const sections = citer(cle);
  if (sections.length === 0) {
    return 'Je n’ai pas de section du règlement qui réponde précisément à cette question.';
  }

  // Le panneau affiche du texte brut : pas de gras markdown, il s'y lirait
  // sous forme d'astérisques. Le titre est isolé par une ligne de séparation.
  return [
    ...sections.map(s => `— ${s.titre} —\n\n${s.texte}`),
    RESERVE,
  ].join('\n\n');
}

/* ------------------------------------------------------------ L'aiguillage */

const INCOMPRIS = [
  'Je n’ai pas compris la question, et je préfère te le dire plutôt que d’inventer une réponse.',
  '',
  'Je sais parler de :',
  ...CAPACITES.map(c => `• ${c}`),
].join('\n');

/**
 * Réponse du Répétiteur à une question, à partir des faits fournis.
 * @param {string} question
 * @param {object} faits — issu de `connaissances.rassembler()`
 */
function repondre(question, faits) {
  const intention = reconnaitre(question);
  if (!intention) return { texte: INCOMPRIS, intention: null, compris: false };

  const par = {
    aide: () => aide(),
    salutation: () => salutation(faits),

    programme_du_jour: () => programmeDuJour(faits),
    demain: () => demain(faits),
    pourquoi: () => pourquoi(faits),
    pourquoi_repos: () => pourquoiRepos(faits),
    absence_du_programme: () => absenceDuProgramme(faits, question),
    temps_libre_restant: () => tempsLibreRestant(faits),

    retard: () => retard(faits),
    moyenne: () => moyennes(faits, question),
    avancement: () => avancement(faits, question),
    contenu_matiere: () => contenuMatiere(faits, question),
    temps_travaille: () => tempsTravaille(faits, question),
    repartition_temps: () => repartitionTemps(faits),
    derniere_activite: () => derniereActivite(faits),
    serie_jours: () => serieJours(faits),
    surcharge: () => surcharge(faits),

    saisie_incomplete: () => saisieIncomplete(faits),
    date_rentree: () => dateRentree(faits),
    cursus_structure: () => cursusStructure(faits),
    coefficients: () => coefficients(faits, question),
    volume_horaire: () => volumeHoraire(faits, question),
    examens: () => epreuves(faits, question),
    emploi_du_temps_fixe: () => emploiDuTemps(faits),
    reglages: () => reglages(faits),

    capacite: () => capacite(faits),
    langues: () => langues(faits, question),
    absences: () => absences(faits),
    projets: () => projets(faits),
    methode: () => methode(),
    donnees_conservees: () => donneesConservees(faits),

    reglement_assiduite: () => reglement('reglement_assiduite'),
    reglement_absence_epreuve: () => reglement('reglement_absence_epreuve'),
    reglement_compensation: () => reglement('reglement_compensation'),
    reglement_progression: () => reglement('reglement_progression'),
    reglement_maquette: () => reglement('reglement_maquette'),
  };

  const fabrique = par[intention.cle];
  if (!fabrique) return { texte: INCOMPRIS, intention: intention.cle, compris: false };

  return { texte: fabrique(), intention: intention.cle, compris: true };
}

module.exports = {
  repondre,
  heures,
  enumerer,
  enumererPartiel,
  dateLisible,
  quand,
  echeanceJustificatif,
  CAPACITES,
  INCOMPRIS,
};
