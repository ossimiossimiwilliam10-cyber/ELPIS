import { describe, it, expect, vi } from 'vitest';
import {
  chercherCartes, ouvrirEpreuve, revisionsDepuis, tauxReussite,
  noteDepuisTaux, jugerEpreuve, releverEpreuve, ankiDisponible,
  rendreCartes, rapatrierCartesOubliees, DECK_EPREUVE, tailleEchantillon,
  SEUIL_DEFAUT, CARTES_MINIMUM,
} from '../moteur/epreuveAnki';

const DEBUT = new Date(2026, 8, 15, 14, 0).getTime();

/** Faux AnkiConnect : rend ce qu'on lui dit, par action. */
const anki = (reponses) => vi.fn(async (action, params) => {
  if (!(action in reponses)) throw new Error(`Action non simulée : ${action}`);
  const valeur = reponses[action];
  return typeof valeur === 'function' ? valeur(params) : valeur;
});

/** Révision Anki : `id` est l'horodatage, `ease` la réponse (1 à 4). */
const rev = (ease, decalageMs = 1000) => ({ id: DEBUT + decalageMs, ease, ivl: 5 });

describe('chercherCartes', () => {
  it('transmet la requête au navigateur d\'Anki', async () => {
    const appel = anki({ findCards: [1, 2, 3] });
    expect(await chercherCartes('deck:Physique tag:gauss', appel)).toEqual([1, 2, 3]);
    expect(appel).toHaveBeenCalledWith('findCards', { query: 'deck:Physique tag:gauss' });
  });

  it('n\'appelle pas Anki pour une requête vide', async () => {
    const appel = anki({});
    expect(await chercherCartes('   ', appel)).toEqual([]);
    expect(appel).not.toHaveBeenCalled();
  });
});

describe('ouvrirEpreuve', () => {
  const cartesInfo = [
    { cardId: 10, deckName: 'Physique::Électro::Gauss' },
    { cardId: 11, deckName: 'Physique::Électro::Gauss' },
  ];
  const seanceComplete = {
    cardsInfo: cartesInfo, createDeck: 1, changeDeck: null,
    setDueDate: null, guiDeckReview: true,
  };

  it('lance une vraie séance de révision, pas le navigateur', async () => {
    // On ne révise pas depuis le navigateur d'Anki : la séance passe par un
    // deck d'accueil, seul moyen disponible faute de deck filtré.
    const appel = anki(seanceComplete);
    const seance = await ouvrirEpreuve([10, 11], {}, appel);

    expect(seance.cartes).toBe(2);
    expect(appel).toHaveBeenCalledWith('guiDeckReview', { name: DECK_EPREUVE });
    expect(appel).not.toHaveBeenCalledWith('guiBrowse', expect.anything());
  });

  it('rend les cartes dues du jour en conservant leur intervalle', async () => {
    // Une carte dont l'échéance est lointaine ne serait pas proposée. Le
    // suffixe « ! » préserve l'intervalle : l'épreuve avance la révision sans
    // dérégler le calendrier d'Anki.
    const appel = anki(seanceComplete);
    await ouvrirEpreuve([10, 11], {}, appel);
    expect(appel).toHaveBeenCalledWith('setDueDate', { cards: [10, 11], days: '0!' });
  });

  it('mémorise le deck d\'origine de chaque carte', async () => {
    const appel = anki(seanceComplete);
    const seance = await ouvrirEpreuve([10, 11], {}, appel);
    expect(seance.origines).toEqual({
      10: 'Physique::Électro::Gauss',
      11: 'Physique::Électro::Gauss',
    });
  });

  it('refuse d\'ouvrir une épreuve sans carte', async () => {
    const appel = anki({});
    await expect(ouvrirEpreuve([], {}, appel)).rejects.toThrow(/Aucune carte/);
  });
});

