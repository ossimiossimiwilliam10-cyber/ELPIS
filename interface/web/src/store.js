/**
 * @typedef {object} ElpisConfig
 * @property {number} [currentStreak]
 * @property {number} [bestStreak]
 * @property {string} [lastActiveDate]
 * @property {string[]} [restDays]
 * @property {string} [bedtime]
 * @property {string} [wakeUpTime]
 * @property {number} [antiEnnuiMultiplier]
 * @property {number} [defaultDurationNewCM]
 * @property {number} [defaultDurationRevCM]
 * @property {number} [defaultDurationTD]
 * @property {number} [defaultDurationTP]
 * @property {number} [defaultDurationAnnales]
 * @property {number} [defaultDurationAnki]
 * @property {number} [maxNewCMPerSubjectPerDay]
 * @property {number} [maxNewCMPerSemesterPerDay]
 * @property {boolean} [enableTD]
 * @property {boolean} [enableAnnales]
 * @property {string} [dernierePratiqueAnki]
 * @property {Array} [absences]
 */

/**
 * @typedef {object} ElpisStore
 * @property {ElpisConfig} config
 * @property {object} coursConfig
 * @property {Array} projets
 * @property {Array} historique
 * @property {boolean} loading
 * @property {string|null} error
 * @property {string} activeTab
 * @property {number} pendingTasksCount
 * @property {boolean} dailyFillGap
 * @property {object|null} orchestratorData
 * @property {object|null} intelligence
 * @property {object} rankingBaseline
 * @property {object|null} forcedTask
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import debounce from 'lodash/debounce';
import { getDb, synchroniser, enregistrerCollection } from './database';
import {
  PILE_VIDE, empiler, annuler as depiler, retablir as repiler,
  peutAnnuler, peutRetablir, prochaineAnnulation,
} from './utils/annulation';

// API base URL
import { getApiUrl } from './utils/apiConfig';
import { estApplicationNative } from './utils/apiConfig';
import { calculerRapportLocal } from './moteur/rapportLocal';
import { fetchWithRetry, fetchFireAndForget } from './utils/fetchWithRetry';
import logger from './utils/logger';

// Fonction utilitaire pour gérer l'échec de la synchronisation (Mode Hors-Ligne)
const handleOfflineError = (type, error) => {
  logger.error(`[Hors-Ligne] Failed to auto-save ${type}`, error);
  localStorage.setItem('elpis_offline_pending_sync', 'true');
  // Dispatch a custom event to notify the UI
  window.dispatchEvent(new Event('elpis_offline_status_changed'));
};

/*
 * Un seul rafraîchissement du rapport, quel que soit le nombre de collections
 * enregistrées.
 *
 * Chaque enregistrement déclenchait le sien. Au démarrage, config, cours,
 * historique et projets partent à 500 ms d’intervalle : quatre requêtes
 * successives, et quatre recalculs complets côté serveur — FSRS, urgences
 * d'examen, charge cognitive, fatigue. Les fusionner à la volée ne suffisait
 * pas, elles ne se chevauchent pas ; il faut les regrouper dans le temps.
 */
const rafraichirRapport = debounce((get) => {
  if (get) get().fetchOrchestrator();
}, 400);

/**
 * Enregistrement différé d'une collection.
 *
 * Les quatre sauvegardes ne différaient que par leur route et leur clé de
 * journal. Les réunir n'est pas qu'une économie de lignes : le passage par
 * `enregistrerCollection` — qui annonce la version et refusionne en cas de
 * refus — devait sinon être répété quatre fois, et c'est précisément le genre
 * de règle qu'on oublie d'appliquer à la quatrième copie.
 */
const enregistrementDiffere = (nom) => debounce(async (data, get) => {
  if (get && get().error) return logger.warn("Sauvegarde annulée : le store n'a pas pu s'initialiser.");
  if (!navigator.onLine) return handleOfflineError(nom, new Error('Hors ligne'));
  try {
    const resultat = await enregistrerCollection(nom, data);
    if (resultat.refusionne) {
      // La fusion réécrit RxDB ; les souscriptions installées par `initData`
      // répercutent le résultat dans le store sans qu'on ait à le relire.
      logger.warn(`[sync] ${nom} : écriture concurrente, fusion appliquée.`);
    }
    rafraichirRapport(get);
  } catch (e) {
    handleOfflineError(nom, e);
  }
}, 500);

