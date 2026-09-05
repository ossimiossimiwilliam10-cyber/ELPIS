import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import ConfigPage from './ConfigPage';
import { DEFAULT_CONFIG } from './constants/defaultConfig';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const addToast = vi.fn();
vi.mock('./ToastProvider', () => ({ useToast: () => ({ addToast }) }));

vi.mock('./database', () => ({
  getDb: vi.fn(async () => ({})),
  syncFromBackend: vi.fn(async () => {}),
}));

// jsdom refuse qu'on espionne `location.reload` : on remplace l'objet entier.
const rechargements = vi.fn();
beforeAll(() => {
  delete window.location;
  window.location = { ...window.location, reload: rechargements, href: 'http://localhost/' };
});

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom n'expose pas l'API Cache : on en pose une, en mémoire.
  const contenu = new Map();
  globalThis.caches = {
    open: async () => ({
      keys: async () => [...contenu.keys()].map(url => ({ url })),
      match: async (r) => contenu.get(typeof r === 'string' ? r : r.url),
      put: async (r, rep) => { contenu.set(typeof r === 'string' ? r : r.url, rep); },
      delete: async (r) => contenu.delete(typeof r === 'string' ? r : r.url),
    }),
    delete: async () => { contenu.clear(); return true; },
  };
  globalThis.Request = class { constructor(url) { this.url = String(url); } };
  globalThis.fetch = vi.fn(async () => ({
    ok: true, status: 200,
    headers: { get: () => '1024' },
    blob: async () => ({ size: 1024 }),
  }));
  storeState = {
    config: { maxSubjectsPerDay: 3, enableTD: true, enableAnnales: true },
    coursConfig: { licences: [{ nom: 'L2', semestres: [] }] },
    setConfig: vi.fn(),
    setCoursConfig: vi.fn(),
    setHistorique: vi.fn(),
    setProjets: vi.fn(),
  };
});

