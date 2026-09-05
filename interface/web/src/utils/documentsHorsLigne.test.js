import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cheminsDocuments, cheminsEnCache, etatDocuments, synchroniserDocuments,
  blobDocument, estHorsLigne, viderDocuments, formaterOctets, cacheDisponible, NOM_CACHE,
  poidsAnnonce, placeDisponible,
} from './documentsHorsLigne';

/**
 * jsdom n'expose pas l'API Cache. On en pose une, en mémoire, assez fidèle pour
 * ce que le module en attend : `keys`, `match`, `put`, `delete`, et un
 * `caches.delete` global.
 */
function installerFauxCache() {
  const stores = new Map();

  const faireCache = (nom) => {
    if (!stores.has(nom)) stores.set(nom, new Map());
    const contenu = stores.get(nom);
    return {
      keys: async () => [...contenu.keys()].map(url => ({ url })),
      match: async (requete) => contenu.get(typeof requete === 'string' ? requete : requete.url) || undefined,
      put: async (requete, reponse) => {
        contenu.set(typeof requete === 'string' ? requete : requete.url, reponse);
      },
      delete: async (requete) => contenu.delete(typeof requete === 'string' ? requete : requete.url),
    };
  };

  globalThis.caches = {
    open: async (nom) => faireCache(nom),
    delete: async (nom) => stores.delete(nom),
  };
  return stores;
}

/** Réponse minimale, suffisante pour `blob()` et `headers.get`. */
const reponseFactice = (corps = 'contenu', { taille, ok = true, status = 200 } = {}) => {
  const blob = { size: taille ?? corps.length, type: 'application/pdf' };
  const reponse = {
    ok, status,
    headers: { get: (nom) => (nom === 'content-length' ? String(taille ?? corps.length) : null) },
    blob: async () => blob,
  };
  reponse.clone = () => reponse;
  return reponse;
};

const cursus = (matieres) => ({
  licences: [{ semestres: [{ ues: [{ matieres }] }] }],
});

let stores;

beforeEach(() => {
  stores = installerFauxCache();
  localStorage.clear();
  globalThis.Request = class { constructor(url) { this.url = String(url); } };
});

