import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import debounce from 'lodash/debounce';

// API base URL
const API_URL = '/api';

// Auto-save functions using debounce
const debouncedSaveConfig = debounce(async (config, get) => {
  try {
    await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    console.log('Auto-saved config');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    console.error('Failed to auto-save config', e);
  }
}, 500);

const debouncedSaveCours = debounce(async (coursConfig, get) => {
  try {
    await fetch(`${API_URL}/cours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coursConfig)
    });
    console.log('Auto-saved cours');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    console.error('Failed to auto-save cours', e);
  }
}, 500);

const debouncedSaveHistorique = debounce(async (historique, get) => {
  try {
    await fetch(`${API_URL}/historique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(historique)
    });
    console.log('Auto-saved historique');
    if (get) get().fetchOrchestrator();
  } catch (e) {
    console.error('Failed to auto-save historique', e);
  }
}, 500);


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

  // --- ACTIONS ---
  setActiveTab: (tab) => set({ activeTab: tab }),
  setDailyFillGap: (val) => set({ dailyFillGap: val }),

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
      await fetch(`${API_URL}/projets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjets)
      });
    } catch (err) {
      console.error("Erreur de sauvegarde des projets:", err);
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
    const newHist = [...get().historique, { ...entry, timestamp: new Date().toISOString() }];
    set({ historique: newHist });
    debouncedSaveHistorique(newHist, get);
    // Update streak on every completed task (actif)
    get().checkStreak(true);
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

      if (isActivity) {
        if (diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
        newLastActive = today;
        updated = true;
      } else {
        if (diffDays > 1 && streak > 0) {
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

export const useChronoStore = create((set) => ({
  globalChrono: {
    exoId: null,
    titre: null,
    matiereNom: null,
    isRunning: false,
    elapsedSeconds: 0,
    lastTickDate: null
  },
  startGlobalChrono: (exo) => set({
    globalChrono: {
      exoId: exo.id || exo.titre,
      titre: exo.titre,
      matiereNom: exo.matiereNom,
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
    globalChrono: { ...state.globalChrono, isRunning: false, elapsedSeconds: 0, exoId: null, titre: null, matiereNom: null, lastTickDate: null }
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