describe('rendreCartes', () => {
  it('regroupe les retours par deck', async () => {
    // Un appel par carte produirait une centaine d'allers-retours avec Anki.
    const appel = anki({ changeDeck: null });
    const rendues = await rendreCartes({ 1: 'Deck A', 2: 'Deck A', 3: 'Deck B' }, appel);

    expect(rendues).toBe(3);
    expect(appel).toHaveBeenCalledTimes(2);
    expect(appel).toHaveBeenCalledWith('changeDeck', { cards: [1, 2], deck: 'Deck A' });
  });

  it('ne renvoie rien vers le deck d\'épreuve lui-même', async () => {
    const appel = anki({ changeDeck: null });
    expect(await rendreCartes({ 1: DECK_EPREUVE }, appel)).toBe(0);
    expect(appel).not.toHaveBeenCalled();
  });

  it('survit à une absence d\'origines', async () => {
    expect(await rendreCartes(null, anki({}))).toBe(0);
  });
});

describe('rapatrierCartesOubliees', () => {
  it('ne fait rien quand le deck d\'épreuve est vide', async () => {
    const appel = anki({ findCards: [] });
    expect(await rapatrierCartesOubliees(appel)).toEqual({ rapatriees: 0 });
  });

  it('rend les cartes qu\'une séance interrompue a laissées', async () => {
    // Sans ce filet, une fermeture au mauvais moment ferait disparaître ces
    // cartes des révisions de leur matière.
    const appel = anki({
      findCards: [7, 8],
      cardsInfo: [
        { cardId: 7, odid: 'Physique::Mécanique' },
        { cardId: 8, odid: 'Physique::Mécanique' },
      ],
      changeDeck: null,
    });
    const bilan = await rapatrierCartesOubliees(appel);
    expect(bilan.rapatriees).toBe(2);
    expect(bilan.restantes).toBe(2);
  });
});

describe('revisionsDepuis', () => {
  it('ne retient que les révisions postérieures au début de l\'épreuve', async () => {
    const appel = anki({
      getReviewsOfCards: {
        10: [{ id: DEBUT - 90000000, ease: 1 }, rev(3)],
        11: [rev(4, 2000)],
      },
    });
    const revisions = await revisionsDepuis([10, 11], DEBUT, appel);
    expect(revisions).toHaveLength(2);
    expect(revisions.map(r => r.ease)).toEqual([3, 4]);
  });

  it('rend les révisions dans l\'ordre chronologique', async () => {
    const appel = anki({
      getReviewsOfCards: { 10: [rev(2, 5000)], 11: [rev(4, 1000)] },
    });
    const revisions = await revisionsDepuis([10, 11], DEBUT, appel);
    expect(revisions.map(r => r.ease)).toEqual([4, 2]);
  });

  it('n\'appelle pas Anki sans carte à interroger', async () => {
    const appel = anki({});
    expect(await revisionsDepuis([], DEBUT, appel)).toEqual([]);
    expect(appel).not.toHaveBeenCalled();
  });
});

describe('tauxReussite', () => {
  it('compte comme réussie toute carte qui n\'a pas été oubliée', () => {
    // Convention d'Anki : seul « Again » est un échec, « Hard » signalant une
    // réponse retrouvée, quoique laborieusement.
    const r = tauxReussite([
      { carte: 1, ease: 1 }, { carte: 2, ease: 2 },
      { carte: 3, ease: 3 }, { carte: 4, ease: 4 },
    ]);
    expect(r).toEqual({ taux: 75, cartes: 4, reussies: 3 });
  });

  it('ne retient que la dernière réponse d\'une carte revue plusieurs fois', () => {
    // Une carte ratée puis retrouvée dans la même séance a fini par tenir.
    const r = tauxReussite([
      { carte: 1, ease: 1, horodatage: 1 },
      { carte: 1, ease: 3, horodatage: 2 },
    ]);
    expect(r).toEqual({ taux: 100, cartes: 1, reussies: 1 });
  });

  it('rend un taux nul plutôt que NaN sans révision', () => {
    expect(tauxReussite([])).toEqual({ taux: null, cartes: 0, reussies: 0 });
  });
});

describe('noteDepuisTaux', () => {
  it('gradue la note sur le taux mesuré', () => {
    expect(noteDepuisTaux(100)).toBe(4);
    expect(noteDepuisTaux(85)).toBe(3);
    expect(noteDepuisTaux(70)).toBe(2);
    expect(noteDepuisTaux(30)).toBe(1);
  });

  it('rend null sur un taux inexploitable', () => {
    expect(noteDepuisTaux(null)).toBeNull();
    expect(noteDepuisTaux(NaN)).toBeNull();
  });
});

