import { describe, test, expect } from 'vitest';
import {
  VOLETS,
  CLES_VOLETS,
  DETTE_MAX,
  PRIORITE_MIN,
  PRIORITE_MAX,
  normaliserCadence,
  normaliserLangue,
  chargerLangues,
  intervalleCible,
  voletExploitable,
  etatVolet,
  prioriteDepuisDette,
  etatLangue,
  etatLangues,
  tachesLangues,
  regulariteRecente,
  dernieresDepuisHistorique,
  joursEntre,
} from '../moteur/langues';

const AUJOURDHUI = '2026-08-26';

/** Langue complète, chaque volet exploitable, pour partir d'un cas net. */
const anglais = (surcharge = {}) => ({
  id: 'lang-1',
  nom: 'Anglais',
  drapeau: '🇬🇧',
  actif: true,
  cadence: 3,
  vocabulaire: { deckAnki: 'Anglais::Vocabulaire', dureeMinutes: 20 },
  conversation: { lienIA: 'https://exemple.test/conv', dureeMinutes: 20 },
  grammaire: { lienIA: 'https://exemple.test/gram', livre: 'grammaire.pdf', dureeMinutes: 30 },
  dernieresPratiques: { vocabulaire: AUJOURDHUI, conversation: AUJOURDHUI, grammaire: AUJOURDHUI },
  ...surcharge,
});

/** Date située `n` jours avant la date de référence des tests. */
const ilYA = (n) => {
  const d = new Date(2026, 7, 26);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Cadence et intervalles', () => {
  test('la cadence est ramenée entre 1 et 7', () => {
    expect(normaliserCadence(0)).toBe(1);
    expect(normaliserCadence(99)).toBe(7);
    expect(normaliserCadence('quatre')).toBe(3);
    expect(normaliserCadence(4)).toBe(4);
  });

  test('les intervalles se répartissent selon les poids des volets', () => {
    // Poids 3/2/1 sur six séances : deux semaines de cycle à trois séances/semaine.
    expect(intervalleCible(3, 'vocabulaire')).toBeCloseTo(14 / 3, 5);
    expect(intervalleCible(3, 'conversation')).toBeCloseTo(7, 5);
    expect(intervalleCible(3, 'grammaire')).toBeCloseTo(14, 5);
  });

  test('doubler la cadence divise chaque intervalle par deux', () => {
    for (const cle of CLES_VOLETS) {
      expect(intervalleCible(6, cle)).toBeCloseTo(intervalleCible(3, cle) / 2, 5);
    }
  });

  test('le rapport des intervalles reproduit exactement le rapport des poids', () => {
    const voc = intervalleCible(5, 'vocabulaire');
    const gram = intervalleCible(5, 'grammaire');
    expect(gram / voc).toBeCloseTo(VOLETS.vocabulaire.poids / VOLETS.grammaire.poids, 5);
  });
});

describe('Dette', () => {
  test('une séance faite le jour même ne crée aucune dette', () => {
    const etat = etatVolet(anglais(), 'vocabulaire', AUJOURDHUI);
    expect(etat.dette).toBe(0);
    expect(etat.du).toBe(false);
    expect(etat.faitAujourdhui).toBe(true);
  });

  test('la dette atteint 1 au terme exact de l’intervalle', () => {
    const langue = anglais({ dernieresPratiques: { conversation: ilYA(7) } });
    const etat = etatVolet(langue, 'conversation', AUJOURDHUI);
    expect(etat.dette).toBe(1);
    expect(etat.du).toBe(true);
  });

  test('un volet jamais pratiqué est dû sans être en retard', () => {
    const langue = anglais({ dernieresPratiques: {} });
    const etat = etatVolet(langue, 'vocabulaire', AUJOURDHUI);
    expect(etat.dette).toBe(1);
    expect(etat.joursDepuis).toBeNull();
  });

  test('la dette est plafonnée quel que soit le retard accumulé', () => {
    const langue = anglais({ dernieresPratiques: { vocabulaire: '2024-01-01' } });
    const etat = etatVolet(langue, 'vocabulaire', AUJOURDHUI);
    expect(etat.dette).toBe(DETTE_MAX);
  });

  test('une date de pratique dans le futur ne produit pas de dette négative', () => {
    const langue = anglais({ dernieresPratiques: { vocabulaire: '2027-01-01' } });
    expect(etatVolet(langue, 'vocabulaire', AUJOURDHUI).dette).toBe(0);
  });

  test('joursEntre renvoie null sur une date illisible', () => {
    expect(joursEntre('hier', AUJOURDHUI)).toBeNull();
    expect(joursEntre(AUJOURDHUI, 'demain')).toBeNull();
  });
});

