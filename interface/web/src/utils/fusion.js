/**
 * Fusion à trois branches — réconcilier deux appareils sans rien perdre.
 *
 * Jusqu'ici, synchroniser voulait dire écraser : `syncFromBackend` remplaçait
 * la base locale par celle du serveur, et chaque modification renvoyait le
 * document entier. Avec un seul appareil, cela ne se voyait pas. Avec deux,
 * c'est une perte de données garantie — trois tâches validées hors ligne
 * disparaissent au retour du réseau, sans le moindre message.
 *
 * Le remède n'est pas de choisir un gagnant, mais de comparer *trois* états :
 *
 *     base     ce sur quoi les deux appareils étaient d'accord la dernière fois
 *     local    ce que cet appareil a depuis
 *     distant  ce que le serveur a depuis
 *
 * Ce que l'un des deux seulement a touché n'est pas un conflit : c'est une
 * modification, et on la garde. Seul ce que les deux ont touché différemment
 * mérite un arbitrage. Sans la base, on ne sait pas distinguer « ajouté ici »
 * de « supprimé là-bas », et c'est précisément ce qui faisait tout écraser.
 *
 * Quatre principes gouvernent les arbitrages restants.
 *
 *   1. NE JAMAIS PERDRE DU TRAVAIL. Une entrée supprimée d'un côté et modifiée
 *      de l'autre est conservée. Retrouver une ligne qu'on croyait effacée est
 *      un désagrément ; perdre une séance de révision en est un autre.
 *
 *   2. LE JOURNAL EST INVIOLABLE. L'historique n'est pas un document mais une
 *      suite d'événements immuables, chacun identifié. Deux appareils qui y
 *      ajoutent des entrées différentes n'entrent jamais en conflit : leur
 *      fusion est l'union. C'est la donnée la plus précieuse — elle nourrit
 *      FSRS, les statistiques et le compteur d'heures de langue — et c'est
 *      aussi celle qui se réconcilie le mieux.
 *
 *   3. CERTAINES VALEURS NE RECULENT PAS. Un meilleur score, une date de
 *      dernière pratique, une série en cours : le maximum est la bonne réponse,
 *      pas « le dernier qui parle ».
 *
 *   4. SUR UN VRAI CONFLIT, LE SERVEUR TRANCHE. L'appareil qui synchronise cède.
 *      Cette règle vaut surtout par son déterminisme : les deux appareils
 *      convergent en une passe, sans se renvoyer indéfiniment leur version. La
 *      valeur écartée n'est pas perdue pour autant — elle est consignée.
 */

/* -------------------------------------------------------------- Utilitaires */

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Égalité structurelle, insensible à l'ordre des clés. */
export function memeValeur(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => memeValeur(v, b[i]));
  }
  if (estObjet(a) && estObjet(b)) {
    const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...cles].every(c => memeValeur(a[c], b[c]));
  }
  return false;
}

/** Indexe une liste d'entités par leur identifiant. */
function indexer(liste, cle) {
  const index = new Map();
  for (const element of Array.isArray(liste) ? liste : []) {
    const id = element?.[cle];
    if (id !== undefined && id !== null && id !== '') index.set(String(id), element);
  }
  return index;
}

/**
 * Deux éléments décrivent-ils la même chose, abstraction faite de leur clé ?
 *
 * Sert à reconnaître un élément créé ici sans identifiant dans celui que
 * l'autre côté a enregistré, identifiant compris : c'est le même, il ne faut
 * pas le garder deux fois.
 */
function memeValeurHorsCle(a, b, cle) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return memeValeur(a, b);
  const sansCle = (o) => {
    const copie = { ...o };
    delete copie[cle];
    return copie;
  };
  return memeValeur(sansCle(a), sansCle(b));
}

/** La plus grande de deux valeurs comparables, en ignorant ce qui est vide. */
function maximum(a, b) {
  if (a === undefined || a === null || a === '') return b;
  if (b === undefined || b === null || b === '') return a;
  return a >= b ? a : b;
}

