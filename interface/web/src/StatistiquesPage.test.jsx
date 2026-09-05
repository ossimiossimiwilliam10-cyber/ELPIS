import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StatistiquesPage from './StatistiquesPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

// Recharts mesure son conteneur, absent sous jsdom : on rend les graphiques inertes.
vi.mock('recharts', async () => {
  const { createElement } = await import('react');
  const Stub = ({ children }) => createElement('div', null, children);
  const noms = [
    'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer',
    'PieChart', 'Pie', 'Cell', 'Legend', 'RadarChart', 'PolarGrid', 'PolarAngleAxis',
    'PolarRadiusAxis', 'Radar', 'LineChart', 'Line',
  ];
  return Object.fromEntries(noms.map(n => [n, Stub]));
});

const entree = (extra = {}) => ({
  timestamp: '2026-09-15T10:00:00.000Z',
  type: 'CM',
  titre: 'Groupes',
  matiere: 'Algèbre',
  dureeMinutes: 60,
  ...extra,
});

/** Texte d'un indicateur de tête, retrouvé par son libellé. */
const indicateur = (libelle) =>
  screen.getByText(libelle).closest('.stats-cle').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0));
  storeState = {
    historique: [entree()],
    coursConfig: { licences: [] },
    intelligence: null,
    initData: vi.fn(),
    setActiveTab: vi.fn(),
  };
  global.URL.createObjectURL = vi.fn(() => 'blob:fictif');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.useRealTimers());

describe('StatistiquesPage — premier lancement', () => {
  it('explique d\'où viendront les données plutôt que d\'afficher des graphiques vides', () => {
    storeState.historique = [];
    render(<StatistiquesPage />);
    expect(screen.getByText(/Pas encore de données/i)).toBeInTheDocument();
  });

  it('renvoie vers la session du jour', () => {
    storeState.historique = [];
    render(<StatistiquesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Session du Jour/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('entrainement');
  });
});

describe('StatistiquesPage — indicateurs', () => {
  it('totalise le temps de la période', () => {
    storeState.historique = [entree({ dureeMinutes: 60 }), entree({ dureeMinutes: 30 })];
    render(<StatistiquesPage />);
    expect(indicateur('Temps travaillé')).toMatch(/1\.5h/);
  });

  it('rapporte la moyenne à l\'ancienneté réelle de l\'historique', () => {
    // Régression : sur « tout l'historique », la moyenne divisait toujours par
    // 90 jours — deux ans d'activité donnaient un chiffre plusieurs fois trop élevé.
    storeState.historique = [
      entree({ timestamp: new Date(2024, 8, 15).toISOString(), dureeMinutes: 600 }),
      entree({ timestamp: new Date(2026, 8, 15).toISOString(), dureeMinutes: 600 }),
    ];
    render(<StatistiquesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }));

    // 1200 min sur ~730 jours ≈ 2 min/jour, et non 13 min.
    expect(indicateur('Moyenne par jour')).toMatch(/[12] min/);
    expect(indicateur('Moyenne par jour')).toMatch(/73\d jours/);
  });

  it('affiche la matière la plus travaillée', () => {
    storeState.historique = [
      entree({ matiere: 'Algèbre', dureeMinutes: 120 }),
      entree({ matiere: 'Analyse', dureeMinutes: 30 }),
    ];
    render(<StatistiquesPage />);
    expect(indicateur('Matière la plus travaillée')).toMatch(/Algèbre/);
  });

  it('mesure la régularité et la série en cours', () => {
    // Le « facteur de facilité SM-2 » affiché ici valait « N/A » en permanence
    // depuis le passage à FSRS ; la régularité, elle, dit quelque chose de vrai.
    const jour = 86400000;
    const maintenant = Date.now();
    storeState.historique = [0, 1, 2].map(i => entree({ timestamp: new Date(maintenant - i * jour).toISOString() }));
    render(<StatistiquesPage />);

    expect(indicateur('Régularité')).toMatch(/10\s*%/);
    expect(indicateur('Régularité')).toMatch(/3 jours d'affilée/);
    expect(screen.queryByText(/SM-2|Ease Factor/i)).not.toBeInTheDocument();
  });
});