describe('Priorité', () => {
  test('une dette tout juste due obtient le plancher, une dette plafonnée le sommet', () => {
    expect(prioriteDepuisDette(1)).toBe(PRIORITE_MIN);
    expect(prioriteDepuisDette(DETTE_MAX)).toBe(PRIORITE_MAX);
  });

  test('la priorité reste sous la routine Anki quotidienne', () => {
    // La tâche ANKI est injectée à 95 : une langue ne doit jamais la devancer.
    expect(prioriteDepuisDette(DETTE_MAX)).toBeLessThan(95);
  });

  test('la priorité croît avec la dette', () => {
    expect(prioriteDepuisDette(1.5)).toBeGreaterThan(prioriteDepuisDette(1.1));
  });
});

describe('Choix du volet', () => {
  test('à égalité de dette, le volet au cycle le plus court passe devant', () => {
    const langue = anglais({ dernieresPratiques: {} });
    expect(etatLangue(langue, AUJOURDHUI).propose).toBe('vocabulaire');
  });

  test('le volet le plus en retard passe devant, malgré son cycle plus long', () => {
    const langue = anglais({
      dernieresPratiques: { vocabulaire: ilYA(5), conversation: ilYA(1), grammaire: ilYA(56) },
    });
    expect(etatLangue(langue, AUJOURDHUI).propose).toBe('grammaire');
  });

  test('une seule séance par langue et par jour, tous volets confondus', () => {
    // La conversation faite, le vocabulaire reste dû — mais il attendra demain :
    // enchaîner deux volets le même jour annulerait l'espacement.
    const langue = anglais({
      dernieresPratiques: { vocabulaire: '', conversation: AUJOURDHUI, grammaire: '' },
    });
    const etat = etatLangue(langue, AUJOURDHUI);
    expect(etat.pratiqueAujourdhui).toBe(true);
    expect(etat.propose).toBeNull();
    expect(etat.volets.find(v => v.cle === 'vocabulaire').du).toBe(true);
  });

  test('une langue en pause ne propose rien même en retard', () => {
    const langue = anglais({ actif: false, dernieresPratiques: {} });
    expect(etatLangue(langue, AUJOURDHUI).propose).toBeNull();
  });

  test('un volet sans lien ni deck n’est jamais proposé', () => {
    const langue = anglais({
      grammaire: { lienIA: '', livre: '', dureeMinutes: 30 },
      dernieresPratiques: { vocabulaire: AUJOURDHUI, conversation: AUJOURDHUI, grammaire: '2024-01-01' },
    });
    expect(etatLangue(langue, AUJOURDHUI).propose).toBeNull();
  });

  test('voletExploitable exige la ressource propre à chaque volet', () => {
    const nu = { nom: 'Test' };
    expect(voletExploitable(nu, 'vocabulaire')).toBe(false);
    expect(voletExploitable({ vocabulaire: { deckAnki: 'D' } }, 'vocabulaire')).toBe(true);
    expect(voletExploitable({ vocabulaire: { lienGeneration: 'https://x.test' } }, 'vocabulaire')).toBe(true);
    expect(voletExploitable({ grammaire: { livre: 'a.pdf' } }, 'grammaire')).toBe(true);
    expect(voletExploitable({ conversation: { lienIA: 'https://x.test' } }, 'conversation')).toBe(true);
  });
});