/** Requête de rapport en vol, partagée par les appels concurrents identiques. */
let requeteOrchestrateur = null;
let cleOrchestrateur = null;

/**
 * Deux appels rapprochés au même rapport n'en font qu'un.
 *
 * Le chargement en émet deux à moins de cent millisecondes d'écart — la fin de
 * l'initialisation, puis la réconciliation de démarrage — auxquels s'ajoute
 * celui de la page affichée. Ils ne se chevauchent pas toujours, donc le
 * partage de promesse ne suffit pas. Une fenêtre courte les regroupe sans
 * masquer un rafraîchissement voulu : passé ce délai, tout appel repart.
 */
const FENETRE_RAPPORT_MS = 250;
let dernierRapportA = 0;
let dernierRapportCle = null;

const debouncedSaveConfig = enregistrementDiffere('config');

const debouncedSaveCours = enregistrementDiffere('cours');

const debouncedSaveHistorique = enregistrementDiffere('historique');

const debouncedSaveProjets = enregistrementDiffere('projets');

// Helper to write to RxDB
const writeToDb = async (collectionName, data) => {
  try {
    const db = await getDb();
    await db[collectionName].upsert({ id: 'main', data });
  } catch (e) {
    logger.error(`Erreur d'écriture locale (${collectionName}) :`, e);
  }
};

