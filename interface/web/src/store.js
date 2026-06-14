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
}, 2000);

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
}, 2000);

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
}, 2000);


const useStore = create((set, get) => ({
  // --- STATE ---
  config: null,
  coursConfig: null,
  historique: [],
  loading: true,
  error: null,
  activeTab: 'dashboard',

  // --- ACTIONS ---
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Fetch all initial data
  initData: async () => {
    set({ loading: true, error: null });
    try {
      const [resConfig, resCours, resHist] = await Promise.all([
        fetch(`${API_URL}/config`).then(r => r.json()),
        fetch(`${API_URL}/cours`).then(r => r.json()),
        fetch(`${API_URL}/historique`).then(r => r.ok ? r.json() : []) // Not yet implemented on backend, fallback to []
      ]);

      set({ 
        config: resConfig, 
        coursConfig: resCours, 
        historique: Array.isArray(resHist) ? resHist : [],
        loading: false 
      });

      // Call streak check immediately after load
      get().checkStreak();

    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Update config state and trigger auto-save
  setConfig: (newConfig) => {
    set({ config: newConfig });
    debouncedSaveConfig(newConfig);
  },

  // Update cours state and trigger auto-save
  setCoursConfig: (newCours) => {
    set({ coursConfig: newCours });
    debouncedSaveCours(newCours);
  },

  // Update history state and trigger auto-save
  addHistoriqueEntry: (entry) => {
    const newHist = [...get().historique, { ...entry, timestamp: new Date().toISOString() }];
    set({ historique: newHist });
    debouncedSaveHistorique(newHist);
  },

  // Check and update streak logic
  checkStreak: () => {
    const config = get().config;
    if (!config) return;

    // Use local date to avoid UTC timezone shift near midnight
    const d = new Date();
    const today = d.getFullYear() + '-' + 
      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
      String(d.getDate()).padStart(2, '0');
    let streak = config.currentStreak || 0;
    let lastActive = config.lastActiveDate || "";

    if (lastActive !== today) {
      if (lastActive) {
        const [ly, lm, ld] = lastActive.split('-').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
        const todayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffTime = Math.abs(todayDate - lastDate);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      
      const newConfig = { ...config, lastActiveDate: today, currentStreak: streak };
      set({ config: newConfig });
      debouncedSaveConfig(newConfig);
    }
  }

}));

export default useStore;