describe('Normalisation', () => {
  test('une langue vide ne fait pas tomber le moteur', () => {
    const l = normaliserLangue(undefined);
    expect(l.cadence).toBe(3);
    expect(l.vocabulaire.deckAnki).toBe('');
    expect(l.actif).toBe(true);
  });

  test('les langues sans nom sont écartées', () => {
    const cfg = { langues: [{ id: 'a', nom: '' }, { id: 'b', nom: 'Espagnol' }, null] };
    expect(chargerLangues(cfg).map(l => l.nom)).toEqual(['Espagnol']);
  });

  test('une configuration sans langues renvoie une liste vide', () => {
    expect(chargerLangues({})).toEqual([]);
    expect(chargerLangues(null)).toEqual([]);
    expect(chargerLangues({ langues: 'anglais' })).toEqual([]);
  });
});

describe('Liens de conversation', () => {
  test('un volet accepte plusieurs adresses nommées', () => {
    const langue = normaliserLangue({
      nom: 'Anglais',
      grammaire: {
        liens: [
          { id: 'a', libelle: 'Temps du passé', url: 'https://exemple.test/1' },
          { id: 'b', libelle: 'Conditionnels', url: 'https://exemple.test/2' },
        ],
      },
    });
    expect(langue.grammaire.liens).toHaveLength(2);
    expect(langue.grammaire.liens[1].libelle).toBe('Conditionnels');
  });

  test('le lien unique des anciennes configurations est repris', () => {
    // Les langues déclarées avant l'ajout des listes ne doivent pas devenir
    // muettes : leur adresse unique devient le premier élément de la liste.
    const langue = normaliserLangue({
      nom: 'Anglais',
      conversation: { lienIA: 'https://exemple.test/fil' },
      vocabulaire: { lienGeneration: 'https://exemple.test/voc' },
    });
    expect(langue.conversation.liens).toEqual([
      { id: 'lien-1', libelle: 'Ma conversation', url: 'https://exemple.test/fil' },
    ]);
    expect(langue.vocabulaire.liens[0].url).toBe('https://exemple.test/voc');
  });

  test('une liste explicite l’emporte sur le lien hérité', () => {
    const langue = normaliserLangue({
      nom: 'Anglais',
      conversation: {
        lienIA: 'https://exemple.test/ancien',
        liens: [{ id: 'a', libelle: 'Nouveau', url: 'https://exemple.test/nouveau' }],
      },
    });
    expect(langue.conversation.liens).toHaveLength(1);
    expect(langue.conversation.liens[0].url).toBe('https://exemple.test/nouveau');
  });

  test('une adresse non http(s) est rejetée par le moteur aussi', () => {
    // Le contrôle du navigateur ne protège pas d'une configuration éditée à la
    // main : un tel lien ne doit pas rendre le volet « exploitable ».
    const langue = normaliserLangue({
      nom: 'Anglais',
      conversation: { liens: [{ id: 'a', libelle: 'Piège', url: 'javascript:alert(1)' }] },
    });
    expect(langue.conversation.liens).toEqual([]);
    expect(voletExploitable(langue, 'conversation')).toBe(false);
  });

  test('un lien sans nom en reçoit un plutôt que d’afficher un bouton vide', () => {
    const langue = normaliserLangue({
      nom: 'Anglais',
      grammaire: { liens: [{ url: 'https://exemple.test/1' }, { url: 'https://exemple.test/2' }] },
    });
    expect(langue.grammaire.liens.map(l => l.libelle)).toEqual(['Conversation 1', 'Conversation 2']);
    expect(langue.grammaire.liens.map(l => l.id)).toEqual(['lien-1', 'lien-2']);
  });

  test('le vocabulaire reste exploitable par son seul deck', () => {
    const langue = normaliserLangue({ nom: 'Anglais', vocabulaire: { deckAnki: 'Anglais::Voc' } });
    expect(voletExploitable(langue, 'vocabulaire')).toBe(true);
  });
});

