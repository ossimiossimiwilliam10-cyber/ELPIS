import { describe, it, expect } from 'vitest';
import { fusionner, memeValeur, aDesConflits, FORMES } from './fusion';

/** Raccourci : fusionne et ne rend que le résultat. */
const f = (base, local, distant, forme) => fusionner({ base, local, distant }, forme).fusion;

/** Raccourci : fusionne et ne rend que le compte rendu. */
const j = (base, local, distant, forme) => fusionner({ base, local, distant }, forme).journal;

describe('Égalité structurelle', () => {
  it('ignore l’ordre des clés', () => {
    expect(memeValeur({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('compare en profondeur', () => {
    expect(memeValeur({ a: [{ b: 1 }] }, { a: [{ b: 1 }] })).toBe(true);
    expect(memeValeur({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe(false);
  });

  it('distingue l’absence de la valeur nulle', () => {
    expect(memeValeur(null, undefined)).toBe(false);
    expect(memeValeur(0, '0')).toBe(false);
    expect(memeValeur([], {})).toBe(false);
  });
});

describe('Journal d’événements — historique', () => {
  const forme = FORMES.historique;
  const entree = (id, jour) => ({ id, type: 'CM', matiere: 'Analyse', timestamp: `2026-08-${jour}T10:00:00` });

  it('réunit les entrées des deux appareils', () => {
    // Le scénario qui détruisait des données : trois validations hors ligne
    // écrasées au retour du réseau.
    const base = [entree('a', '20')];
    const local = [entree('a', '20'), entree('b', '21'), entree('c', '22')];
    const distant = [entree('a', '20'), entree('d', '23')];

    const fusion = f(base, local, distant, forme);
    expect(fusion.map(e => e.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rend les entrées triées par horodatage', () => {
    const fusion = f([], [entree('c', '25')], [entree('a', '21')], forme);
    expect(fusion.map(e => e.id)).toEqual(['a', 'c']);
  });

  it('ne duplique pas une entrée connue des deux côtés', () => {
    const fusion = f([], [entree('a', '20')], [entree('a', '20')], forme);
    expect(fusion).toHaveLength(1);
  });

  it('ne réécrit jamais un événement déjà enregistré', () => {
    // Un événement passé est immuable : la version du serveur fait foi.
    const distant = [{ ...entree('a', '20'), dureeMinutes: 30 }];
    const local = [{ ...entree('a', '20'), dureeMinutes: 999 }];
    expect(f([], local, distant, forme)[0].dureeMinutes).toBe(30);
  });

  it('ne supprime jamais une entrée absente d’un côté', () => {
    // Une absence signifie « pas encore vu », jamais « effacé ».
    const base = [entree('a', '20'), entree('b', '21')];
    const fusion = f(base, [entree('a', '20')], base, forme);
    expect(fusion.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('survit à un socle absent', () => {
    const fusion = f(null, [entree('a', '20')], [entree('b', '21')], forme);
    expect(fusion).toHaveLength(2);
  });
});

describe('Listes d’entités — projets', () => {
  const forme = FORMES.projets;
  const p = (id, sur = {}) => ({ id, nom: `Projet ${id}`, progress: 0, ...sur });

  it('garde ce que chaque appareil a ajouté', () => {
    const fusion = f([p('a')], [p('a'), p('b')], [p('a'), p('c')], forme);
    expect(fusion.map(e => e.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('applique une modification faite d’un seul côté', () => {
    const base = [p('a', { progress: 0 })];
    const fusion = f(base, [p('a', { progress: 50 })], base, forme);
    expect(fusion[0].progress).toBe(50);
  });

  it('respecte une suppression quand l’autre côté n’a rien changé', () => {
    const base = [p('a'), p('b')];
    expect(f(base, [p('a')], base, forme).map(e => e.id)).toEqual(['a']);
    expect(f(base, base, [p('a')], forme).map(e => e.id)).toEqual(['a']);
  });

  it('préfère le travail à la suppression quand les deux s’opposent', () => {
    // Retrouver une ligne qu'on croyait effacée est un désagrément ; perdre
    // une progression en est un autre.
    const base = [p('a', { progress: 0 })];
    const local = [];
    const distant = [p('a', { progress: 80 })];

    const resultat = fusionner({ base, local, distant }, forme);
    expect(resultat.fusion).toHaveLength(1);
    expect(resultat.fusion[0].progress).toBe(80);
    expect(resultat.journal.ressuscites).toBe(1);
    expect(aDesConflits(resultat.journal)).toBe(true);
  });

  it('fusionne champ par champ deux modifications qui ne se touchent pas', () => {
    const base = [p('a', { progress: 0, status: 'en cours' })];
    const local = [p('a', { progress: 60, status: 'en cours' })];
    const distant = [p('a', { progress: 0, status: 'terminé' })];

    expect(f(base, local, distant, forme)[0]).toMatchObject({ progress: 60, status: 'terminé' });
  });

  it('laisse le serveur trancher un champ modifié des deux côtés', () => {
    const base = [p('a', { progress: 0 })];
    const resultat = fusionner({
      base, local: [p('a', { progress: 60 })], distant: [p('a', { progress: 30 })],
    }, forme);

    expect(resultat.fusion[0].progress).toBe(30);
    expect(resultat.journal.conflits[0]).toMatchObject({ retenu: 'le serveur', ecarte: 60 });
  });

  it('conserve une entité sans identifiant plutôt que de la perdre', () => {
    /*
     * Ce test disait l'inverse — les entités sans clé étaient écartées, pour ne
     * pas risquer de les confondre entre elles. Le raisonnement se tenait, mais
     * il opposait « écarter » à « mélanger » en oubliant la troisième voie :
     * garder sans apparier.
     *
     * La réalité a tranché : dix chapitres saisis sur le PC revenaient à six,
     * parce que la page Cours créait ses éléments sans identifiant. Rien ne le
     * signalait, et le résultat de la fusion étant réécrit des deux côtés, la
     * saisie disparaissait partout. Un doublon se voit et se corrige ; une
     * perte silencieuse, non.
     */
    const fusion = f([], [{ nom: 'sans id' }], [], forme);
    expect(fusion).toHaveLength(1);
  });

  it('ne double pas l’entité quand le serveur lui a donné un identifiant', () => {
    // Le tour suivant : la base a enregistré l'entité et l'a dotée d'une clé,
    // tandis que l'appareil garde encore sa version anonyme.
    const fusion = f([], [{ nom: 'sans id' }], [{ id: 'p-1', nom: 'sans id' }], forme);
    expect(fusion).toHaveLength(1);
    expect(fusion[0].id).toBe('p-1');
  });

  it('ne grossit pas d’un échange à l’autre', () => {
    let base = [];
    let local = [{ nom: 'sans id' }];
    let distant = [];
    for (let tour = 0; tour < 5; tour++) {
      const fusion = f(base, local, distant, forme);
      // La base attribue une clé à ce qui n'en a pas, à l'écriture.
      distant = fusion.map(e => (e.id ? e : { ...e, id: 'p-1' }));
      base = distant;
      local = fusion;
    }
    expect(distant).toHaveLength(1);
  });
});

describe('Valeurs monotones', () => {
  const forme = FORMES.config;

  it('une série ne recule pas', () => {
    const fusion = f({ bestStreak: 5 }, { bestStreak: 12 }, { bestStreak: 8 }, forme);
    expect(fusion.bestStreak).toBe(12);
  });

  it('la date de dernière pratique la plus récente l’emporte', () => {
    const fusion = f(
      { dernierePratiqueAnki: '2026-08-01' },
      { dernierePratiqueAnki: '2026-08-26' },
      { dernierePratiqueAnki: '2026-08-20' },
      forme
    );
    expect(fusion.dernierePratiqueAnki).toBe('2026-08-26');
  });

  it('une valeur vide cède à une valeur renseignée', () => {
    expect(f({}, { bestStreak: '' }, { bestStreak: 7 }, forme).bestStreak).toBe(7);
    expect(f({}, { bestStreak: 7 }, { bestStreak: null }, forme).bestStreak).toBe(7);
  });
});

describe('Ensembles — jours de repos', () => {
  const forme = FORMES.config;

  it('les jours ajoutés de part et d’autre se réunissent', () => {
    const fusion = f(
      { restDays: ['2026-08-01'] },
      { restDays: ['2026-08-01', '2026-08-10'] },
      { restDays: ['2026-08-01', '2026-08-15'] },
      forme
    );
    expect(fusion.restDays.sort()).toEqual(['2026-08-01', '2026-08-10', '2026-08-15']);
  });

  it('un jour retiré d’un côté est bien retiré', () => {
    const fusion = f(
      { restDays: ['2026-08-01', '2026-08-02'] },
      { restDays: ['2026-08-01'] },
      { restDays: ['2026-08-01', '2026-08-02'] },
      forme
    );
    expect(fusion.restDays).toEqual(['2026-08-01']);
  });
});

describe('Configuration', () => {
  const forme = FORMES.config;

  it('deux réglages différents modifiés séparément coexistent', () => {
    const base = { maxStudyHoursPerDay: 8, maxSubjectsPerDay: 3 };
    const fusion = f(base, { ...base, maxStudyHoursPerDay: 6 }, { ...base, maxSubjectsPerDay: 5 }, forme);
    expect(fusion).toMatchObject({ maxStudyHoursPerDay: 6, maxSubjectsPerDay: 5 });
  });

  it('un réglage ajouté d’un côté n’est pas effacé par l’autre', () => {
    const fusion = f({ a: 1 }, { a: 1, nouveau: 'ici' }, { a: 1 }, forme);
    expect(fusion.nouveau).toBe('ici');
  });

  it('une clé retirée des deux côtés disparaît', () => {
    const fusion = f({ a: 1, vieux: 2 }, { a: 1 }, { a: 1 }, forme);
    expect(fusion).not.toHaveProperty('vieux');
  });

  it('une clé retirée d’un côté mais modifiée de l’autre est conservée', () => {
    const fusion = f({ a: 1, cle: 'ancien' }, { a: 1 }, { a: 1, cle: 'modifié' }, forme);
    expect(fusion.cle).toBe('modifié');
  });
});

describe('Langues', () => {
  const forme = FORMES.config;
  const langue = (sur = {}) => ({
    id: 'l1', nom: 'Anglais', cadence: 3,
    dernieresPratiques: { vocabulaire: '', conversation: '', grammaire: '' },
    vocabulaire: { deckAnki: 'Anglais::Voc', liens: [] },
    conversation: { liens: [] },
    grammaire: { liens: [], livre: '' },
    ...sur,
  });

  it('une séance faite sur un appareil n’est pas annulée par l’autre', () => {
    const base = { langues: [langue()] };
    const local = { langues: [langue({ dernieresPratiques: { vocabulaire: '2026-08-26', conversation: '', grammaire: '' } })] };
    const distant = { langues: [langue({ dernieresPratiques: { vocabulaire: '', conversation: '2026-08-25', grammaire: '' } })] };

    const fusion = f(base, local, distant, forme);
    expect(fusion.langues[0].dernieresPratiques).toMatchObject({
      vocabulaire: '2026-08-26',
      conversation: '2026-08-25',
    });
  });

  it('la date la plus récente l’emporte sur le même volet', () => {
    const base = { langues: [langue()] };
    const avec = d => ({ langues: [langue({ dernieresPratiques: { vocabulaire: d, conversation: '', grammaire: '' } })] });

    expect(f(base, avec('2026-08-26'), avec('2026-08-20'), forme).langues[0].dernieresPratiques.vocabulaire)
      .toBe('2026-08-26');
  });

  it('les fils de conversation ajoutés de part et d’autre se réunissent', () => {
    const base = { langues: [langue()] };
    const local = { langues: [langue({ grammaire: { liens: [{ id: 'g1', libelle: 'Passé', url: 'https://a.test' }], livre: '' } })] };
    const distant = { langues: [langue({ grammaire: { liens: [{ id: 'g2', libelle: 'Futur', url: 'https://b.test' }], livre: '' } })] };

    const liens = f(base, local, distant, forme).langues[0].grammaire.liens;
    expect(liens.map(l => l.id).sort()).toEqual(['g1', 'g2']);
  });

  it('une langue ajoutée sur chaque appareil donne deux langues', () => {
    const fusion = f(
      { langues: [] },
      { langues: [langue({ id: 'l1', nom: 'Anglais' })] },
      { langues: [langue({ id: 'l2', nom: 'Japonais' })] },
      forme
    );
    expect(fusion.langues.map(l => l.nom).sort()).toEqual(['Anglais', 'Japonais']);
  });
});

describe('Arbre des cours', () => {
  const forme = FORMES.cours;

  const arbre = (cm) => ({
    licences: [{
      id: 'L1', nom: 'Licence 1',
      semestres: [{
        id: 'S1', nom: 'S1',
        ues: [{
          id: 'U1', nom: 'UE1',
          matieres: [{ id: 'M1', nom: 'Analyse', listeCM: cm, listeTD: [], listeTP: [], listeAnnales: [] }],
        }],
      }],
    }],
  });

  const cm = (sur = {}) => ({ id: 'C1', titre: 'Suites', jActuel: 1, derniereRevision: '2026-08-01', ...sur });
  const premierCM = a => a.licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
  const lesCM = a => a.licences[0].semestres[0].ues[0].matieres[0].listeCM;

  it('la révision la plus récente décrit l’état réel de la mémoire', () => {
    // Réviser le même cours des deux côtés est un vrai conflit : mélanger les
    // champs produirait une carte FSRS incohérente.
    const base = arbre([cm()]);
    const local = arbre([cm({ derniereRevision: '2026-08-26', jActuel: 9 })]);
    const distant = arbre([cm({ derniereRevision: '2026-08-20', jActuel: 4 })]);

    const resultat = fusionner({ base, local, distant }, forme);
    expect(premierCM(resultat.fusion)).toMatchObject({ derniereRevision: '2026-08-26', jActuel: 9 });
    expect(resultat.journal.conflits[0].retenu).toBe('cet appareil');
  });

  it('l’état FSRS n’est jamais panaché entre deux versions', () => {
    const base = arbre([cm({ fsrsCard: { stability: 1 } })]);
    const local = arbre([cm({ derniereRevision: '2026-08-10', jActuel: 3, fsrsCard: { stability: 3 } })]);
    const distant = arbre([cm({ derniereRevision: '2026-08-26', jActuel: 12, fsrsCard: { stability: 12 } })]);

    const gagnant = premierCM(f(base, local, distant, forme));
    expect(gagnant.jActuel).toBe(12);
    expect(gagnant.fsrsCard.stability).toBe(12); // pas 3 : l'entité entière suit
  });

  it('un cours ajouté sur un appareil apparaît sur l’autre', () => {
    const base = arbre([cm()]);
    const local = arbre([cm(), cm({ id: 'C2', titre: 'Séries' })]);

    expect(lesCM(f(base, local, base, forme)).map(c => c.id)).toEqual(['C1', 'C2']);
  });

  it('une matière ajoutée de chaque côté ne s’écrase pas', () => {
    const deux = (idMatiere, nom) => ({
      licences: [{
        id: 'L1', nom: 'Licence 1',
        semestres: [{
          id: 'S1', nom: 'S1',
          ues: [{ id: 'U1', nom: 'UE1', matieres: [{ id: idMatiere, nom, listeCM: [] }] }],
        }],
      }],
    });

    const base = { licences: [{ id: 'L1', nom: 'Licence 1', semestres: [{ id: 'S1', nom: 'S1', ues: [{ id: 'U1', nom: 'UE1', matieres: [] }] }] }] };
    const fusion = f(base, deux('M1', 'Analyse'), deux('M2', 'Algèbre'), forme);
    const matieres = fusion.licences[0].semestres[0].ues[0].matieres;
    expect(matieres.map(m => m.nom).sort()).toEqual(['Algèbre', 'Analyse']);
  });

  it('un cursus vide au premier échange ne supprime rien', () => {
    const local = arbre([cm()]);
    const fusion = f(null, local, { licences: [] }, forme);
    expect(lesCM(fusion)).toHaveLength(1);
  });
});

describe('Convergence', () => {
  const forme = FORMES.config;

  it('deux appareils qui synchronisent tour à tour aboutissent au même état', () => {
    // C'est la propriété qui compte : sans elle, les appareils se renvoient
    // indéfiniment leur version.
    const base = { a: 1, b: 1, restDays: [] };
    const surA = { a: 2, b: 1, restDays: ['lundi'] };
    const surB = { a: 3, b: 5, restDays: ['mardi'] };

    // A synchronise le premier : le serveur part de la base.
    const premier = f(base, surA, base, forme);
    // B synchronise ensuite, face au résultat de A.
    const second = f(base, surB, premier, forme);
    // A resynchronise : son socle est désormais le résultat qu'il a poussé.
    const troisieme = f(premier, premier, second, forme);

    expect(troisieme).toEqual(second);
    expect(second.a).toBe(2); // le serveur avait tranché en faveur de A
    expect(second.b).toBe(5); // B seul avait touché à `b`
    expect(second.restDays.sort()).toEqual(['lundi', 'mardi']);
  });

  it('une fusion sans changement se reconnaît, pour éviter un envoi inutile', () => {
    const etat = { a: 1 };
    const resultat = fusionner({ base: etat, local: etat, distant: etat }, forme);
    expect(resultat.identiqueAuDistant).toBe(true);
    expect(resultat.identiqueAuLocal).toBe(true);
    expect(aDesConflits(resultat.journal)).toBe(false);
  });

  it('le compte rendu distingue ajouts, suppressions et résurrections', () => {
    const journal = j(
      { restDays: ['a', 'b'] },
      { restDays: ['a', 'c'] },
      { restDays: ['a', 'b'] },
      forme
    );
    expect(journal.ajouts).toBe(1);
    expect(journal.suppressions).toBe(1);
  });
});

describe('Robustesse', () => {
  it('accepte des états absents sans lever', () => {
    expect(() => fusionner({ base: null, local: null, distant: null }, FORMES.config)).not.toThrow();
    expect(f(null, undefined, { a: 1 }, FORMES.config)).toEqual({ a: 1 });
  });

  it('une forme inconnue retombe sur le comportement prudent', () => {
    // Tableau : union. Valeur : arbitrage du serveur.
    expect(f([], ['x'], ['y'], undefined).sort()).toEqual(['x', 'y']);
    expect(f(1, 2, 3, undefined)).toBe(3);
  });

  it('un tableau devenu objet ne fait pas tomber la fusion', () => {
    expect(() => f({ a: [] }, { a: {} }, { a: [1] }, FORMES.config)).not.toThrow();
  });
});

describe('Un élément sans identifiant', () => {
  /*
   * Le bug des chapitres qui s'évaporent.
   *
   * Constaté en vrai : dix chapitres saisis sur le PC, six au retour. La
   * fusion des listes se fait par identifiant — `indexer` construit une table
   * clé → élément — et un élément sans identifiant n'y entre tout simplement
   * pas. Il ne provoque aucune erreur : il disparaît du résultat, et comme ce
   * résultat est ensuite réécrit des deux côtés, la saisie est perdue partout.
   *
   * La cause était en amont : la page Cours créait ses éléments sans leur
   * donner d'identifiant, en comptant sur la base pour en générer un à
   * l'écriture. Entre la création et l'écriture, il y avait la fusion.
   *
   * Ces tests décrivent les deux versants : ce que la fusion fait d'un élément
   * sans identifiant — qu'on ne peut pas fusionner autrement sans inventer des
   * doublons — et le fait qu'avec un identifiant, la saisie survit.
   */

  const chapitre = (n, extra = {}) => ({ id: `cm-${n}`, titre: `Chapitre ${n}`, jActuel: 0, ...extra });

  const cursus = (chapitres) => ({
    licences: [{
      id: 'l1', nom: 'L2',
      semestres: [{
        id: 's1', nom: 'S3',
        ues: [{
          id: 'u1', nom: 'UE 1',
          matieres: [{ id: 'm1', nom: 'Mécanique 3', listeCM: chapitres, listeTD: [], listeTP: [], listeAnnales: [] }],
        }],
      }],
    }],
  });

  const chapitresDe = (resultat) =>
    resultat.licences[0].semestres[0].ues[0].matieres[0].listeCM;

  it('conserve les nouveaux chapitres quand ils portent un identifiant', () => {
    // Six chapitres connus des deux côtés, quatre ajoutés sur le PC.
    const anciens = [1, 2, 3, 4, 5, 6].map(n => chapitre(n));
    const ajoutes = [7, 8, 9, 10].map(n => chapitre(n));

    const resultat = f(
      cursus(anciens),
      cursus([...anciens, ...ajoutes]),
      cursus(anciens),
      FORMES.cours,
    );

    expect(chapitresDe(resultat)).toHaveLength(10);
  });

  it('conserve un chapitre dépourvu d’identifiant, faute de mieux', () => {
    /*
     * La cause a été corrigée en amont : tout ce que crée la page Cours porte
     * désormais son identifiant dès la première seconde. Mais le mécanisme
     * restait capable de recommencer au premier oubli, sur n'importe quelle
     * page, ou sur des données écrites par une version antérieure. Un élément
     * sans clé ne peut pas être apparié — il est donc gardé tel quel, et le
     * compte rendu de fusion le signale.
     */
    const anciens = [1, 2, 3, 4, 5, 6].map(n => chapitre(n));
    const sansId = [
      { titre: 'Chapitre 7', jActuel: 0 },
      { titre: 'Chapitre 8', jActuel: 0 },
    ];

    const rapport = fusionner(
      { base: cursus(anciens), local: cursus([...anciens, ...sansId]), distant: cursus(anciens) },
      FORMES.cours,
    );

    expect(chapitresDe(rapport.fusion)).toHaveLength(8);
    // Et l'anomalie ne passe pas inaperçue.
    expect(rapport.journal.conflits.some(c => /sans/.test(c.motif))).toBe(true);
  });

  it('conserve aussi une matière entière ajoutée avec son identifiant', () => {
    const base = cursus([chapitre(1)]);
    const local = JSON.parse(JSON.stringify(base));
    local.licences[0].semestres[0].ues[0].matieres.push({
      id: 'm2', nom: 'Optique', listeCM: [chapitre(2)], listeTD: [], listeTP: [], listeAnnales: [],
    });

    const resultat = f(base, local, base, FORMES.cours);
    expect(resultat.licences[0].semestres[0].ues[0].matieres).toHaveLength(2);
  });
});
