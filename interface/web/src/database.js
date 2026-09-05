import { getApiUrl } from './utils/apiConfig';
import { fetchWithRetry } from './utils/fetchWithRetry';
import { fusionner, FORMES } from './utils/fusion';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';

// Activer les plugins nécessaires
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);

// --- SCHEMAS ---

const singletonSchema = {
    title: 'singleton schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 10 },
        data: { type: 'object' } // Flexible for config, cours, etc.
    },
    required: ['id', 'data']
};

const historiqueSchema = {
    title: 'historique schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 10 },
        data: { type: 'array', items: { type: 'object' } }
    },
    required: ['id', 'data']
};

const projetsSchema = {
    title: 'projets schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 10 },
        data: { type: 'array', items: { type: 'object' } }
    },
    required: ['id', 'data']
};

// --- INITIALISATION ---

let dbPromise = typeof window !== 'undefined' ? window.__elpisDbPromise || null : null;

export const getDb = async () => {
    if (dbPromise) return dbPromise;
    if (typeof window !== 'undefined' && window.__elpisDbPromise) {
        dbPromise = window.__elpisDbPromise;
        return dbPromise;
    }

    dbPromise = (async () => {
        let isTestEnv = false;
        try { isTestEnv = (process.env.NODE_ENV === 'test'); } catch(e){}
        try { if (!isTestEnv && import.meta.env.MODE === 'test') isTestEnv = true; } catch(e){}
        
        let isDev = false;
        try { isDev = (process.env.NODE_ENV === 'development'); } catch(e){}
        try { if (!isDev && import.meta.env.DEV) isDev = true; } catch(e){}
        try { if (!isDev && typeof window !== 'undefined' && window.location.hostname === 'localhost') isDev = true; } catch(e){}

        const dbName = isTestEnv ? 'elpisdb_test_' + Date.now() + '_' + Math.random().toString().slice(2) : 'elpisdb';
        const db = await createRxDatabase({
            name: dbName,
            storage: isTestEnv ? getRxStorageMemory() : getRxStorageDexie(),
            multiInstance: !isTestEnv,
            ignoreDuplicate: false,
            closeDuplicates: isDev
        });

        await db.addCollections({
            config: { schema: singletonSchema },
            cours: { schema: singletonSchema },
            historique: { schema: historiqueSchema },
            projets: { schema: projetsSchema }
        });

        // Initialize with default empty data if not exists
        const initCollection = async (collection, id, defaultData) => {
            const doc = await collection.findOne(id).exec();
            if (!doc) {
                await collection.insert({ id, data: defaultData });
            }
        };

        await initCollection(db.config, 'main', {});
        await initCollection(db.cours, 'main', { licences: [] });
        await initCollection(db.historique, 'main', []);
        await initCollection(db.projets, 'main', []);

        return db;
    })();

    if (typeof window !== 'undefined') window.__elpisDbPromise = dbPromise;
    return dbPromise;
};

// --- SYNCHRONISATION ---

/**
 * Collections synchronisées, avec leur route et la forme de leurs données.
 *
 * L'ordre compte : l'historique passe en premier parce que c'est la donnée
 * qu'on ne peut pas reconstituer. Si la liaison se coupe en cours de route,
 * c'est elle qui aura été sauvée.
 */
const COLLECTIONS = [
    { nom: 'historique', route: 'historique', forme: FORMES.historique, vide: [] },
    { nom: 'config', route: 'config', forme: FORMES.config, vide: {} },
    { nom: 'cours', route: 'cours', forme: FORMES.cours, vide: { licences: [] } },
    { nom: 'projets', route: 'projets', forme: FORMES.projets, vide: [] },
];

/**
 * Socle : le dernier état sur lequel les deux côtés étaient d'accord.
 *
 * Il vit dans la même collection que les données, sous un autre identifiant.
 * Sans lui, la fusion ne peut pas distinguer « ajouté ici » de « supprimé
 * là-bas » — et c'est faute de cette distinction que la synchronisation
 * écrasait tout.
 */