/** Enchaîne les deux confirmations de la remise à zéro. */
const reinitialiser = () => {
  fireEvent.click(screen.getByRole('button', { name: /Tout remettre à zéro|Tout supprimer/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tout supprimer' }));
};

describe('ConfigPage — remise à zéro', () => {
  it('demande deux confirmations', () => {
    render(<ConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Tout remettre à zéro|Tout supprimer/i }));

    expect(within(screen.getByRole('alertdialog')).getByText(/irréversible/i)).toBeInTheDocument();
    expect(storeState.setConfig).not.toHaveBeenCalled();
  });

  it('annonce précisément ce qui sera effacé', () => {
    render(<ConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Tout remettre à zéro|Tout supprimer/i }));

    const message = screen.getByRole('alertdialog').textContent;
    expect(message).toMatch(/cursus/i);
    expect(message).toMatch(/historique/i);
    expect(message).toMatch(/projets/i);
  });

  it('efface aussi l\'historique et les projets', () => {
    // Régression : la « suppression totale » ne touchait que la configuration
    // et le cursus ; toutes les séances passées survivaient.
    render(<ConfigPage />);
    reinitialiser();

    expect(storeState.setCoursConfig).toHaveBeenCalledWith({ licences: [] });
    expect(storeState.setHistorique).toHaveBeenCalledWith([]);
    expect(storeState.setProjets).toHaveBeenCalledWith([]);
  });

  it('restaure une configuration conforme au premier lancement', () => {
    // Régression : cette page recopiait la configuration par défaut avec
    // `enableTD: false` et `enableAnnales: false`, ce qui retirait du planning
    // tous les TD et annales saisis.
    render(<ConfigPage />);
    reinitialiser();

    const restauree = storeState.setConfig.mock.calls[0][0];
    expect(restauree.enableTD).toBe(true);
    expect(restauree.enableAnnales).toBe(true);
    expect(restauree.studyStartDate).toBe('07-09-2026');
  });

  it('renonce si l\'utilisateur annule à la première étape', () => {
    render(<ConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Tout remettre à zéro|Tout supprimer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renonce si l\'utilisateur annule à la seconde étape', () => {
    render(<ConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Tout remettre à zéro|Tout supprimer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
  });
});

describe('ConfigPage — réglages', () => {
  it('affiche la capacité déclarée', () => {
    // La note et le rang visés ont disparu des réglages : ils pilotaient la
    // charge de travail, ce qui produisait une exigence croissant avec
    // l'ambition puis avec le retard accumulé.
    storeState.config = { ...storeState.config, capaciteQuotidienneH: 3 };
    render(<ConfigPage />);
    expect(screen.getByText('3 h / jour')).toBeInTheDocument();
  });

  it('enregistre une nouvelle capacité', () => {
    storeState.config = { ...storeState.config, capaciteQuotidienneH: 3 };
    render(<ConfigPage />);
    fireEvent.change(screen.getByLabelText(/Temps que tu peux réellement donner/), { target: { value: '4' } });
    expect(storeState.setConfig).toHaveBeenCalledWith(expect.objectContaining({ capaciteQuotidienneH: 4 }));
  });

  it('propose les trois régimes de travail', () => {
    render(<ConfigPage />);
    const choix = screen.getByLabelText(/Ce que tu cherches à faire/);
    expect([...choix.options].map(o => o.value)).toEqual(['consolider', 'progresser', 'viser-haut']);
  });

  it('enregistre le régime choisi', () => {
    render(<ConfigPage />);
    fireEvent.change(screen.getByLabelText(/Ce que tu cherches à faire/), { target: { value: 'viser-haut' } });
    expect(storeState.setConfig).toHaveBeenCalledWith(expect.objectContaining({ cap: 'viser-haut' }));
  });

  it('bascule la prise en compte des TD', () => {
    render(<ConfigPage />);
    const cases = screen.getAllByRole('checkbox');
    fireEvent.click(cases[0]);
    expect(storeState.setConfig).toHaveBeenCalled();
  });
});

describe('Configuration par défaut', () => {
  it('active les TD et les annales dès le premier lancement', () => {
    expect(DEFAULT_CONFIG.enableTD).toBe(true);
    expect(DEFAULT_CONFIG.enableAnnales).toBe(true);
  });

  it('vise la date de rentrée', () => {
    expect(DEFAULT_CONFIG.studyStartDate).toBe('07-09-2026');
  });

  it('part d\'un cursus et d\'engagements vides', () => {
    expect(DEFAULT_CONFIG.subjects).toEqual([]);
    expect(DEFAULT_CONFIG.fixedCommitments).toEqual([]);
  });
});

describe('ConfigPage — documents hors ligne', () => {
  /*
   * Les PDF vivent sur le PC et la synchronisation ne transporte que du JSON :
   * le téléphone n'en recevait aucun, et le bouton « Ouvrir le document »
   * n'ouvrait qu'une page vide. Cette carte les recopie sur l'appareil.
   */
  const cursusAvecDocuments = {
    licences: [{
      nom: 'L2',
      semestres: [{
        nom: 'S3',
        ues: [{
          nom: 'UE1',
          matieres: [{
            nom: 'Analyse',
            listeCM: [
              { titre: 'Ch1', pdfPath: '/api/documents/doc-1.pdf' },
              { titre: 'Ch2', pdfPath: '/api/documents/doc-2.pdf' },
            ],
            listeTD: [], listeTP: [], listeAnnales: [],
          }],
        }],
      }],
    }],
  };

  it('annonce combien de documents le cursus référence', async () => {
    storeState.coursConfig = cursusAvecDocuments;
    render(<ConfigPage />);
    expect(await screen.findByText(/2 référencés par ton cursus/i)).toBeInTheDocument();
  });

  it('désactive la copie quand aucun document n’est rattaché', () => {
    render(<ConfigPage />);
    expect(screen.getByRole('button', { name: /Aucun document à copier/i })).toBeDisabled();
  });

  it('copie les documents et le dit', async () => {
    storeState.coursConfig = cursusAvecDocuments;
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole('button', { name: /Copier mes documents ici/i }));

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('2 document(s) copié(s)'), 'success'
      );
    });
  });

  it('signale les documents que le PC n’a pas rendus', async () => {
    // Mieux vaut dire « 1 en échec » que laisser croire à une copie complète.
    storeState.coursConfig = cursusAvecDocuments;
    globalThis.fetch = vi.fn(async (url) => (
      String(url).includes('doc-2')
        ? { ok: false, status: 404 }
        : { ok: true, status: 200, headers: { get: () => '10' }, blob: async () => ({ size: 10 }) }
    ));

    render(<ConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Copier mes documents ici/i }));

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('1 en échec'), 'warning');
    });
  });
});

describe('ConfigPage — le bouton de synchronisation', () => {
  /*
   * Un seul bouton, dont l'état dit la vérité.
   *
   * Le laisser cliquable sans moteur en face donnait quarante-cinq secondes
   * d'attente — trois tentatives de quinze — avant un message d'échec. Un
   * bouton éteint qui explique pourquoi vaut mieux qu'un bouton qui promet.
   */
  it('reste éteint quand le PC ne répond pas, et dit pourquoi', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    storeState.resynchroniser = vi.fn();

    render(<ConfigPage />);

    const bouton = await screen.findByRole('button', { name: /PC non joignable/i });
    await waitFor(() => expect(bouton).toBeDisabled());
    expect(screen.getByText(/ne répond pas/i)).toBeInTheDocument();

    fireEvent.click(bouton);
    expect(storeState.resynchroniser).not.toHaveBeenCalled();
  });

  it('s’allume dès que le moteur répond, et lance la réconciliation', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => '0' },
      blob: async () => ({ size: 0 }),
      json: async () => ({ status: 'ok', db: 'connected', version: '2.0.0' }),
    }));
    storeState.resynchroniser = vi.fn(async () => ({ collections: [], conflits: [], erreurs: [] }));

    render(<ConfigPage />);

    const bouton = await screen.findByRole('button', { name: /^Synchroniser$/i });
    await waitFor(() => expect(bouton).not.toBeDisabled());
    expect(screen.getByText(/Liaison établie/i)).toBeInTheDocument();

    fireEvent.click(bouton);
    await waitFor(() => expect(storeState.resynchroniser).toHaveBeenCalled());
  });

  it('propose de revérifier plutôt que de laisser l’utilisateur attendre', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('coupé'); });
    render(<ConfigPage />);
    expect(await screen.findByRole('button', { name: /Revérifier/i })).toBeInTheDocument();
  });
});