afterEach(() => {
  delete globalThis.caches;
  delete globalThis.Request;
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('cheminsDocuments', () => {
  it('récolte les documents des matières et de tous leurs contenus', () => {
    const chemins = cheminsDocuments(cursus([{
      nom: 'Analyse',
      pdfPath: '/api/documents/doc-matiere.pdf',
      listeCM: [{ titre: 'Ch1', pdfPaths: ['/api/documents/doc-cm1.pdf', '/api/documents/doc-cm2.pdf'] }],
      listeTD: [{ titre: 'TD1', pdfPath: '/api/documents/doc-td.pdf' }],
      listeTP: [{ titre: 'TP1', pdfPath: '/api/documents/doc-tp.pdf' }],
      listeAnnales: [{ titre: 'A1', pdfPath: '/api/documents/doc-annale.pdf' }],
    }]));
    expect(chemins).toHaveLength(6);
    expect(chemins).toContain('/api/documents/doc-cm2.pdf');
    expect(chemins).toContain('/api/documents/doc-annale.pdf');
  });

  it('ne compte qu’une fois un document partagé par deux cours', () => {
    const partage = '/api/documents/doc-commun.pdf';
    const chemins = cheminsDocuments(cursus([{
      nom: 'Analyse',
      listeCM: [{ titre: 'Ch1', pdfPath: partage }, { titre: 'Ch2', pdfPath: partage }],
    }]));
    expect(chemins).toEqual([partage]);
  });

  it('ignore les valeurs vides et ne casse pas sur un cursus absent', () => {
    expect(cheminsDocuments(null)).toEqual([]);
    expect(cheminsDocuments({})).toEqual([]);
    expect(cheminsDocuments(cursus([{ nom: 'X', pdfPath: '   ', pdfPaths: ['', null] }]))).toEqual([]);
  });
});

describe('synchroniserDocuments', () => {
  it('télécharge ce qui manque', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice('pdf', { taille: 1000 }));
    const bilan = await synchroniserDocuments(['/api/documents/a.pdf', '/api/documents/b.pdf']);

    expect(bilan.telecharges).toBe(2);
    expect(bilan.echecs).toEqual([]);
    expect(await cheminsEnCache()).toHaveLength(2);
  });

  it('ne retélécharge pas ce qui est déjà là', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice());
    await synchroniserDocuments(['/api/documents/a.pdf']);
    globalThis.fetch.mockClear();

    const bilan = await synchroniserDocuments(['/api/documents/a.pdf']);
    expect(bilan.telecharges).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('purge un document que le cursus ne référence plus', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice());
    await synchroniserDocuments(['/api/documents/a.pdf', '/api/documents/vieux.pdf']);

    const bilan = await synchroniserDocuments(['/api/documents/a.pdf']);
    expect(bilan.purges).toBe(1);
    expect(await cheminsEnCache()).toHaveLength(1);
  });

  it('poursuit malgré un document en échec et le signale', async () => {
    // Mieux vaut neuf cours sur dix hors ligne qu'un échec global.
    globalThis.fetch = vi.fn(async (url) => (
      String(url).includes('casse') ? reponseFactice('', { ok: false, status: 404 }) : reponseFactice()
    ));
    const bilan = await synchroniserDocuments([
      '/api/documents/a.pdf', '/api/documents/casse.pdf', '/api/documents/c.pdf',
    ]);

    expect(bilan.telecharges).toBe(2);
    expect(bilan.echecs).toHaveLength(1);
    expect(bilan.echecs[0].chemin).toBe('/api/documents/casse.pdf');
  });

  it('rend compte de sa progression', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice());
    const etapes = [];
    await synchroniserDocuments(['/api/documents/a.pdf', '/api/documents/b.pdf'], {
      onProgress: (e) => etapes.push(`${e.faits}/${e.total}`),
    });
    expect(etapes).toEqual(['1/2', '2/2']);
  });

  it('demande les documents à l’adresse du serveur depuis Android', async () => {
    // Le cœur du problème : un chemin relatif désigne le téléphone lui-même.
    localStorage.setItem('serverIp', '100.84.12.7');
    globalThis.fetch = vi.fn(async () => reponseFactice());
    await synchroniserDocuments(['/api/documents/a.pdf']);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://100.84.12.7:3001/api/documents/a.pdf', expect.anything()
    );
  });
});

describe('lecture des documents', () => {
  it('sert le document depuis le cache sans toucher au réseau', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice('pdf', { taille: 42 }));
    await synchroniserDocuments(['/api/documents/a.pdf']);
    globalThis.fetch.mockClear();

    const blob = await blobDocument('/api/documents/a.pdf');
    expect(blob.size).toBe(42);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(await estHorsLigne('/api/documents/a.pdf')).toBe(true);
  });

  it('se rabat sur le réseau pour un document non téléchargé', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice('pdf', { taille: 7 }));
    const blob = await blobDocument('/api/documents/jamais.pdf');
    expect(blob.size).toBe(7);
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(await estHorsLigne('/api/documents/jamais.pdf')).toBe(false);
  });

  it('renvoie null quand le PC est éteint et le document absent', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('injoignable'); });
    expect(await blobDocument('/api/documents/a.pdf')).toBeNull();
  });
});

