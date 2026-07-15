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

export const syncFromBackend = async (db) => {
    try {
        const [confRes, coursRes, histRes, projRes] = await Promise.all([
            fetch('/api/config'),
            fetch('/api/cours'),
            fetch('/api/historique'),
            fetch('/api/projets')
        ]);

        if (confRes.ok) {
            const data = await confRes.json();
            await db.config.upsert({ id: 'main', data });
        }
        if (coursRes.ok) {
            const data = await coursRes.json();
            await db.cours.upsert({ id: 'main', data });
        }
        if (histRes.ok) {
            const data = await histRes.json();
            await db.historique.upsert({ id: 'main', data });
        }
        if (projRes.ok) {
            const data = await projRes.json();
            await db.projets.upsert({ id: 'main', data });
        }
    } catch (e) {
        console.error("Erreur de synchronisation depuis le backend:", e);
    }
};
