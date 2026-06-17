import { create } from 'zustand';
import debounce from 'lodash/debounce';

// API base URL
const API_URL = '/api';

// Auto-save functions using debounce
const debouncedSaveConfig = debounce(async (config) => {
  try {
    await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    console.log('Auto-saved config');
  } catch (e) {
    console.error('Failed to auto-save config', e);
  }
}, 500);

const debouncedSaveCours = debounce(async (coursConfig) => {
  try {
    await fetch(`${API_URL}/cours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coursConfig)
    });
    console.log('Auto-saved cours');
  } catch (e) {
    console.error('Failed to auto-save cours', e);
  }
}, 500);

const debouncedSaveHistorique = debounce(async (historique) => {
  try {
    await fetch(`${API_URL}/historique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(historique)
    });
    console.log('Auto-saved historique');
  } catch (e) {
    console.error('Failed to auto-save historique', e);
  }
}, 500);


const useStore = create((set, get) => ({
  // --- STATE ---
  config: null,
  coursConfig: null,
  historique: [],
  loading: true,
  error: null,
  activeTab: 'dashboard',
  pendingTasksCount: 0,

  // --- ACTIONS ---
  setActiveTab: (tab) => set({ activeTab: tab }),

  // --- CHRONO STATE ---
  globalChrono: {
    exoId: null, // Identifiant de l'exercice (titre ou id)
    titre: null,
    matiereNom: null,
    isRunning: false,
    elapsedSeconds: 0,
  },

  startGlobalChrono: (exo) => set({
    globalChrono: {
      exoId: exo.id || exo.titre, // fallback sur le titre si id n'existe pas
      titre: exo.titre,
      matiereNom: exo.matiereNom,
      isRunning: true,
      elapsedSeconds: 0
    }
  }),
  toggleGlobalChrono: () => set(state => ({
    globalChrono: { ...state.globalChrono, isRunning: !state.globalChrono.isRunning }
  })),
  resetGlobalChrono: () => set(state => ({
    globalChrono: { ...state.globalChrono, isRunning: false, elapsedSeconds: 0, exoId: null, titre: null, matiereNom: null }
  })),
  tickGlobalChrono: () => set(state => {
    if (state.globalChrono.isRunning) {
      return { globalChrono: { ...state.globalChrono, elapsedSeconds: state.globalChrono.elapsedSeconds + 1 } };
    }
    return state;
  }),


  updatePendingTasksCount: async () => {
    try {
      const res = await fetch(`${API_URL}/orchestrateur?extraTime=0`);
      if (res.ok) {
        const data = await res.json();
        set({ pendingTasksCount: data.tachesDuJour?.length || 0 });
      }
    } catch (e) {
      console.error("Failed to update pending tasks count", e);
    }
  },
  
  // Fetch all initial data
  initData: async () => {
    set({ loading: true, error: null });
    try {
      const [resConfig, resCours, resHist] = await Promise.all([
        fetch(`${API_URL}/config`).then(async r => {
          if (!r.ok) throw new Error(`Erreur chargement config (${r.status})`);
          return r.json();
        }),
        fetch(`${API_URL}/cours`).then(async r => {
          if (!r.ok) throw new Error(`Erreur chargement cours (${r.status})`);
          return r.json();
        }),
        fetch(`${API_URL}/historique`).then(r => r.ok ? r.json() : [])
      ]);

      set({ 
        config: resConfig, 
        coursConfig: resCours, 
        historique: Array.isArray(resHist) ? resHist : [],
        loading: false 
      });

      // Call streak check immediately after load
      get().checkStreak();
      // Fetch accurate pending tasks count
      get().updatePendingTasksCount();

    } catch (err) {
      set({ error: err?.message || 'Erreur réseau lors du chargement des données.', loading: false });
    }
  },

  // Update config state and trigger auto-save
  setConfig: (newConfig) => {
    // Merge with current state to never lose streak/lastActiveDate
    const merged = { ...get().config, ...newConfig };
    set({ config: merged });
    debouncedSaveConfig(merged);
  },

  // Update cours state and trigger auto-save
  setCoursConfig: (newCours) => {
    set({ coursConfig: newCours });
    debouncedSaveCours(newCours);
    // Refresh pending count since cours data changed
    get().updatePendingTasksCount();
  },

  // Update history state and trigger auto-save
  addHistoriqueEntry: (entry) => {
    const newHist = [...get().historique, { ...entry, timestamp: new Date().toISOString() }];
    set({ historique: newHist });
    debouncedSaveHistorique(newHist);
    // Update streak on every completed task
    get().checkStreak();
  },

  // Check and update streak logic
  checkStreak: () => {
    const config = get().config;
    if (!config) return;

    // Use local date to avoid UTC timezone shift near midnight
    const d = new Date();
    // Période de grâce (Night Owl) : 4 heures. Si on révise à 3h du matin, c'est compté pour la veille.
    d.setHours(d.getHours() - 4);
    const today = d.getFullYear() + '-' + 
      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
      String(d.getDate()).padStart(2, '0');
    let streak = config.currentStreak || 0;
    let lastActive = config.lastActiveDate || "";
    let bestStreak = config.bestStreak || 0;

    let updated = false;

    if (lastActive !== today) {
      if (lastActive) {
        const [ly, lm, ld] = lastActive.split('-').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
        const todayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffTime = todayDate - lastDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      updated = true;
    }

    if (streak > bestStreak) {
      bestStreak = streak;
      updated = true;
    }

    if (updated) {
      const newConfig = { ...config, lastActiveDate: today, currentStreak: streak, bestStreak };
      set({ config: newConfig });
      debouncedSaveConfig(newConfig);
    }
  }

}));

export default useStore;