const useStore = create(immer((set, get) => ({
  // --- STATE ---
  config: {},
  coursConfig: { licences: [] },
  projets: [],
  historique: [],
  loading: true,
  error: null,
  activeTab: 'dashboard',
  pendingTasksCount: 0,
  dailyFillGap: false,
  orchestratorData: null,
  intelligence: null,
  rankingBaseline: {
    globalMean: 50.0,
    globalSD: 15.0,
    metrics: {
      academic: { mean: 50.0, sd: 15.0 },
      fsrs: { mean: 60.0, sd: 20.0 },
      workload: { mean: 50.0, sd: 20.0 }
    },
    subjects: {
      'Anglais Lansad - Semestre impair': { mean: 12.0, sd: 2.5 },
      'Algèbre': { mean: 9.0, sd: 3.8 },
      'Analyse': { mean: 8.8, sd: 4.0 },
      'Architecture des systèmes d\'exploitation': { mean: 10.5, sd: 3.5 },
      'Programmation': { mean: 11.0, sd: 3.5 },
      'Électromagnétisme': { mean: 9.0, sd: 3.8 },
      'Introduction aux systèmes électroniques': { mean: 10.2, sd: 3.4 },
      'Mécanique du solide': { mean: 8.8, sd: 3.8 },
      'Construction mécanique': { mean: 10.5, sd: 3.0 },
      'Signal et technologie en santé (Santé)': { mean: 10.0, sd: 3.2 },
      'Aspects médicaux-légaux en santé (Santé)': { mean: 11.5, sd: 2.8 },
      'UE 1.1. Constitution et transformation de la matière': { mean: 8.8, sd: 4.2 },
      'UE 1.2. Les molécules du vivant': { mean: 8.6, sd: 4.1 },
      'UE 1.3. Mathématiques': { mean: 9.5, sd: 3.8 }
    }
  },
  // --- ACTIONS ---
  setActiveTab: (tab) => set({ activeTab: tab }),
  setDailyFillGap: (val) => set({ dailyFillGap: val }),

  // --- FORCED TASK (Ciblage Manuel) ---
  forcedTask: null,
  setForcedTask: (task) => set({ forcedTask: task }),

  // --- ORCHESTRATOR FETCH (global, used by all pages) ---
  /*
   * Une seule requête à la fois pour un même paramétrage.
   *
   * Chaque collection enregistrée déclenche un rafraîchissement du rapport, et
   * il y en a quatre : config, cours, historique, projets. Au démarrage, quatre
   * requêtes identiques partaient donc en quelques millisecondes, et le serveur
   * recalculait quatre fois le même programme — FSRS, urgences d’examen, charge
   * cognitive, fatigue. Les appels concurrents partagent désormais la même
   * promesse ; celui qui arrive pendant qu’un autre vole obtient son résultat
   * sans relancer le calcul.
   */
  fetchOrchestrator: async (params = {}) => {
    const { extraTime = 0, fillGap = false } = params;
    const cle = `${extraTime}|${fillGap}`;
    if (requeteOrchestrateur && cleOrchestrateur === cle) return requeteOrchestrateur;
    if (dernierRapportCle === cle && Date.now() - dernierRapportA < FENETRE_RAPPORT_MS) return;

    /*
     * Sur le téléphone, le programme du jour se calcule ici.
     *
     * L'appareil embarque le moteur — les mêmes fichiers que le PC, alimentés
     * par ses propres documents — et n'a donc plus besoin de demander quoi que
     * ce soit pour savoir quoi réviser. C'était la dernière dépendance qui
     * rendait l'application inutilisable PC éteint.
     *
     * Le PC, lui, garde la voie serveur : elle est éprouvée, elle bénéficie du
     * cache de l'orchestrateur, et surtout elle sait interroger Anki, ce que le
     * navigateur du téléphone ne peut pas faire.
     */
    if (estApplicationNative()) {
      const rapport = calculerRapportLocal({ extraTime, fillGap });
      set({
        orchestratorData: rapport,
        intelligence: rapport.intelligence || null,
        pendingTasksCount: rapport.tachesDuJour?.length || 0,
      });
      dernierRapportA = Date.now();
      dernierRapportCle = cle;
      return rapport;
    }

    cleOrchestrateur = cle;
    requeteOrchestrateur = (async () => {
    try {
      const apiBase = getApiUrl();
      const res = await fetchWithRetry(`${apiBase}/orchestrateur?extraTime=${extraTime}&fillGap=${fillGap}`);
      if (res.ok) {
        const data = await res.json();
        set({
          orchestratorData: data,
          intelligence: data.intelligence || null,
          pendingTasksCount: data.tachesDuJour?.length || 0
        });
      } else {
        // Sans cette trace, un serveur qui répond 500 laissait `orchestratorData`
        // à null et les pages tournaient indéfiniment sur leur écran de chargement.
        logger.error("Orchestrateur : réponse invalide", res.status);
        set({ orchestratorData: { error: `HTTP ${res.status}` } });
      }
    } catch (e) {
      logger.error("Failed to fetch orchestrator", e);
      set({ orchestratorData: { error: e?.message || 'NETWORK_ERROR' } });
    }
    })().finally(() => {
      requeteOrchestrateur = null;
      cleOrchestrateur = null;
      dernierRapportA = Date.now();
      dernierRapportCle = cle;
    });

    return requeteOrchestrateur;
  },

  /**
   * Décompte une tâche du jour qui vient d'être validée.
   *
   * `pendingTasksCount` n'était rafraîchi que par `fetchOrchestrator`. Terminer
   * toutes ses tâches ne déverrouillait donc ni « Avance & Bonus » ni « Projets »
   * et laissait le badge de la barre latérale allumé jusqu'au rechargement complet
   * de l'application. La décompte local prend effet immédiatement ; le prochain
   * rapport de l'orchestrateur fait ensuite autorité.
   */
  notifyTaskCompleted: () => set(state => {
    state.pendingTasksCount = Math.max(0, (state.pendingTasksCount || 0) - 1);
  }),

  // --- CHRONO STATE MOVED TO useChronoStore TO PREVENT RE-RENDERS ---

  updatePendingTasksCount: async () => {
    await get().fetchOrchestrator({ extraTime: 0, fillGap: false });
  },

  /** Compte rendu de la dernière réconciliation, pour que l'interface puisse le dire. */
  dernierBilanSync: null,

  /**
   * Relance une réconciliation avec le serveur.
   *
   * Appelée au retour du réseau et depuis la Configuration. C'est le seul
   * moment où le travail accumulé hors ligne rejoint l'autre appareil, d'où
   * l'intérêt de pouvoir la déclencher soi-même plutôt que d'attendre le
   * prochain démarrage.
   */
  resynchroniser: async () => {
    if (!navigator.onLine) return { collections: [], conflits: [], erreurs: [{ collection: 'reseau', message: 'Hors ligne' }] };
    try {
      const db = await getDb();
      const bilan = await synchroniser(db);
      set(state => { state.dernierBilanSync = bilan; });
      if (bilan.erreurs.length === 0) {
        localStorage.removeItem('elpis_offline_pending_sync');
        window.dispatchEvent(new Event('elpis_offline_status_changed'));
      }
      await get().fetchOrchestrator();
      return bilan;
    } catch (e) {
      logger.error('Réconciliation impossible', e);
      return { collections: [], conflits: [], erreurs: [{ collection: 'sync', message: e?.message || String(e) }] };
    }
  },

  // Fetch all initial data
  initData: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDb();

      // Initialiser l'état depuis RxDB
      const configDoc = await db.config.findOne('main').exec();
      const coursDoc = await db.cours.findOne('main').exec();
      const histDoc = await db.historique.findOne('main').exec();
      const projDoc = await db.projets.findOne('main').exec();

      set(state => {
        state.config = configDoc?.data || {};
        state.coursConfig = coursDoc?.data || { licences: [] };
        state.historique = histDoc?.data || [];
        state.projets = projDoc?.data || [];
        state.loading = false;
      });

      /*
       * La réconciliation part maintenant *après* l'affichage, et sans être
       * attendue.
       *
       * Elle bloquait le premier rendu. Sur un serveur joignable, cela ne se
       * voyait pas ; sur un serveur absent — le cas normal d'un téléphone hors
       * du réseau — chaque collection épuisait ses trois tentatives de quinze
       * secondes, l'une après l'autre, et l'application restait sur son écran
       * de chargement plusieurs minutes avant d'afficher des données qu'elle
       * avait pourtant déjà en local.
       *
       * C'est le principe même d'une application qui fonctionne hors ligne :
       * l'interface s'appuie sur la copie locale, et le réseau ne fait que la
       * rattraper. Les souscriptions RxDB installées juste après répercuteront
       * le résultat de la fusion dès qu'il arrivera.
       */
      if (navigator.onLine) {
        synchroniser(db)
          .then(bilan => {
            if (bilan.conflits.length > 0) {
              logger.warn(`[sync] ${bilan.conflits.length} arbitrage(s) au démarrage.`);
            }
            set(state => { state.dernierBilanSync = bilan; });
            get().fetchOrchestrator();
          })
          .catch(e => logger.error('Réconciliation au démarrage', e));
      }

      // Souscrire aux modifications de RxDB pour mise à jour en temps réel
      // Nettoyer les anciennes souscriptions avant d'en créer de nouvelles
      if (get()._rxSubscriptions) {
        get()._rxSubscriptions.forEach(sub => { try { sub.unsubscribe(); } catch {} });
      }
      const subs = [];
      subs.push(db.config.findOne('main').$.subscribe(doc => {
        if (doc) set(state => { state.config = doc.data; });
      }));
      subs.push(db.cours.findOne('main').$.subscribe(doc => {
        if (doc) set(state => { state.coursConfig = doc.data; });
      }));
      subs.push(db.historique.findOne('main').$.subscribe(doc => {
        if (doc) set(state => { state.historique = doc.data; });
      }));
      subs.push(db.projets.findOne('main').$.subscribe(doc => {
        if (doc) set(state => { state.projets = doc.data; });
      }));
      set(state => { state._rxSubscriptions = subs; });

      // Fetch orchestrator data directly from API
      await get().fetchOrchestrator();
    } catch (error) {
      logger.error('Erreur lors du chargement des données RxDB:', error);
      set({ error: error.message, loading: false });
    }
  },

  // Update config state and trigger auto-save
  /**
   * Pile d'annulation. Voir `utils/annulation.js` pour le raisonnement.
   *
   * Seuls les trois setters passent par elle. La réconciliation, elle, écrit
   * directement dans RxDB : ce que l'autre appareil a fait n'est pas un geste
   * de celui-ci, et pouvoir « annuler » le travail de son PC depuis son
   * téléphone n'aurait aucun sens.
   */
  pileAnnulation: PILE_VIDE,

  /**
   * Applique un état retenu par la pile, sans le réenregistrer.
   *
   * Passer par les setters normaux garantit que l'annulation emprunte
   * exactement le même chemin qu'une modification ordinaire : écriture locale,
   * puis sauvegarde et synchronisation. Une annulation n'est pas un cas
   * particulier — c'est une modification comme une autre, qui se propage à
   * l'autre appareil de la même façon.
   */
  _appliquer: (collection, etat) => {
    const options = { silencieux: true };
    if (collection === 'config') get().setConfig(etat, options);
    else if (collection === 'cours') get().setCoursConfig(etat, options);
    else if (collection === 'projets') get().setProjets(etat, options);
  },

  /** Défait le dernier geste. Rend son libellé, ou null s'il n'y avait rien. */
  annulerDernierGeste: () => {
    const { pile, geste, etat } = depiler(get().pileAnnulation);
    if (!geste) return null;
    set(state => { state.pileAnnulation = pile; });
    get()._appliquer(geste.collection, etat);
    return geste.libelle;
  },

  /** Refait le dernier geste annulé. */
  retablirDernierGeste: () => {
    const { pile, geste, etat } = repiler(get().pileAnnulation);
    if (!geste) return null;
    set(state => { state.pileAnnulation = pile; });
    get()._appliquer(geste.collection, etat);
    return geste.libelle;
  },

  /** Ce que l'interface a besoin de savoir pour proposer l'annulation. */
  etatAnnulation: () => ({
    peutAnnuler: peutAnnuler(get().pileAnnulation),
    peutRetablir: peutRetablir(get().pileAnnulation),
    dernierGeste: prochaineAnnulation(get().pileAnnulation)?.libelle || null,
  }),

  /** Mémorise un geste avant de l'appliquer. `silencieux` en dispense. */
  _memoriser: (collection, avant, apres, libelle, silencieux) => {
    if (silencieux) return;
    set(state => {
      state.pileAnnulation = empiler(state.pileAnnulation, {
        collection, avant, apres, libelle, date: new Date().toISOString(),
      });
    });
  },

  setConfig: (newConfig, options = {}) => {
    get()._memoriser('config', get().config, newConfig, options.libelle || 'Réglage modifié', options.silencieux);
    set(state => {
      state.config = newConfig;
    });
    writeToDb('config', newConfig);
    debouncedSaveConfig(newConfig, get);
  },

  /**
   * Remplace tout l'historique.
   * Nécessaire à la remise à zéro : sans cette action, les séances passées
   * survivaient à la « suppression totale ».
   */
  setHistorique: (newHistorique) => {
    const liste = Array.isArray(newHistorique) ? newHistorique : [];
    set(state => { state.historique = liste; });
    writeToDb('historique', liste);
    debouncedSaveHistorique(liste, get);
  },

  // Update projets state and save
  setProjets: (newProjets, options = {}) => {
    get()._memoriser('projets', get().projets, newProjets, options.libelle || 'Projets modifiés', options.silencieux);
    set(state => { state.projets = newProjets; });
    writeToDb('projets', newProjets);
    debouncedSaveProjets(newProjets, get);
  },

  activateRestDay: async () => {
    const config = get().config;
    if (!config) return;

    const d = new Date();
    d.setHours(d.getHours() - 4);
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let restDays = config.restDays || [];

    // Calculate how many rest days were taken this week (Mon-Sun)
    // Night Owl : la période de grâce de 4h s'applique aussi au calcul du jour de la semaine
    const now = new Date();
    now.setHours(now.getHours() - 4);
    const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0,0,0,0);

    const restDaysThisWeek = restDays.filter(d => {
      const date = new Date(d + 'T00:00:00');
      return date >= startOfWeek;
    }).length;

    if (restDaysThisWeek < 1 && !restDays.includes(todayStr)) {
      // Purge des jours de repos de plus de 30 jours pour éviter la croissance indéfinie
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      restDays = restDays.filter(d => {
        const date = new Date(d + 'T00:00:00');
        return date >= thirtyDaysAgo;
      });
      restDays = [...restDays, todayStr];
      const newConfig = { ...config, restDays };
      set({ config: newConfig });

      // Save directly without debounce to ensure immediate effect before re-fetching
      try {
        const apiBase = getApiUrl();
        await fetchWithRetry(`${apiBase}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig)
        });
        // Now update pending tasks which will query the orchestrator
        get().fetchOrchestrator();
      } catch (e) {
        logger.error("Failed to save rest day", e);
      }
    }
  },

  // Activate extended (2nd) rest day — only accessible via the auto-modal on J+1
  activateExtendedRestDay: async () => {
    const config = get().config;
    if (!config) return;

    const d = new Date();
    d.setHours(d.getHours() - 4);
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let restDays = config.restDays || [];

    if (!restDays.includes(todayStr)) {
      // Purge old rest days (> 30 days)
      const now = new Date();
      now.setHours(now.getHours() - 4);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      restDays = restDays.filter(rd => {
        const date = new Date(rd + 'T00:00:00');
        return date >= thirtyDaysAgo;
      });
      restDays = [...restDays, todayStr];
      const newConfig = { ...config, restDays, restDayExtensionDeclinedDate: null };
      set({ config: newConfig });

      try {
        const apiBase = getApiUrl();
        await fetchWithRetry(`${apiBase}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig)
        });
        get().fetchOrchestrator();
      } catch (e) {
        logger.error("Failed to save extended rest day", e);
      }
    }
  },

  // Decline extended rest day — saves a flag so the modal won't reappear today
  declineExtendedRestDay: async () => {
    const config = get().config;
    if (!config) return;

    const d = new Date();
    d.setHours(d.getHours() - 4);
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    const newConfig = { ...config, restDayExtensionDeclinedDate: todayStr };
    set({ config: newConfig });

    try {
      const apiBase = getApiUrl();
      await fetchWithRetry(`${apiBase}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      logger.error("Failed to save decline flag", e);
    }
  },

  // Helper method for the tree updates
  updateSubjectInTree: (licenceId, semestreId, ueId, subjectName, updateFn) => {
    set(state => {
      const licence = state.coursConfig.licences?.find(l => l.id === licenceId);
      if (!licence) return;
      const semestre = licence.semestres?.find(s => s.id === semestreId);
      if (!semestre) return;
      const ue = semestre.ues?.find(u => u.id === ueId);
      if (!ue) return;
      const matiere = ue.matieres?.find(m => m.nom === subjectName);
      if (!matiere) return;

      updateFn(matiere);
    });
    
    const newCoursConfig = get().coursConfig;
    writeToDb('cours', newCoursConfig);
    debouncedSaveCours(newCoursConfig, get);
  },

  // Update cours state and trigger auto-save
  setCoursConfig: (newCoursConfig, options = {}) => {
    get()._memoriser('cours', get().coursConfig, newCoursConfig, options.libelle || 'Cursus modifié', options.silencieux);
    set(state => { state.coursConfig = newCoursConfig; });
    writeToDb('cours', newCoursConfig);
    debouncedSaveCours(newCoursConfig, get);
  },

  // Update history state and trigger auto-save
  addHistoriqueEntry: (entry) => {
    const newEntry = { ...entry, timestamp: new Date().toISOString() };
    set(state => {
      if (!state.historique) state.historique = [];
      state.historique.push(newEntry);
    });
    
    const newHist = get().historique;
    writeToDb('historique', newHist);
    debouncedSaveHistorique(newHist, get);
    
    // Update streak on every completed task (actif)
    get().checkStreak(true);

    // [Epic 2] - Background Telemetry
    const apiBase = getApiUrl();
    fetchFireAndForget(`${apiBase}/ai/historique-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionData: entry,
        aiStateAfter: { note: "calculé au prochain cycle" }
      })
    });
  },

  // Check and update streak logic
  checkStreak: (isActivity = false) => {
    const config = get().config;
    if (!config || Object.keys(config).length === 0) return; // Guard against empty config

    // Use local date to avoid UTC timezone shift near midnight
    const d = new Date();
    // Période de grâce (Night Owl) : 4 heures. Si on révise à 3h du matin, c'est compté pour la veille.
    d.setHours(d.getHours() - 4);
    const today = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    let streak = Number.isFinite(config.currentStreak) ? config.currentStreak : 0;
    let lastActive = config.lastActiveDate || "";
    let bestStreak = Number.isFinite(config.bestStreak) ? config.bestStreak : 0;

    let updated = false;
    let newLastActive = lastActive;

    if (lastActive !== today) {
      let diffDays = 999;
      if (lastActive) {
        const [ly, lm, ld] = lastActive.split('-').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
        const todayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      }

      let hasBrokenStreak = false;
      if (diffDays > 1) {
        const restDays = config.restDays || [];
        for (let i = 1; i < diffDays; i++) {
          const missingDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          missingDate.setDate(missingDate.getDate() - i);
          const missingDateStr = missingDate.getFullYear() + '-' +
            String(missingDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(missingDate.getDate()).padStart(2, '0');
          if (!restDays.includes(missingDateStr)) {
            hasBrokenStreak = true;
            break;
          }
        }
      }

      if (isActivity) {
        if (!hasBrokenStreak || diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
        newLastActive = today;
        updated = true;
      } else {
        if (hasBrokenStreak && streak > 0) {
          streak = 0;
          updated = true;
        }
      }
    }

    if (streak > bestStreak) {
      bestStreak = streak;
      updated = true;
    }

    if (updated) {
      const newConfig = { ...config, lastActiveDate: newLastActive, currentStreak: streak, bestStreak };
      set({ config: newConfig });
      debouncedSaveConfig(newConfig, get);
    }
  }

})));

