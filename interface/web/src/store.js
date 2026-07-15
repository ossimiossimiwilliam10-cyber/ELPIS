import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import debounce from 'lodash/debounce';

// API base URL
const API_URL = '/api';

// Fonction utilitaire pour gérer l'échec de la synchronisation (Mode Hors-Ligne)
const handleOfflineError = (type, error) => {
  console.error(`[Hors-Ligne] Failed to auto-save ${type}`, error);
  localStorage.setItem('elpis_offline_pending_sync', 'true');
  // Dispatch a custom event to notify the UI
  window.dispatchEvent(new Event('elpis_offline_status_changed'));
};

// Auto-save functions using debounce
const debouncedSaveConfig = debounce(async (config, get) => {
  if (!navigator.onLine) return handleOfflineError('config', new Error('Offline'));
  try {
    const res = await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('API Error');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    handleOfflineError('config', e);
  }
}, 500);

const debouncedSaveCours = debounce(async (coursConfig, get) => {
  if (!navigator.onLine) return handleOfflineError('cours', new Error('Offline'));
  try {
    const res = await fetch(`${API_URL}/cours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coursConfig)
    });
    if (!res.ok) throw new Error('API Error');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    handleOfflineError('cours', e);
  }
}, 500);

const debouncedSaveHistorique = debounce(async (historique, get) => {
  if (!navigator.onLine) return handleOfflineError('historique', new Error('Offline'));
  try {
    const res = await fetch(`${API_URL}/historique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(historique)
    });
    if (!res.ok) throw new Error('API Error');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    handleOfflineError('historique', e);
  }
}, 500);

const debouncedSaveProjets = debounce(async (projets, get) => {
  if (!navigator.onLine) return handleOfflineError('projets', new Error('Offline'));
  try {
    const res = await fetch(`${API_URL}/projets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projets)
    });
    if (!res.ok) throw new Error('API Error');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    handleOfflineError('projets', e);
  }
}, 500);


const useStore = create(persist(immer((set, get) => ({
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
  fetchOrchestrator: async (params = {}) => {
    const { extraTime = 0, fillGap = false } = params;
    try {
      const res = await fetch(`${API_URL}/orchestrateur?extraTime=${extraTime}&fillGap=${fillGap}`);
      if (res.ok) {
        const data = await res.json();
        set({
          orchestratorData: data,
          intelligence: data.intelligence || null,
          pendingTasksCount: data.tachesDuJour?.length || 0
        });
      }
    } catch (e) {
      console.error("Failed to fetch orchestrator", e);
    }
  },

  // --- CHRONO STATE MOVED TO useChronoStore TO PREVENT RE-RENDERS ---


  updatePendingTasksCount: async () => {
    await get().fetchOrchestrator({ extraTime: 0, fillGap: false });
  },

  // Fetch all initial data
  initData: async () => {
    set({ loading: true, error: null });
    try {
      const [resConfig, resCours, resHist, resProjets] = await Promise.all([
        fetch(`${API_URL}/config`).then(async r => {
          if (!r.ok) throw new Error(`Erreur chargement config (${r.status})`);
          return r.json();
        }),
        fetch(`${API_URL}/cours`).then(async r => {
          if (!r.ok) throw new Error(`Erreur chargement cours (${r.status})`);
          return r.json();
        }),
        fetch(`${API_URL}/historique`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/projets`).then(r => r.ok ? r.json() : [])
      ]);

      set({
        config: resConfig,
        coursConfig: resCours,
        historique: Array.isArray(resHist) ? resHist : [],
        projets: Array.isArray(resProjets) ? resProjets : [],
        loading: false
      });

      // Call streak check immediately after load (passif)
      get().checkStreak(false);
      // Fetch orchestrator data (intelligence + tasks) once after init
      get().fetchOrchestrator();

    } catch (err) {
      set({ error: err?.message || 'Erreur réseau lors du chargement des données.', loading: false });
    }
  },

  // Update config state and trigger auto-save
  setConfig: (newConfig) => {
    // Merge with current state to never lose streak/lastActiveDate
    const merged = { ...get().config, ...newConfig };
    set({ config: merged });
    debouncedSaveConfig(merged, get);
  },

  // Update projets state and save
  setProjets: async (newProjets) => {
    set({ projets: newProjets });
    try {
      const res = await fetch(`${API_URL}/projets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjets)
      });
      if (!res.ok) throw new Error('API Error');
      if (get) get().fetchOrchestrator();
    } catch(e) {
      handleOfflineError('projets sync', e);
    }
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
        await fetch(`${API_URL}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig)
        });
        // Now update pending tasks which will query the orchestrator
        get().fetchOrchestrator();
      } catch (e) {
        console.error("Failed to save rest day", e);
      }
    }
  },

  // Update cours state and trigger auto-save
  setCoursConfig: (newCours) => {
    set({ coursConfig: newCours });
    debouncedSaveCours(newCours, get);
  },

  // Update history state and trigger auto-save
  addHistoriqueEntry: (entry) => {
    const stateBefore = get().intelligence;
    const priorScore = stateBefore?.projectedScoreMap?.[(entry.matiere || '').toLowerCase().trim()] || null;

    const newHist = [...get().historique, { ...entry, timestamp: new Date().toISOString() }];
    set({ historique: newHist });
    debouncedSaveHistorique(newHist, get);
    // Update streak on every completed task (actif)
    get().checkStreak(true);

    // Envoi Télémétrie (Fire and forget)
    fetch('/api/telemetry/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionData: entry,
        aiStateBefore: { projectedScore: priorScore },
        aiStateAfter: { note: "calculé au prochain cycle" }
      })
    }).catch(e => console.error("Erreur télémétrie:", e));
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

})), {
  name: 'elpis-offline-storage',
  partialize: (state) => ({
    config: state.config,
    coursConfig: state.coursConfig,
    projets: state.projets,
    historique: state.historique,
    orchestratorData: state.orchestratorData,
    intelligence: state.intelligence,
  }),
}));

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
    console.error("Erreur restauration chrono:", e);
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

// Initialiser le listener réseau pour la synchronisation
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    window.dispatchEvent(new Event('elpis_offline_status_changed'));
    if (localStorage.getItem('elpis_offline_pending_sync') === 'true') {
      const state = useStore.getState();

      // Forcer la synchronisation de toutes les données locales vers le serveur
      // Since debouncedSave... are debounced, we can just call them.
      // Wait, we need to access the store methods or fetch directly.
      // But debouncedSaveConfig is not exported. We can just do a fetch here.
      try {
        await Promise.all([
          fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.config) }),
          fetch('/api/cours', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.coursConfig) }),
          fetch('/api/historique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.historique) }),
          fetch('/api/projets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.projets) })
        ]);
        localStorage.removeItem('elpis_offline_pending_sync');
      } catch (e) {
        console.error('Offline sync failed again', e);
      }
    }
  });

  window.addEventListener('offline', () => {
    window.dispatchEvent(new Event('elpis_offline_status_changed'));
  });
}