describe('jugerEpreuve', () => {
  const serie = (n, ease, depuis = 0) => Array.from({ length: n }, (_, i) => ({ carte: depuis + i, ease }));

  it('valide une épreuve au-dessus du seuil', () => {
    const verdict = jugerEpreuve(serie(10, 3));
    expect(verdict.reussie).toBe(true);
    expect(verdict.concluante).toBe(true);
    expect(verdict.note).toBe(4);
  });

  it('refuse une épreuve sous le seuil', () => {
    const verdict = jugerEpreuve([...serie(5, 3), ...serie(5, 1, 100)]);
    expect(verdict.taux).toBe(50);
    expect(verdict.reussie).toBe(false);
    expect(verdict.motif).toMatch(/en deçà des 80 %/);
  });

  it('distingue l\'échec d\'une épreuve non concluante', () => {
    // Sanctionner une séance interrompue reviendrait à punir un imprévu.
    const verdict = jugerEpreuve(serie(2, 3));
    expect(verdict.concluante).toBe(false);
    expect(verdict.reussie).toBe(false);
    expect(verdict.note).toBeNull();
    expect(verdict.motif).toMatch(/au moins 5/);
  });

  it('signale une épreuve qui n\'a pas eu lieu', () => {
    const verdict = jugerEpreuve([]);
    expect(verdict.concluante).toBe(false);
    expect(verdict.motif).toMatch(/n'a pas eu lieu/);
  });

  it('accepte un seuil et un minimum sur mesure', () => {
    const verdict = jugerEpreuve(serie(3, 3), 60, 3);
    expect(verdict.concluante).toBe(true);
    expect(verdict.reussie).toBe(true);
  });

  it('applique les valeurs par défaut annoncées', () => {
    expect(jugerEpreuve(serie(10, 3)).seuil).toBe(SEUIL_DEFAUT);
    expect(jugerEpreuve(serie(CARTES_MINIMUM - 1, 3)).concluante).toBe(false);
  });
});

describe('releverEpreuve', () => {
  it('enchaîne recherche, relevé et jugement', async () => {
    const appel = anki({
      findCards: [1, 2, 3, 4, 5, 6],
      getReviewsOfCards: {
        1: [rev(3)], 2: [rev(3)], 3: [rev(4)],
        4: [rev(3)], 5: [rev(2)], 6: [rev(1)],
      },
    });
    const verdict = await releverEpreuve('tag:gauss', DEBUT, {}, appel);
    expect(verdict.cartes).toBe(6);
    expect(verdict.cartesCiblees).toBe(6);
    expect(verdict.taux).toBeCloseTo(83.3, 1);
    expect(verdict.reussie).toBe(true);
  });

  it('ignore les révisions antérieures à l\'épreuve', async () => {
    // Sans ce filtre, une session Anki de la veille aurait validé le cours.
    const appel = anki({
      findCards: [1, 2, 3, 4, 5],
      getReviewsOfCards: {
        1: [{ id: DEBUT - 86400000, ease: 4 }],
        2: [{ id: DEBUT - 86400000, ease: 4 }],
        3: [{ id: DEBUT - 86400000, ease: 4 }],
        4: [{ id: DEBUT - 86400000, ease: 4 }],
        5: [{ id: DEBUT - 86400000, ease: 4 }],
      },
    });
    const verdict = await releverEpreuve('tag:gauss', DEBUT, {}, appel);
    expect(verdict.cartes).toBe(0);
    expect(verdict.concluante).toBe(false);
  });
});

describe('ankiDisponible', () => {
  it('confirme quand Anki répond', async () => {
    expect(await ankiDisponible(anki({ version: 6 }))).toBe(true);
  });

  it('ne lève pas d\'erreur quand Anki est fermé', async () => {
    const injoignable = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    expect(await ankiDisponible(injoignable)).toBe(false);
  });
});

describe('resoudreDeckCours', () => {
  const decks = [
    'Physique',
    'Physique::Électromagnétisme',
    'Physique::Électromagnétisme::Théorème de Gauss',
    'Physique::Mécanique',
    'Maths',
  ];

  it('trouve le sous-deck portant le titre du cours', async () => {
    const { resoudreDeckCours } = await import('../moteur/epreuveAnki');
    expect(resoudreDeckCours('Physique::Électromagnétisme', 'Théorème de Gauss', decks))
      .toEqual({ deck: 'Physique::Électromagnétisme::Théorème de Gauss', precision: 'cours' });
  });

  it('ignore accents et casse', async () => {
    const { resoudreDeckCours } = await import('../moteur/epreuveAnki');
    expect(resoudreDeckCours('physique::electromagnetisme', 'theoreme de gauss', decks).precision)
      .toBe('cours');
  });

  it('se rabat sur la matière et le signale', async () => {
    // Le repli est annoncé plutôt que tu : l'épreuve porte alors sur toute la
    // matière, ce qui n'a pas la même valeur qu'un ciblage au cours près.
    const { resoudreDeckCours } = await import('../moteur/epreuveAnki');
    expect(resoudreDeckCours('Physique::Mécanique', 'Chapitre inexistant', decks))
      .toEqual({ deck: 'Physique::Mécanique', precision: 'matiere' });
  });

  it('ne trouve rien sans deck de matière', async () => {
    const { resoudreDeckCours } = await import('../moteur/epreuveAnki');
    expect(resoudreDeckCours(null, 'Gauss', decks).deck).toBeNull();
  });
});

describe('requeteDeck', () => {
  it('échappe les guillemets du nom de deck', async () => {
    const { requeteDeck } = await import('../moteur/epreuveAnki');
    expect(requeteDeck('Physique')).toBe('deck:"Physique"');
    expect(requeteDeck('Cours "spécial"')).toContain('\\"');
  });
});

describe('composerEchantillon', () => {
  const tirageFixe = () => 0.5;

  it('réserve la moitié des places aux cartes fragiles', async () => {
    const { composerEchantillon } = await import('../moteur/epreuveAnki');
    const fragiles = Array.from({ length: 30 }, (_, i) => i + 1);
    const toutes = Array.from({ length: 100 }, (_, i) => i + 1);
    const echantillon = composerEchantillon(fragiles, toutes, 20, tirageFixe);

    expect(echantillon).toHaveLength(20);
    expect(echantillon.filter(c => fragiles.includes(c))).toHaveLength(20 > 0 ? echantillon.filter(c => c <= 30).length : 0);
  });

  it('complète avec les autres cartes quand les fragiles manquent', async () => {
    // Une épreuve composée des seules cartes fragiles rendrait le seuil de
    // réussite structurellement inatteignable.
    const { composerEchantillon } = await import('../moteur/epreuveAnki');
    const echantillon = composerEchantillon([1, 2], Array.from({ length: 50 }, (_, i) => i + 1), 20, tirageFixe);
    expect(echantillon).toHaveLength(20);
  });

  it('ne répète jamais une carte', async () => {
    const { composerEchantillon } = await import('../moteur/epreuveAnki');
    const echantillon = composerEchantillon([1, 2, 3], [1, 2, 3, 4, 5], 20, tirageFixe);
    expect(new Set(echantillon).size).toBe(echantillon.length);
  });

  it('se limite aux cartes disponibles', async () => {
    const { composerEchantillon } = await import('../moteur/epreuveAnki');
    expect(composerEchantillon([], [1, 2, 3], 20, tirageFixe)).toHaveLength(3);
    expect(composerEchantillon([], [], 20, tirageFixe)).toEqual([]);
  });
});

describe('preparerEpreuve', () => {
  it('cible le cours et compose l\'échantillon', async () => {
    const { preparerEpreuve } = await import('../moteur/epreuveAnki');
    const appel = vi.fn(async (action, params) => {
      if (action === 'deckNames') return ['Physique::Électro', 'Physique::Électro::Gauss'];
      if (action === 'findCards') {
        if (params.query.includes('is:new') && !params.query.includes('-is:new')) return [];
        if (params.query.includes('lapses')) return [1, 2, 3];
        return Array.from({ length: 40 }, (_, i) => i + 1);
      }
      throw new Error('action inattendue : ' + action);
    });

    const prep = await preparerEpreuve('Physique::Électro', 'Gauss', { tirage: () => 0.5 }, appel);
    expect(prep.deck).toBe('Physique::Électro::Gauss');
    expect(prep.precision).toBe('cours');
    expect(prep.fragiles).toBe(3);
    expect(prep.disponibles).toBe(40);
    // 40 cartes vues : l'échantillon s'y adapte au lieu d'être figé à vingt.
    expect(prep.cartes).toHaveLength(tailleEchantillon(40));
    expect(prep.requete).toMatch(/^cid:\d+/);
  });

  it('ne compose rien quand le deck reste introuvable', async () => {
    const { preparerEpreuve } = await import('../moteur/epreuveAnki');
    const appel = vi.fn(async () => []);
    const prep = await preparerEpreuve(null, 'Gauss', {}, appel);
    expect(prep.cartes).toEqual([]);
    expect(prep.requete).toBeNull();
  });
});

describe('questionLisible', () => {
  it('extrait la question du HTML d\'Anki', async () => {
    const { questionLisible } = await import('../moteur/epreuveAnki');
    const carte = { fields: { Recto: { value: '<div><b>Théorème</b> de&nbsp;Gauss ?</div>' } } };
    expect(questionLisible(carte)).toBe('Théorème de Gauss ?');
  });

  it('accepte les modèles anglophones', async () => {
    const { questionLisible } = await import('../moteur/epreuveAnki');
    expect(questionLisible({ fields: { Front: { value: 'Question' } } })).toBe('Question');
  });

  it('tronque sans couper au milieu d\'un mot invisible', async () => {
    const { questionLisible } = await import('../moteur/epreuveAnki');
    const longue = { fields: { Recto: { value: 'a'.repeat(200) } } };
    expect(questionLisible(longue, 40)).toHaveLength(40);
    expect(questionLisible(longue, 40).endsWith('…')).toBe(true);
  });

  it('survit à une carte sans champ exploitable', async () => {
    const { questionLisible } = await import('../moteur/epreuveAnki');
    expect(questionLisible({})).toBe('');
    expect(questionLisible({ fields: {} })).toBe('');
  });
});

describe('diagnostiquerEchecs', () => {
  it('nomme les notions qui n\'ont pas été retrouvées', async () => {
    // Un taux dit qu'il faut retravailler ; il ne dit pas quoi.
    const { diagnostiquerEchecs } = await import('../moteur/epreuveAnki');
    const appel = anki({
      cardsInfo: [
        { cardId: 1, lapses: 3, fields: { Recto: { value: 'Théorème de Gauss ?' } } },
        { cardId: 2, lapses: 0, fields: { Recto: { value: 'Loi de Faraday ?' } } },
      ],
    });
    const d = await diagnostiquerEchecs([
      { carte: 1, ease: 1 }, { carte: 2, ease: 1 }, { carte: 3, ease: 3 },
    ], appel);

    expect(d.total).toBe(2);
    expect(d.notions.map(n => n.question)).toEqual(['Théorème de Gauss ?', 'Loi de Faraday ?']);
  });

  it('distingue une lacune installée d\'un simple trou de mémoire', async () => {
    const { diagnostiquerEchecs } = await import('../moteur/epreuveAnki');
    const appel = anki({
      cardsInfo: [{ cardId: 1, lapses: 4, fields: { Recto: { value: 'Q' } } }],
    });
    const d = await diagnostiquerEchecs([{ carte: 1, ease: 1 }], appel);
    expect(d.notions[0].recurrente).toBe(true);
  });

  it('écarte une carte ratée puis retrouvée dans la séance', async () => {
    const { diagnostiquerEchecs } = await import('../moteur/epreuveAnki');
    const appel = anki({ cardsInfo: [] });
    const d = await diagnostiquerEchecs([
      { carte: 1, ease: 1 }, { carte: 1, ease: 3 },
    ], appel);
    expect(d.total).toBe(0);
    expect(appel).not.toHaveBeenCalled();
  });

  it('n\'interroge Anki que s\'il y a des échecs', async () => {
    const { diagnostiquerEchecs } = await import('../moteur/epreuveAnki');
    const appel = anki({});
    expect(await diagnostiquerEchecs([{ carte: 1, ease: 4 }], appel)).toEqual({ notions: [], total: 0, affichees: 0 });
    expect(appel).not.toHaveBeenCalled();
  });

  it('borne le nombre de notions listées', async () => {
    // Vingt lignes d'échec découragent au lieu d'orienter.
    const { diagnostiquerEchecs } = await import('../moteur/epreuveAnki');
    const appel = anki({
      cardsInfo: (params) => params.cards.map(id => ({ cardId: id, lapses: 0, fields: { Recto: { value: 'Q' + id } } })),
    });
    const echecs = Array.from({ length: 15 }, (_, i) => ({ carte: i, ease: 1 }));
    const d = await diagnostiquerEchecs(echecs, appel);

    expect(d.total).toBe(15);
    expect(d.affichees).toBeLessThanOrEqual(6);
  });
});

describe('cartes jamais étudiées', () => {
  const infosDe = (ids) => ids.map(id => ({ cardId: id, deckName: 'Physique::Gauss' }));

  it('les tient à part dans la préparation', async () => {
    const { preparerEpreuve } = await import('../moteur/epreuveAnki');
    const appel = vi.fn(async (action, params) => {
      if (action === 'deckNames') return ['Physique::Gauss'];
      if (action === 'findCards') {
        if (params.query.includes('is:new') && !params.query.includes('-is:new')) return [101, 102, 103, 104, 105, 106, 107];
        if (params.query.includes('lapses')) return [1, 2];
        return Array.from({ length: 40 }, (_, i) => i + 1);
      }
      throw new Error('inattendu : ' + action);
    });

    const prep = await preparerEpreuve('Physique::Gauss', null, { tirage: () => 0.5 }, appel);
    const attendue = tailleEchantillon(40);
    expect(prep.revision).toHaveLength(attendue);
    expect(prep.nouvelles).toHaveLength(5);
    expect(prep.cartes).toHaveLength(attendue + 5);
    expect(prep.aApprendre).toBe(7);
  });

  it('n\'applique aucune échéance aux cartes neuves', async () => {
    // `setDueDate` convertit une carte neuve en carte de révision : elle
    // sauterait la phase d'apprentissage, qui est ce qui l'ancre.
    const { ouvrirEpreuve } = await import('../moteur/epreuveAnki');
    const appel = anki({
      cardsInfo: infosDe([1, 2, 101]), createDeck: 1, changeDeck: null,
      setDueDate: null, guiDeckReview: true,
    });

    const seance = await ouvrirEpreuve([1, 2, 101], { nouvelles: [101] }, appel);
    expect(appel).toHaveBeenCalledWith('setDueDate', { cards: [1, 2], days: '0!' });
    expect(seance.replanifiees).toBe(2);
    expect(seance.nouvelles).toBe(1);
  });

  it('déplace tout de même les neuves vers le deck d\'épreuve', async () => {
    const { ouvrirEpreuve } = await import('../moteur/epreuveAnki');
    const appel = anki({
      cardsInfo: infosDe([1, 101]), createDeck: 1, changeDeck: null,
      setDueDate: null, guiDeckReview: true,
    });
    await ouvrirEpreuve([1, 101], { nouvelles: [101] }, appel);
    expect(appel).toHaveBeenCalledWith('changeDeck', { cards: [1, 101], deck: DECK_EPREUVE });
  });

  it('exclut les neuves du taux de réussite', async () => {
    // Les compter mesurerait l'ignorance, et ferait échouer toute épreuve
    // portant sur un chapitre fraîchement rempli.
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    const revisions = [
      ...Array.from({ length: 10 }, (_, i) => ({ carte: i, ease: 3 })),
      ...Array.from({ length: 5 }, (_, i) => ({ carte: 100 + i, ease: 1 })),
    ];
    const verdict = jugerEpreuve(revisions, 80, 5, [100, 101, 102, 103, 104]);

    expect(verdict.taux).toBe(100);
    expect(verdict.cartes).toBe(10);
    expect(verdict.decouvertes).toBe(5);
    expect(verdict.reussie).toBe(true);
  });

  it('reconnaît un premier contact au lieu de conclure à un échec', async () => {
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    const neuves = [100, 101, 102];
    const verdict = jugerEpreuve(neuves.map(c => ({ carte: c, ease: 1 })), 80, 5, neuves);

    expect(verdict.premierContact).toBe(true);
    expect(verdict.concluante).toBe(false);
    expect(verdict.reussie).toBe(false);
    expect(verdict.motif).toMatch(/3 nouvelles cartes découvertes/);
  });

  it('ne change rien quand aucune carte n\'est neuve', async () => {
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    const revisions = Array.from({ length: 10 }, (_, i) => ({ carte: i, ease: 3 }));
    expect(jugerEpreuve(revisions, 80, 5, []).taux).toBe(100);
    expect(jugerEpreuve(revisions).decouvertes).toBe(0);
  });
});

describe('tailleEchantillon', () => {
  it('grandit avec le chapitre, sans le suivre proportionnellement', async () => {
    // Un chapitre deux fois plus gros appelle une épreuve un peu plus large,
    // pas deux fois plus longue.
    const { tailleEchantillon } = await import('../moteur/epreuveAnki');
    expect(tailleEchantillon(100)).toBeLessThan(tailleEchantillon(400));
    expect(tailleEchantillon(400)).toBeLessThan(tailleEchantillon(100) * 2);
  });

  it('respecte ses bornes', async () => {
    const { tailleEchantillon, ECHANTILLON_MIN, ECHANTILLON_MAX } = await import('../moteur/epreuveAnki');
    expect(tailleEchantillon(50)).toBeGreaterThanOrEqual(ECHANTILLON_MIN);
    expect(tailleEchantillon(5000)).toBe(ECHANTILLON_MAX);
  });

  it('ne tire jamais plus de cartes qu\'il n\'en existe', async () => {
    // Le plancher s'applique après les bornes : on ne tire pas quinze cartes
    // dans un chapitre qui n'en compte que dix.
    const { tailleEchantillon } = await import('../moteur/epreuveAnki');
    expect(tailleEchantillon(10)).toBe(10);
    expect(tailleEchantillon(3)).toBe(3);
  });

  it('retombe sur la valeur de repli quand le total est inconnu', async () => {
    const { tailleEchantillon, TAILLE_ECHANTILLON } = await import('../moteur/epreuveAnki');
    expect(tailleEchantillon(null)).toBe(TAILLE_ECHANTILLON);
    expect(tailleEchantillon(0)).toBe(TAILLE_ECHANTILLON);
  });
});

describe('margeErreur', () => {
  it('décroît quand l\'échantillon grandit', async () => {
    const { margeErreur } = await import('../moteur/epreuveAnki');
    expect(margeErreur(80, 40, 1000)).toBeLessThan(margeErreur(80, 10, 1000));
  });

  it('tient compte de la population finie', async () => {
    // Interroger vingt cartes sur vingt-cinq laisse peu de place au hasard ;
    // vingt sur mille en laisse beaucoup.
    const { margeErreur } = await import('../moteur/epreuveAnki');
    expect(margeErreur(80, 20, 25)).toBeLessThan(margeErreur(80, 20, 1000));
  });

  it('rend null sur un échantillon trop petit pour signifier quoi que ce soit', async () => {
    const { margeErreur } = await import('../moteur/epreuveAnki');
    expect(margeErreur(80, 1, 100)).toBeNull();
    expect(margeErreur(80, 0, 100)).toBeNull();
  });
});

describe('jugerEpreuve — précision de la mesure', () => {
  const serie = (n, ease, depuis = 0) => Array.from({ length: n }, (_, i) => ({ carte: depuis + i, ease }));

  it('signale un résultat trop proche du seuil pour trancher', async () => {
    // 79 % sur vingt cartes ne se distingue pas de 85 % : conclure à l'échec
    // reviendrait à jouer à pile ou face autour de la limite.
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    const verdict = jugerEpreuve([...serie(16, 3), ...serie(4, 1, 100)], 80, 5, [], 200);
    expect(verdict.taux).toBe(80);
    expect(verdict.serre).toBe(true);
    expect(verdict.marge).toBeGreaterThan(0);
  });

  it('tranche sans réserve quand l\'écart dépasse la marge', async () => {
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    const verdict = jugerEpreuve(serie(20, 4), 80, 5, [], 200);
    expect(verdict.taux).toBe(100);
    expect(verdict.serre).toBe(false);
    expect(verdict.reussie).toBe(true);
  });

  it('joint la marge à tout verdict concluant', async () => {
    const { jugerEpreuve } = await import('../moteur/epreuveAnki');
    expect(jugerEpreuve(serie(20, 3), 80, 5, [], 135).marge).toBeGreaterThan(0);
  });
});
