import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return {
    default: useStore,
    useChronoStore: Object.assign(() => ({}), { getState: () => ({ startGlobalChrono: vi.fn() }) }),
  };
});

// Composants annexes non testés ici : ils tirent des dépendances lourdes (audio, 3D).
vi.mock('./components/BackgroundMusicPlayer', () => ({ default: () => null }));
vi.mock('./components/GlobalChrono', () => ({ default: () => null }));
vi.mock('./components/Repetiteur', () => ({ default: () => null }));
vi.mock('./GlobalSearchModal', () => ({ default: () => null }));
vi.mock('./components/DisclaimerModal', () => ({ default: () => null }));
vi.mock('./Dashboard', () => ({ default: () => <div>Contenu Accueil</div> }));

const BASE_STORE = {
  config: null,
  loading: false,
  error: null,
  initData: vi.fn(),
  activeTab: 'dashboard',
  setActiveTab: vi.fn(),
  pendingTasksCount: 0,
};

beforeEach(() => {
  storeState = { ...BASE_STORE, setActiveTab: vi.fn(), initData: vi.fn() };
  window.location.hash = '';
  sessionStorage.setItem('elpisDisclaimerShown', 'true');
  // window.close() démonte le document sous jsdom : on observe l'appel sans le subir.
  vi.spyOn(window, 'close').mockImplementation(() => {});
});

describe('App — démarrage', () => {
  it('affiche un squelette pendant le chargement initial', () => {
    storeState.loading = true;
    const { container } = render(<App />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('charge les données au montage', () => {
    render(<App />);
    expect(storeState.initData).toHaveBeenCalled();
  });

  it('rend la page correspondant à l\'onglet actif', () => {
    render(<App />);
    expect(screen.getByText('Contenu Accueil')).toBeInTheDocument();
  });

  it('inscrit l\'onglet actif dans l\'URL', () => {
    render(<App />);
    expect(window.location.hash).toBe('#/dashboard');
  });
});

describe('App — thème selon l\'heure', () => {
  // Repris de src/__tests__/App.test.jsx, qui faisait doublon avec ce fichier.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.className = '';
  });

  const themeAppliqueA = (heure) => {
    vi.setSystemTime(new Date(2026, 6, 3, heure, 0));
    render(<App />);
    return document.documentElement.classList;
  };

  it('applique le thème du matin entre 6 h et 12 h', () => {
    expect(themeAppliqueA(9)).toContain('theme-morning');
  });

  it('applique le thème de l\'après-midi entre 12 h et 18 h', () => {
    expect(themeAppliqueA(14)).toContain('theme-afternoon');
  });

  it('applique le thème du soir entre 18 h et 22 h', () => {
    expect(themeAppliqueA(20)).toContain('theme-evening');
  });

  it('applique le thème de nuit après 22 h', () => {
    expect(themeAppliqueA(23)).toContain('theme-night');
  });
});

describe('App — extinction', () => {
  it('demande confirmation avant d\'éteindre', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Éteindre l'application/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Éteindre ELPIS/i })).toBeInTheDocument();
    // Le message rassure au lieu de répéter le titre : ce qu'on veut savoir
    // avant d'éteindre, c'est si l'on risque de perdre quelque chose.
    expect(screen.getByText(/déjà enregistré/i)).toBeInTheDocument();
  });

  it('renonce à l\'extinction si l\'utilisateur annule', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Éteindre l'application/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/ELPIS est éteint/i)).not.toBeInTheDocument();
  });

  it('affiche l\'écran d\'extinction une fois confirmé', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Éteindre l'application/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Éteindre' }));

    expect(await screen.findByText(/ELPIS est éteint/i)).toBeInTheDocument();
  });
});