describe('Repères de niveau', () => {
  test('la langue transporte ses réglages de niveau', () => {
    const langue = normaliserLangue({
      nom: 'Japonais', categorie: 'IV', heuresAcquises: 300, niveauImpose: 'B1',
    });
    expect(langue.categorie).toBe('IV');
    expect(langue.heuresAcquises).toBe(300);
    expect(langue.niveauImpose).toBe('B1');
  });

  test('des réglages absents ou aberrants prennent des valeurs neutres', () => {
    const langue = normaliserLangue({ nom: 'Anglais', heuresAcquises: 'beaucoup' });
    expect(langue.categorie).toBe('');
    expect(langue.heuresAcquises).toBe(0);
    expect(langue.niveauImpose).toBe('');
  });
});

describe('Tâches du jour', () => {
  const cfg = (langues, extra = {}) => ({ langues, ...extra });

  test('une langue due produit une tâche de type LANGUE', () => {
    const taches = tachesLangues(cfg([anglais({ dernieresPratiques: {} })]), AUJOURDHUI, 120);
    expect(taches).toHaveLength(1);
    expect(taches[0]).toMatchObject({
      type: 'LANGUE',
      matiere: 'Anglais',
      titre: 'Vocabulaire',
      volet: 'vocabulaire',
      langueId: 'lang-1',
      dureeMinutes: 20,
    });
  });

  test('aucune tâche quand il ne reste pas de temps', () => {
    expect(tachesLangues(cfg([anglais({ dernieresPratiques: {} })]), AUJOURDHUI, 0)).toEqual([]);
    expect(tachesLangues(cfg([anglais({ dernieresPratiques: {} })]), AUJOURDHUI, -30)).toEqual([]);
  });

  test('une séance plus longue que le temps restant est écartée', () => {
    const taches = tachesLangues(cfg([anglais({ dernieresPratiques: {} })]), AUJOURDHUI, 10);
    expect(taches).toEqual([]);
  });

  test('une langue en pause ne produit rien', () => {
    const taches = tachesLangues(cfg([anglais({ actif: false, dernieresPratiques: {} })]), AUJOURDHUI, 120);
    expect(taches).toEqual([]);
  });

  test('une seule langue par jour par défaut, la plus en retard', () => {
    const espagnol = {
      ...anglais({ dernieresPratiques: { vocabulaire: '2024-01-01' } }),
      id: 'lang-2',
      nom: 'Espagnol',
    };
    const taches = tachesLangues(cfg([anglais({ dernieresPratiques: {} }), espagnol]), AUJOURDHUI, 240);
    expect(taches).toHaveLength(1);
    expect(taches[0].matiere).toBe('Espagnol');
  });

  test('le plafond quotidien est réglable', () => {
    const espagnol = { ...anglais({ dernieresPratiques: {} }), id: 'lang-2', nom: 'Espagnol' };
    const taches = tachesLangues(
      cfg([anglais({ dernieresPratiques: {} }), espagnol], { maxLanguesParJour: 2 }),
      AUJOURDHUI,
      240
    );
    expect(taches.map(t => t.matiere).sort()).toEqual(['Anglais', 'Espagnol']);
  });

  test('un plafond à zéro désactive entièrement le module', () => {
    const taches = tachesLangues(
      cfg([anglais({ dernieresPratiques: {} })], { maxLanguesParJour: 0 }),
      AUJOURDHUI,
      240
    );
    expect(taches).toEqual([]);
  });

  test('la priorité reste sous celle d’un cours en retard', () => {
    const taches = tachesLangues(cfg([anglais({ dernieresPratiques: { vocabulaire: '2024-01-01' } })]), AUJOURDHUI, 120);
    expect(taches[0].prio).toBeLessThan(999); // MAGIC_CONSTANTS.PRIO_MAX_RETARD
    expect(taches[0].priorite).toBeLessThan(95);
  });
});