export default useStore;

// --- Helper: restore chrono from sessionStorage ---
const CHRONO_STORAGE_KEY = 'elpis_chrono_state';

const getPersistedChrono = () => {
  try {
    const raw = sessionStorage.getItem(CHRONO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Si le chrono était en cours, recalculer le temps écoulé depuis la dernière sauvegarde
      if (parsed.isRunning && parsed.lastTickDate) {
        const now = Date.now();
        const diffSeconds = Math.floor((now - parsed.lastTickDate) / 1000);
        if (diffSeconds > 0) {
          parsed.elapsedSeconds = (parsed.elapsedSeconds || 0) + diffSeconds;
          parsed.lastTickDate = parsed.lastTickDate + (diffSeconds * 1000);
        }
      }
      return parsed;
    }
  } catch (e) {
    logger.error("Erreur restauration chrono:", e);
  }
  return null;
};

const defaultChrono = {
  exoId: null,
  titre: null,
  matiereNom: null,
  type: null,
  isRunning: false,
  elapsedSeconds: 0,
  lastTickDate: null
};

export const useChronoStore = create((set) => ({
  globalChrono: getPersistedChrono() || defaultChrono,
  startGlobalChrono: (exo) => set({
    globalChrono: {
      exoId: exo.id || exo.titre,
      titre: exo.titre,
      matiereNom: exo.matiereNom,
      type: exo.type || (exo.titre?.includes('Projet') ? 'Projet' : 'Exercice'),
      isRunning: true,
      elapsedSeconds: 0,
      lastTickDate: Date.now()
    }
  }),
  toggleGlobalChrono: () => set(state => {
    const isRunning = !state.globalChrono.isRunning;
    return {
      globalChrono: {
        ...state.globalChrono,
        isRunning,
        lastTickDate: isRunning ? Date.now() : null
      }
    };
  }),
  resetGlobalChrono: () => set(state => ({
    globalChrono: { ...state.globalChrono, isRunning: false, elapsedSeconds: 0, exoId: null, titre: null, matiereNom: null, type: null, lastTickDate: null }
  })),
  tickGlobalChrono: () => set(state => {
    if (state.globalChrono.isRunning && state.globalChrono.lastTickDate) {
      const now = Date.now();
      const diffSeconds = Math.floor((now - state.globalChrono.lastTickDate) / 1000);
      if (diffSeconds > 0) {
        return {
          globalChrono: {
            ...state.globalChrono,
            elapsedSeconds: state.globalChrono.elapsedSeconds + diffSeconds,
            lastTickDate: state.globalChrono.lastTickDate + (diffSeconds * 1000)
          }
        };
      }
    }
    return state;
  }),
  setGlobalChronoTime: (seconds) => set(state => ({
    globalChrono: {
      ...state.globalChrono,
      elapsedSeconds: seconds
    }
  }))
}));

// Persist chrono state to sessionStorage on every change
useChronoStore.subscribe((state) => {
  try {
    sessionStorage.setItem(CHRONO_STORAGE_KEY, JSON.stringify(state.globalChrono));
  } catch (e) {
    // sessionStorage plein ou indisponible, on ignore silencieusement
  }
});

/**
 * Retour du réseau : on réconcilie, on n'impose pas.
 *
 * Ce point renvoyait les quatre collections de l'appareil au serveur, en bloc.
 * Sur un poste unique, cela réparait une sauvegarde manquée ; avec un second
 * appareil, cela effaçait purement et simplement le travail fait ailleurs
 * pendant la coupure — le trajet en train écrasant la matinée au bureau, ou
 * l'inverse. La réconciliation garde les deux.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    window.dispatchEvent(new Event('elpis_offline_status_changed'));
    const bilan = await useStore.getState().resynchroniser();
    if (bilan?.conflits?.length) {
      logger.warn(`[sync] retour en ligne : ${bilan.conflits.length} arbitrage(s).`);
    }
  });

  window.addEventListener('offline', () => {
    window.dispatchEvent(new Event('elpis_offline_status_changed'));
  });
}