describe('StatistiquesPage — période', () => {
  it('laisse les trois choix visibles au lieu de les cacher dans un menu', () => {
    render(<StatistiquesPage />);
    const boutons = screen.getAllByRole('button', { name: /^(7 jours|30 jours|Tout)$/ });
    expect(boutons).toHaveLength(3);
    expect(screen.getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('restreint les séances affichées à la période choisie', () => {
    storeState.historique = [
      entree({ titre: 'Récent' }),
      entree({ titre: 'Ancien', timestamp: new Date(2026, 5, 1).toISOString() }),
    ];
    render(<StatistiquesPage />);
    expect(screen.queryByText('Ancien')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tout' }));
    expect(screen.getByText('Ancien')).toBeInTheDocument();
  });
});

describe('StatistiquesPage — mémoire', () => {
  const avecCartes = (cartes) => ({
    licences: [{ semestres: [{ ues: [{ nom: 'UE A', matieres: [{ nom: 'Algèbre', listeCM: cartes }] }] }] }],
  });

  it('reste absente tant qu\'aucun cours n\'est suivi', () => {
    render(<StatistiquesPage />);
    expect(screen.queryByText('Ta mémoire')).not.toBeInTheDocument();
  });

  it('résume stabilité, rétention et maturité', () => {
    storeState.coursConfig = avecCartes([
      { fsrsCard: { stability: 30 } },
      { fsrsCard: { stability: 10 } },
    ]);
    render(<StatistiquesPage />);

    expect(screen.getByText('Ta mémoire')).toBeInTheDocument();
    expect(indicateur('Stabilité moyenne')).toMatch(/20/);
    expect(indicateur('Rétention actuelle')).toMatch(/100\s*%/);
    expect(screen.getByText('Mature')).toBeInTheDocument();
  });
});

describe('StatistiquesPage — projections', () => {
  it('classe les matières de la meilleure à la plus fragile', () => {
    storeState.coursConfig = {
      licences: [{ semestres: [{ ues: [{ nom: 'UE A', matieres: [{ nom: 'Algèbre' }, { nom: 'Analyse' }] }] }] }],
    };
    storeState.intelligence = {
      projectedScoreMap: { 'algèbre': 16, 'analyse': 8 },
      velocityMap: { 'analyse': { isSlowLearner: true, masteredCMs: 2, totalCMs: 10 } },
    };
    render(<StatistiquesPage />);

    expect(indicateur('Moyenne projetée')).toMatch(/12\.0/);
    const noms = [...document.querySelectorAll('.stats-matiere__nom')].map(n => n.textContent);
    expect(noms).toEqual(['algèbre', 'analyse']);
    expect(screen.getByText(/progression lente/)).toBeInTheDocument();
  });

  it('reste absente tant que l\'orchestrateur n\'a rien projeté', () => {
    render(<StatistiquesPage />);
    expect(screen.queryByText('Tes projections')).not.toBeInTheDocument();
  });
});

describe('StatistiquesPage — export', () => {
  it('exporte l\'historique sans casser les colonnes', () => {
    // Régression : les champs étaient concaténés sans échappement.
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    storeState.historique = [entree({ titre: 'Exercice "difficile", partie 2' })];
    render(<StatistiquesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));
    expect(clic).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/1 entrées/));
    clic.mockRestore();
  });
});

describe('StatistiquesPage — synchronisation Anki', () => {
  it('recharge les données après une synchronisation réussie', async () => {
    // Régression : la page appelait `loadCours`, absent du store — l'écran
    // restait figé sur les données d'avant la synchronisation.
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true, message: 'Fait' }) });
    render(<StatistiquesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Synchroniser Anki/i }));
    await waitFor(() => expect(storeState.initData).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Fait');
  });

  it('signale un échec sans bloquer l\'interface', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: false, error: 'Anki fermé' }) });
    render(<StatistiquesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Synchroniser Anki/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Anki fermé/)));
    expect(storeState.initData).not.toHaveBeenCalled();
  });

  it('signale un serveur injoignable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    render(<StatistiquesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Synchroniser Anki/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/injoignable/i)));
  });
});