describe('Séances relevées dans l’historique', () => {
  const historique = [
    { type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', timestamp: `${AUJOURDHUI}T10:00:00.000Z` },
  ];

  test('une séance validée ailleurs remet le compteur du volet à zéro', () => {
    const langue = anglais({ dernieresPratiques: {} });
    const [etat] = etatLangues({ langues: [langue] }, AUJOURDHUI, historique);
    const voc = etat.volets.find(v => v.cle === 'vocabulaire');
    expect(voc.faitAujourdhui).toBe(true);
    expect(etat.propose).not.toBe('vocabulaire');
  });

  test('la tâche ne réapparaît pas le jour même après validation', () => {
    // Tous volets exploitables : c'est bien la règle « une séance par jour »
    // qui doit empêcher le retour d'une tâche, pas l'absence de solution de repli.
    const langue = anglais({ dernieresPratiques: {} });
    expect(tachesLangues({ langues: [langue] }, AUJOURDHUI, 120, historique)).toEqual([]);
  });

  test('un relevé plus récent que la configuration l’emporte', () => {
    const langue = anglais({ dernieresPratiques: { vocabulaire: ilYA(30) } });
    const voc = etatVolet(langue, 'vocabulaire', AUJOURDHUI, dernieresDepuisHistorique(historique));
    expect(voc.joursDepuis).toBe(0);
  });

  test('une séance après minuit est rattachée à la journée qui s’achève', () => {
    const nuit = [{ type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', timestamp: '2026-08-27T01:30:00' }];
    expect(dernieresDepuisHistorique(nuit)['Anglais␟vocabulaire']).toBe('2026-08-26');
  });

  test('les entrées étrangères au module sont ignorées', () => {
    const divers = [
      { type: 'CM', matiere: 'Anglais', titre: 'Vocabulaire', timestamp: `${AUJOURDHUI}T10:00:00` },
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Prononciation', timestamp: `${AUJOURDHUI}T10:00:00` },
      { type: 'LANGUE', titre: 'Vocabulaire', timestamp: `${AUJOURDHUI}T10:00:00` },
    ];
    expect(dernieresDepuisHistorique(divers)).toEqual({});
  });
});

describe('Régularité tenue', () => {
  test('les séances sont comptées en jours, pas en volets', () => {
    const historique = [
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', timestamp: `${AUJOURDHUI}T10:00:00` },
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Grammaire', timestamp: `${AUJOURDHUI}T18:00:00` },
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Conversation', timestamp: `${ilYA(3)}T10:00:00` },
    ];
    const r = regulariteRecente('Anglais', 3, historique, AUJOURDHUI);
    expect(r.tenu).toBe(2);
    expect(r.vise).toBe(13); // 3 séances/semaine sur 30 jours
  });

  test('les séances hors fenêtre ne comptent pas', () => {
    const historique = [
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', timestamp: `${ilYA(90)}T10:00:00` },
    ];
    expect(regulariteRecente('Anglais', 3, historique, AUJOURDHUI).tenu).toBe(0);
  });

  test('une autre langue ne pollue pas le compte', () => {
    const historique = [
      { type: 'LANGUE', matiere: 'Espagnol', titre: 'Vocabulaire', timestamp: `${AUJOURDHUI}T10:00:00` },
    ];
    expect(regulariteRecente('Anglais', 3, historique, AUJOURDHUI).tenu).toBe(0);
  });

  test('un historique absent renvoie un objectif sans séance tenue', () => {
    expect(regulariteRecente('Anglais', 4, null, AUJOURDHUI)).toEqual({ tenu: 0, vise: 17, fenetre: 30 });
  });
});
