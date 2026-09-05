import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Repetiteur from './Repetiteur';

let storeState;

vi.mock('../store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../ToastProvider', () => ({ useToast: () => ({ toast, addToast: vi.fn() }) }));

// GET /api/chat renvoie l'historique (un tableau), POST renvoie la réponse.
vi.mock('../utils/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn(async (url, options) => ({
    ok: true,
    json: async () => (options?.method === 'POST'
      ? { content: 'Concentre-toi sur les CM du jour.' }
      : []),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  storeState = {
    config: {},
    coursConfig: { licences: [] },
    historique: [],
    orchestratorData: null,
    intelligence: null,
  };
});

/** Ouvre le panneau du coach. */
const ouvrir = () => {
  render(<Repetiteur />);
  fireEvent.click(screen.getAllByRole('button')[0]);
};

describe('Le Répétiteur', () => {
  it('se réduit à son bouton d\'appel au repos', () => {
    render(<Repetiteur />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('ouvre la conversation au clic', () => {
    ouvrir();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('transmet la question posée', async () => {
    const { fetchWithRetry } = await import('../utils/fetchWithRetry');
    ouvrir();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Par quoi commencer ?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => expect(fetchWithRetry).toHaveBeenCalledWith(
      '/api/chat', expect.objectContaining({ method: 'POST' })
    ));
    const envoi = fetchWithRetry.mock.calls.find(c => c[1]?.method === 'POST');
    expect(envoi[1].body).toContain('Par quoi commencer');
  });

  it('reste ouvert après un envoi', async () => {
    const { fetchWithRetry } = await import('../utils/fetchWithRetry');
    ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Par quoi commencer ?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => expect(fetchWithRetry).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' })));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('vise le serveur déclaré quand l’application tourne sur le téléphone', async () => {
    // Empaquetée par Capacitor, l'application est servie depuis `http://localhost` :
    // une adresse relative y désigne le téléphone lui-même, où rien n'écoute. Le
    // panneau s'ouvrait donc, mais aucune question n'aboutissait.
    const { fetchWithRetry } = await import('../utils/fetchWithRetry');
    localStorage.setItem('serverIp', '192.168.1.42');
    ouvrir();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Où en suis-je ?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => expect(fetchWithRetry).toHaveBeenCalledWith(
      'http://192.168.1.42:3001/api/chat', expect.objectContaining({ method: 'POST' })
    ));
  });

  it('ignore un message vide', async () => {
    const { fetchWithRetry } = await import('../utils/fetchWithRetry');
    ouvrir();

    fetchWithRetry.mockClear();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    // Seul le chargement d'historique a lieu à l'ouverture ; aucun envoi ne suit.
    expect(fetchWithRetry).not.toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }));
  });

  it('reste utilisable si le serveur ne répond pas', async () => {
    const { fetchWithRetry } = await import('../utils/fetchWithRetry');
    fetchWithRetry.mockRejectedValueOnce(new Error('offline'));
    ouvrir();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bonjour' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    // L'échec ne doit pas emporter le panneau.
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });
});