describe('état et entretien du cache', () => {
  it('compte les documents et leur poids', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice('pdf', { taille: 500_000 }));
    await synchroniserDocuments(['/api/documents/a.pdf', '/api/documents/b.pdf']);

    const etat = await etatDocuments();
    expect(etat.nombre).toBe(2);
    expect(etat.octets).toBe(1_000_000);
  });

  it('efface toute la copie locale', async () => {
    globalThis.fetch = vi.fn(async () => reponseFactice());
    await synchroniserDocuments(['/api/documents/a.pdf']);
    await viderDocuments();
    expect(stores.has(NOM_CACHE)).toBe(false);
  });

  it('reste inoffensif là où l’API Cache n’existe pas', async () => {
    delete globalThis.caches;
    expect(cacheDisponible()).toBe(false);
    expect(await cheminsEnCache()).toEqual([]);
    expect(await etatDocuments()).toEqual({ nombre: 0, octets: 0, disponible: false });
    expect((await synchroniserDocuments(['/api/documents/a.pdf'])).disponible).toBe(false);
    expect(await estHorsLigne('/api/documents/a.pdf')).toBe(false);
    expect(await viderDocuments()).toBe(false);
  });
});

describe('formaterOctets', () => {
  it('choisit une unité lisible', () => {
    expect(formaterOctets(512)).toBe('512 o');
    expect(formaterOctets(20 * 1024)).toBe('20 Ko');
    expect(formaterOctets(1.5 * 1024 * 1024)).toBe('1,5 Mo');
  });

  it('supporte une valeur absente', () => {
    expect(formaterOctets(undefined)).toBe('0 o');
    expect(formaterOctets(null)).toBe('0 o');
  });
});

describe('poids annoncé et place disponible', () => {
  /*
   * Le cursus réel pèse 673 Mo pour 88 documents, dont certains à 26 Mo.
   * Proposer « copier tes documents » sans ce chiffre revient à faire signer
   * un chèque en blanc, sur une connexion peut-être mobile.
   */
  it('additionne les tailles annoncées par le PC', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ tailles: { 'a.pdf': 1000, 'b.pdf': 2500, 'ailleurs.pdf': 99 } }),
    }));

    const poids = await poidsAnnonce(['/api/documents/a.pdf', '/api/documents/b.pdf']);
    expect(poids.octets).toBe(3500);
    expect(poids.inconnus).toBe(0);
  });

  it('compte les documents dont le PC ignore la taille', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ tailles: { 'a.pdf': 1000 } }) }));
    const poids = await poidsAnnonce(['/api/documents/a.pdf', '/api/documents/disparu.pdf']);
    expect(poids.octets).toBe(1000);
    expect(poids.inconnus).toBe(1);
  });

  it('renonce sans bruit quand le PC ne répond pas', async () => {
    // Ne pas connaître le poids ne doit pas empêcher de copier.
    globalThis.fetch = vi.fn(async () => { throw new Error('injoignable'); });
    expect(await poidsAnnonce(['/api/documents/a.pdf'])).toBeNull();
  });

  it('rend la place disponible quand le navigateur la connaît', async () => {
    globalThis.navigator.storage = { estimate: async () => ({ quota: 10_000, usage: 4_000 }) };
    expect(await placeDisponible()).toEqual({ quota: 10_000, usage: 4_000, libre: 6_000 });
  });

  it('renvoie null là où l’estimation n’existe pas', async () => {
    globalThis.navigator.storage = undefined;
    expect(await placeDisponible()).toBeNull();
  });
});

describe('quota atteint', () => {
  it('s’arrête net et le signale au lieu d’enchaîner les échecs', async () => {
    const quota = new Error('plus de place');
    quota.name = 'QuotaExceededError';
    let appels = 0;
    globalThis.fetch = vi.fn(async () => {
      appels++;
      if (appels >= 2) throw quota;
      return reponseFactice();
    });

    const bilan = await synchroniserDocuments([
      '/api/documents/a.pdf', '/api/documents/b.pdf', '/api/documents/c.pdf',
    ]);

    expect(bilan.quotaAtteint).toBe(true);
    expect(bilan.telecharges).toBe(1);
    expect(appels).toBe(2); // il n'a pas tenté le troisième
  });
});