/* ------------------------------------------------------ Formes de données */

/**
 * Description des formes rencontrées dans ELPIS.
 *
 * La fusion ne devine rien : elle applique la règle déclarée pour chaque
 * branche. Une forme absente retombe sur le comportement le plus prudent —
 * pour un tableau, l'union ; pour une valeur, l'arbitrage du serveur.
 *
 *   journal  suite d'événements immuables identifiés — union
 *   liste    entités identifiées et modifiables — fusion entité par entité
 *   ensemble tableau de valeurs sans identité — union
 *   objet    dictionnaire — fusion clé par clé
 *   max      valeur monotone — le maximum l'emporte
 */
export const FORMES = {
  historique: { type: 'journal', cle: 'id', tri: 'timestamp' },

  projets: { type: 'liste', cle: 'id' },

  config: {
    type: 'objet',
    champs: {
      langues: {
        type: 'liste',
        cle: 'id',
        champs: {
          // Une séance faite sur un appareil ne doit pas être annulée par
          // l'ignorance de l'autre : la date la plus récente gagne.
          dernieresPratiques: {
            type: 'objet',
            champs: {
              vocabulaire: { type: 'max' },
              conversation: { type: 'max' },
              grammaire: { type: 'max' },
            },
          },
          vocabulaire: { type: 'objet', champs: { liens: { type: 'liste', cle: 'id' } } },
          conversation: { type: 'objet', champs: { liens: { type: 'liste', cle: 'id' } } },
          grammaire: { type: 'objet', champs: { liens: { type: 'liste', cle: 'id' } } },
        },
      },
      mesVideos: { type: 'liste', cle: 'id' },
      restDays: { type: 'ensemble' },
      skippedRestDays: { type: 'ensemble' },
      currentStreak: { type: 'max' },
      bestStreak: { type: 'max' },
      lastActiveDate: { type: 'max' },
      dernierePratiqueAnki: { type: 'max' },
    },
  },

  cours: {
    type: 'objet',
    champs: {
      licences: {
        type: 'liste',
        cle: 'id',
        champs: {
          semestres: {
            type: 'liste',
            cle: 'id',
            champs: {
              ues: {
                type: 'liste',
                cle: 'id',
                champs: {
                  matieres: {
                    type: 'liste',
                    cle: 'id',
                    champs: {
                      // Réviser le même cours des deux côtés est un vrai
                      // conflit : c'est la révision la plus récente qui décrit
                      // l'état réel de la mémoire, donc celle que FSRS doit
                      // reprendre.
                      listeCM: { type: 'liste', cle: 'id', arbitre: 'derniereRevision' },
                      listeTD: { type: 'liste', cle: 'id', arbitre: 'dernierePratique' },
                      listeTP: { type: 'liste', cle: 'id', arbitre: 'dernierePratique' },
                      listeAnnales: { type: 'liste', cle: 'id', arbitre: 'dernierePratique' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/* ------------------------------------------------------------- Journal */

/**
 * Consigne les arbitrages, pour qu'aucune valeur écartée ne disparaisse en
 * silence. L'interface peut ainsi dire ce qui s'est passé plutôt que de
 * laisser l'utilisateur constater une valeur qu'il n'a pas choisie.
 */
function creerJournal() {
  return { conflits: [], ajouts: 0, suppressions: 0, ressuscites: 0 };
}

/* --------------------------------------------------------------- Fusion */

/**
 * Fusionne une branche selon sa forme.
 *
 * `absent` distingue « la clé n'existait pas » de « la clé valait undefined »,
 * ce qui est exactement la différence entre un ajout et une suppression.
 */
function fusionnerBranche(base, local, distant, forme, chemin, journal) {
  const type = forme?.type
    || (Array.isArray(local) || Array.isArray(distant) ? 'ensemble' : undefined)
    || (estObjet(local) || estObjet(distant) ? 'objet' : 'valeur');

  switch (type) {
    case 'journal': return fusionnerJournal(local, distant, forme, journal);
    case 'liste': return fusionnerListe(base, local, distant, forme, chemin, journal);
    case 'ensemble': return fusionnerEnsemble(base, local, distant, journal);
    case 'objet': return fusionnerObjet(base, local, distant, forme, chemin, journal);
    case 'max': return maximum(local, distant);
    default: return fusionnerValeur(base, local, distant, chemin, journal);
  }
}

/**
 * Union d'événements immuables.
 *
 * On ne compare pas au socle : un événement passé ne se modifie pas, et une
 * absence d'un côté signifie « pas encore vu », jamais « supprimé ». C'est ce
 * qui rend le journal insensible aux conflits.
 */
function fusionnerJournal(local, distant, forme, journal) {
  const cle = forme.cle || 'id';
  const fusion = new Map();

  for (const entree of Array.isArray(distant) ? distant : []) {
    const id = entree?.[cle];
    if (id !== undefined) fusion.set(String(id), entree);
  }
  let ajouts = 0;
  for (const entree of Array.isArray(local) ? local : []) {
    const id = entree?.[cle];
    if (id === undefined) continue;
    if (!fusion.has(String(id))) ajouts += 1;
    // Une entrée déjà connue du serveur n'est pas réécrite : elle est immuable.
    if (!fusion.has(String(id))) fusion.set(String(id), entree);
  }
  journal.ajouts += ajouts;

  const liste = [...fusion.values()];
  if (forme.tri) {
    liste.sort((a, b) => String(a?.[forme.tri] || '').localeCompare(String(b?.[forme.tri] || '')));
  }
  return liste;
}

/** Union de valeurs sans identité — un tableau de dates, par exemple. */
function fusionnerEnsemble(base, local, distant, journal) {
  const empreinte = v => (estObjet(v) || Array.isArray(v) ? JSON.stringify(v) : String(v));

  const socle = new Set((Array.isArray(base) ? base : []).map(empreinte));
  const ici = new Map((Array.isArray(local) ? local : []).map(v => [empreinte(v), v]));
  const laBas = new Map((Array.isArray(distant) ? distant : []).map(v => [empreinte(v), v]));

  const fusion = new Map();
  for (const [clef, valeur] of laBas) {
    // Présent au socle et retiré ici : c'est une suppression, on la respecte.
    if (socle.has(clef) && !ici.has(clef)) { journal.suppressions += 1; continue; }
    fusion.set(clef, valeur);
  }
  for (const [clef, valeur] of ici) {
    if (socle.has(clef) && !laBas.has(clef)) { journal.suppressions += 1; continue; }
    if (!fusion.has(clef)) { fusion.set(clef, valeur); journal.ajouts += 1; }
  }
  return [...fusion.values()];
}

/** Fusion d'entités identifiées : ajouts, suppressions et modifications. */
function fusionnerListe(base, local, distant, forme, chemin, journal) {
  const cle = forme.cle || 'id';
  const socle = indexer(base, cle);
  const ici = indexer(local, cle);
  const laBas = indexer(distant, cle);

  const fusion = [];
  const traites = new Set();

  const ajouter = (id, entite) => { traites.add(id); if (entite !== undefined) fusion.push(entite); };

  for (const [id, entiteDistante] of laBas) {
    const entiteLocale = ici.get(id);
    const entiteSocle = socle.get(id);

    if (entiteLocale === undefined) {
      if (entiteSocle === undefined) { journal.ajouts += 1; ajouter(id, entiteDistante); continue; }
      // Supprimée ici. On ne la ressuscite que si l'autre appareil l'a modifiée
      // entre-temps : le travail l'emporte sur la suppression.
      if (memeValeur(entiteSocle, entiteDistante)) { journal.suppressions += 1; traites.add(id); }
      else {
        journal.ressuscites += 1;
        journal.conflits.push({ chemin: `${chemin}[${id}]`, motif: 'supprimé ici, modifié ailleurs', retenu: 'la version modifiée' });
        ajouter(id, entiteDistante);
      }
      continue;
    }

    ajouter(id, fusionnerEntite(entiteSocle, entiteLocale, entiteDistante, forme, `${chemin}[${id}]`, journal));
  }

  for (const [id, entiteLocale] of ici) {
    if (traites.has(id)) continue;
    const entiteSocle = socle.get(id);

    if (entiteSocle === undefined) { journal.ajouts += 1; fusion.push(entiteLocale); continue; }
    // Supprimée là-bas, symétrique du cas précédent.
    if (memeValeur(entiteSocle, entiteLocale)) { journal.suppressions += 1; continue; }
    journal.ressuscites += 1;
    journal.conflits.push({ chemin: `${chemin}[${id}]`, motif: 'supprimé ailleurs, modifié ici', retenu: 'la version modifiée' });
    fusion.push(entiteLocale);
  }

  /*
   * Ce que la fusion ne sait pas indexer, elle ne le détruit plus.
   *
   * `indexer` écarte les éléments dépourvus de clé : ils n'entrent pas dans la
   * table, donc ni dans les boucles ci-dessus, donc pas dans le résultat. Aucune
   * erreur, aucune trace — et comme ce résultat est réécrit des deux côtés, la
   * saisie disparaît partout.
   *
   * Ce n'est pas une hypothèse : dix chapitres saisis sur le PC revenaient à
   * six, parce que la page Cours créait ses éléments sans identifiant et
   * comptait sur la base pour en attribuer un à l'écriture. Entre la création
   * et l'écriture, il y avait la synchronisation. La cause a été corrigée en
   * amont — tout ce qui est créé porte désormais son identifiant dès la
   * première seconde — mais le mécanisme, lui, restait capable de recommencer
   * au premier oubli, sur n'importe quelle page, ou sur des données écrites par
   * une version antérieure.
   *
   * Un élément sans clé est donc conservé. Le doublon qu'on pourrait craindre
   * est écarté par comparaison de contenu : quand l'autre côté détient le même
   * élément avec un identifiant — ce que fait la base à l'enregistrement — c'est
   * sa version qui est retenue, et la convergence se fait au tour suivant.
   *
   * Garder un élément de trop se voit et se corrige ; en perdre un ne se voit
   * pas.
   */
  const sansCle = (liste) => (Array.isArray(liste) ? liste : []).filter(e => {
    const id = e?.[cle];
    return id === undefined || id === null || id === '';
  });

  const orphelins = [];
  for (const element of [...sansCle(local), ...sansCle(distant)]) {
    // Déjà présent sous une forme identifiée, ou déjà repris : on ne double pas.
    if (fusion.some(garde => memeValeurHorsCle(garde, element, cle))) continue;
    if (orphelins.some(deja => memeValeur(deja, element))) continue;
    orphelins.push(element);
  }

  if (orphelins.length > 0) {
    journal.ajouts += orphelins.length;
    journal.conflits.push({
      chemin,
      motif: `${orphelins.length} élément${orphelins.length > 1 ? 's' : ''} sans « ${cle} »`,
      retenu: 'conservé plutôt que perdu — un identifiant devrait être posé à la création',
    });
    fusion.push(...orphelins);
  }

  return fusion;
}

/**
 * Fusionne deux versions d'une même entité.
 *
 * `arbitre` désigne un champ dont la valeur la plus grande décrit l'état le
 * plus avancé — la date de dernière révision d'un cours, par exemple. Quand il
 * départage, on prend l'entité entière du côté gagnant : mélanger les champs
 * d'un état FSRS produirait une carte incohérente.
 */
function fusionnerEntite(socle, ici, laBas, forme, chemin, journal) {
  if (memeValeur(ici, laBas)) return laBas;

  if (forme.arbitre && estObjet(ici) && estObjet(laBas)) {
    const valeurIci = ici[forme.arbitre];
    const valeurLaBas = laBas[forme.arbitre];
    if (!memeValeur(valeurIci, valeurLaBas)) {
      const gagnant = maximum(valeurIci, valeurLaBas) === valeurIci ? ici : laBas;
      if (socle !== undefined && !memeValeur(socle, ici) && !memeValeur(socle, laBas)) {
        journal.conflits.push({
          chemin,
          motif: `modifié des deux côtés (${forme.arbitre})`,
          retenu: gagnant === ici ? 'cet appareil' : 'le serveur',
        });
      }
      return gagnant;
    }
  }

  return fusionnerObjet(socle, ici, laBas, forme, chemin, journal);
}

/** Fusion clé par clé d'un dictionnaire. */
function fusionnerObjet(base, local, distant, forme, chemin, journal) {
  if (!estObjet(local) || !estObjet(distant)) {
    return fusionnerValeur(base, local, distant, chemin, journal);
  }

  const socle = estObjet(base) ? base : {};
  const resultat = {};
  const cles = new Set([...Object.keys(local), ...Object.keys(distant)]);

  for (const cle of cles) {
    const presentIci = Object.prototype.hasOwnProperty.call(local, cle);
    const presentLaBas = Object.prototype.hasOwnProperty.call(distant, cle);
    const auSocle = Object.prototype.hasOwnProperty.call(socle, cle);

    if (presentIci && !presentLaBas) {
      // Retirée là-bas : on ne la retire ici que si elle n'a pas bougé depuis.
      if (auSocle && memeValeur(socle[cle], local[cle])) continue;
      resultat[cle] = local[cle];
      continue;
    }
    if (!presentIci && presentLaBas) {
      if (auSocle && memeValeur(socle[cle], distant[cle])) continue;
      resultat[cle] = distant[cle];
      continue;
    }

    resultat[cle] = fusionnerBranche(
      socle[cle], local[cle], distant[cle],
      forme?.champs?.[cle], chemin ? `${chemin}.${cle}` : cle, journal
    );
  }

  return resultat;
}

/** Arbitrage d'une valeur simple : le serveur tranche, la valeur écartée est consignée. */
function fusionnerValeur(base, local, distant, chemin, journal) {
  if (memeValeur(local, distant)) return distant;

  const changeIci = !memeValeur(base, local);
  const changeLaBas = !memeValeur(base, distant);

  if (changeIci && !changeLaBas) return local;
  if (!changeIci && changeLaBas) return distant;

  journal.conflits.push({ chemin, motif: 'modifié des deux côtés', retenu: 'le serveur', ecarte: local });
  return distant;
}

/* ------------------------------------------------------------- Entrée */

/**
 * Réconcilie trois états et rend le résultat avec le compte rendu des
 * arbitrages.
 *
 * @param {object} etats.base     dernier état commun connu, ou null au premier échange
 * @param {object} etats.local    état de cet appareil
 * @param {object} etats.distant  état du serveur
 * @param {object} forme          description issue de `FORMES`
 * @returns {{fusion: any, journal: object, identiqueAuDistant: boolean, identiqueAuLocal: boolean}}
 */
export function fusionner({ base, local, distant }, forme) {
  const journal = creerJournal();

  // Sans socle — premier échange, ou base perdue — on ne peut distinguer un
  // ajout d'une suppression. On prend alors le parti de tout garder : mieux
  // vaut une entrée en trop qu'une séance de travail disparue.
  const socle = base === null || base === undefined ? undefined : base;

  const fusion = fusionnerBranche(socle, local, distant, forme, '', journal);

  return {
    fusion,
    journal,
    identiqueAuDistant: memeValeur(fusion, distant),
    identiqueAuLocal: memeValeur(fusion, local),
  };
}

/** Vrai si la fusion a écarté au moins une valeur. */
export const aDesConflits = (journal) => Boolean(journal?.conflits?.length);