const lireSocle = async (collection) => {
    const doc = await collection.findOne('base').exec();
    return doc ? doc.data : null;
};

/** Versions de collection connues du serveur, conservées d'une session à l'autre. */
const lireVersions = () => {
    try { return JSON.parse(localStorage.getItem('elpis_versions') || '{}'); }
    catch { return {}; }
};

const ecrireVersion = (nom, version) => {
    if (version === undefined || version === null) return;
    try {
        const versions = lireVersions();
        versions[nom] = Number(version);
        localStorage.setItem('elpis_versions', JSON.stringify(versions));
    } catch (e) {
        console.warn('Version non conservée:', e?.message);
    }
};

/** Identifiant stable de cet appareil, utile pour lire un journal de conflits. */
export const idAppareil = () => {
    try {
        let id = localStorage.getItem('elpis_appareil');
        if (!id) {
            id = (globalThis.crypto?.randomUUID?.() || `app-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
            localStorage.setItem('elpis_appareil', id);
        }
        return id;
    } catch {
        return 'appareil-inconnu';
    }
};

/**
 * Patience accordée au serveur lors d'une réconciliation.
 *
 * Les réglages par défaut — trois tentatives de quinze secondes — visent une
 * API distante. Ici, le serveur est sur le même réseau local : s'il n'a pas
 * répondu en quatre secondes, il est éteint ou hors de portée, et insister
 * quarante-cinq secondes par collection ne fait que retarder le constat.
 */
const PATIENCE_SYNC = { maxRetries: 1, baseDelay: 400, timeout: 4000 };

/** Récupère l'état du serveur et la version sur laquelle il s'appuie. */
const lireDistant = async (route) => {
    const reponse = await fetchWithRetry(`${getApiUrl()}/${route}`, {}, PATIENCE_SYNC);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return {
        data: await reponse.json(),
        version: Number(reponse.headers?.get?.('X-Elpis-Version') ?? NaN),
    };
};

/**
 * Envoie l'état fusionné, en annonçant la version d'où il part.
 *
 * Un refus (409) n'est pas une erreur : il signifie que le serveur a bougé
 * entre la lecture et l'écriture. Il renvoie son état courant, ce qui permet
 * de refusionner immédiatement plutôt que de relire dans une requête de plus
 * — pendant laquelle il pourrait bouger encore.
 */
const ecrireDistant = async (route, etat, version) => {
    const entetes = { 'Content-Type': 'application/json' };
    if (Number.isFinite(version)) entetes['X-Elpis-Version'] = String(version);

    const reponse = await fetchWithRetry(`${getApiUrl()}/${route}`, {
        method: 'POST', headers: entetes, body: JSON.stringify(etat),
    }, PATIENCE_SYNC);

    if (reponse.status === 409) {
        const corps = await reponse.json();
        return { refuse: true, etat: corps.etat, version: corps.versionAttendue };
    }
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const corps = await reponse.json().catch(() => ({}));
    return { refuse: false, version: corps.version };
};

/**
 * Réconcilie une collection avec le serveur.
 *
 * Deux passes au maximum : la seconde sert au cas où le serveur a bougé
 * pendant la première. Au-delà, on renonce pour ce tour — rien n'est perdu,
 * l'état local reste intact et la prochaine synchronisation reprendra.
 */
const synchroniserCollection = async (db, { nom, route, forme, vide }) => {
    const collection = db[nom];
    const docLocal = await collection.findOne('main').exec();
    const local = docLocal ? docLocal.data : vide;
    const base = await lireSocle(collection);

    let distant = await lireDistant(route);
    let journalCumule = null;

    for (let tentative = 0; tentative < 2; tentative += 1) {
        const versionConnue = Number.isFinite(distant.version)
            ? distant.version
            : lireVersions()[nom];

        const { fusion, journal, identiqueAuDistant } = fusionner(
            { base, local, distant: distant.data ?? vide }, forme
        );
        journalCumule = journal;

        await collection.upsert({ id: 'main', data: fusion });

        // Rien à pousser : le serveur a déjà tout ce que nous avons. Le socle
        // devient la fusion, qui est aussi l'état distant.
        if (identiqueAuDistant) {
            await collection.upsert({ id: 'base', data: fusion });
            ecrireVersion(nom, versionConnue);
            return { nom, journal, pousse: false };
        }

        const envoi = await ecrireDistant(route, fusion, versionConnue);

        if (!envoi.refuse) {
            await collection.upsert({ id: 'base', data: fusion });
            ecrireVersion(nom, envoi.version);
            return { nom, journal, pousse: true };
        }

        // Le serveur a changé sous nos pieds : on refusionne à partir de ce
        // qu'il vient de nous rendre, sans requête supplémentaire.
        distant = { data: envoi.etat ?? distant.data, version: envoi.version };
    }

    console.warn(`[sync] ${nom} : le serveur change plus vite que la fusion, on réessaiera.`);
    return { nom, journal: journalCumule, pousse: false, abandonne: true };
};

/**
 * Synchronise toutes les collections et rend le compte rendu des arbitrages.
 *
 * Un échec sur une collection n'empêche pas les autres : perdre le réseau au
 * milieu ne doit pas laisser l'appareil à moitié synchronisé sans que rien ne
 * soit sauvé.
 */
export const synchroniser = async (db) => {
    const bilan = { collections: [], conflits: [], erreurs: [] };

    for (const collection of COLLECTIONS) {
        try {
            const resultat = await synchroniserCollection(db, collection);
            bilan.collections.push(resultat);
            for (const conflit of resultat.journal?.conflits || []) {
                bilan.conflits.push({ collection: collection.nom, ...conflit });
            }
        } catch (e) {
            console.error(`[sync] ${collection.nom} :`, e?.message || e);
            bilan.erreurs.push({ collection: collection.nom, message: e?.message || String(e) });
        }
    }

    if (bilan.conflits.length > 0) {
        // Consigné plutôt que noyé dans la console : l'interface peut le lire.
        try {
            localStorage.setItem('elpis_derniers_conflits', JSON.stringify({
                date: new Date().toISOString(),
                appareil: idAppareil(),
                conflits: bilan.conflits.slice(0, 50),
            }));
        } catch { /* stockage indisponible : le bilan reste en mémoire */ }
    }

    return bilan;
};

/**
 * Enregistre une collection sur le serveur, en annonçant sa version.
 *
 * C'est le chemin qu'empruntent les modifications courantes — valider une
 * tâche, changer un réglage. Sans l'annonce de version, une écriture partie du
 * téléphone effacerait ce que le PC vient d'écrire ; et sans mémoriser la
 * version rendue, la synchronisation suivante se ferait refuser sans raison.
 *
 * Un refus déclenche une fusion, puis une seule nouvelle tentative : c'est
 * exactement le cas « l'autre appareil a écrit pendant que je réfléchissais ».
 */
export const enregistrerCollection = async (nom, data) => {
    const definition = COLLECTIONS.find(c => c.nom === nom);
    if (!definition) throw new Error(`Collection inconnue : ${nom}`);

    const envoi = await ecrireDistant(definition.route, data, lireVersions()[nom]);
    if (!envoi.refuse) {
        ecrireVersion(nom, envoi.version);
        // Ce que le serveur vient d'accepter devient le socle : c'est
        // désormais l'état sur lequel les deux côtés s'accordent.
        const db = await getDb();
        await db[nom].upsert({ id: 'base', data });
        return { ok: true, refusionne: false };
    }

    const db = await getDb();
    await db[nom].upsert({ id: 'main', data });
    const resultat = await synchroniserCollection(db, definition);
    return { ok: !resultat.abandonne, refusionne: true, journal: resultat.journal };
};

/**
 * Ancien nom, conservé le temps que les appels existants basculent.
 * Il ne remplace plus rien : il fusionne.
 */
export const syncFromBackend = synchroniser;
