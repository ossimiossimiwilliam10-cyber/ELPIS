import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlanningPage from './PlanningPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const creneau = (extra = {}) => ({
  startMin: 9 * 60, duree: 120, type: 'CM', matiere: 'Algèbre', titre: 'Groupes', ...extra,
});

const semaine = (index, slots = []) => ({
  weekIndex: index,
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-09-${String(14 + i).padStart(2, '0')}`,
    slots: i === 0 ? slots : [],
  })),
});

const repondre = (body, ok = true, status = 200) => {
  global.fetch = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { setActiveTab: vi.fn() };
  repondre({ weeks: [semaine(0, [creneau()]), semaine(1)] });
});

describe('PlanningPage — chargement', () => {
  it('interroge le serveur configuré, pas une adresse figée', async () => {
    // Régression : l'adresse était codée en dur sur localhost, si bien que la
    // page ne pouvait pas fonctionner depuis l'application Android.
    render(<PlanningPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('/orchestrateur/simulation');
    expect(url).not.toContain('localhost:3001');
  });

  it('affiche le calendrier une fois chargé', async () => {
    render(<PlanningPage />);
    expect(await screen.findByText(/Semaine 1 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText('Algèbre')).toBeInTheDocument();
  });

  it('propose de réessayer quand le serveur est muet', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('réseau indisponible'));
    render(<PlanningPage />);

    expect(await screen.findByText(/Calendrier indisponible/i)).toBeInTheDocument();

    repondre({ weeks: [semaine(0)] });
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    expect(await screen.findByText(/Semaine 1/)).toBeInTheDocument();
  });

  it('signale un serveur en erreur', async () => {
    repondre({}, false, 500);
    render(<PlanningPage />);
    expect(await screen.findByText(/500/)).toBeInTheDocument();
  });

  it('renvoie vers la Bibliothèque quand il n\'y a rien à projeter', async () => {
    repondre({ weeks: [] });
    render(<PlanningPage />);

    expect(await screen.findByText(/Rien à planifier/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });
});

describe('PlanningPage — navigation', () => {
  it('passe d\'une semaine à l\'autre', async () => {
    render(<PlanningPage />);
    await screen.findByText(/Semaine 1 \/ 2/);

    fireEvent.click(screen.getByRole('button', { name: /Suiv/i }));
    expect(screen.getByText(/Semaine 2 \/ 2/)).toBeInTheDocument();
  });

  it('borne la navigation aux semaines existantes', async () => {
    render(<PlanningPage />);
    await screen.findByText(/Semaine 1 \/ 2/);

    expect(screen.getByRole('button', { name: /Préc/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Suiv/i }));
    expect(screen.getByRole('button', { name: /Suiv/i })).toBeDisabled();
  });
});

describe('PlanningPage — créneaux', () => {
  it('affiche un créneau hors de la plage habituelle', async () => {
    // Régression : un créneau à 6 h ou après 23 h était escamoté sans un mot.
    repondre({ weeks: [semaine(0, [creneau({ startMin: 5 * 60, titre: 'Révision matinale' })])] });
    render(<PlanningPage />);

    expect(await screen.findByText(/Révision matinale/)).toBeInTheDocument();
  });

  it('affiche un créneau tardif', async () => {
    repondre({ weeks: [semaine(0, [creneau({ startMin: 22 * 60 + 30, duree: 90, titre: 'Nuit blanche' })])] });
    render(<PlanningPage />);

    expect(await screen.findByText(/Nuit blanche/)).toBeInTheDocument();
  });

  it('date les jours dans le fuseau local', async () => {
    // `new Date('2026-09-14')` était lu en UTC et pouvait afficher la veille.
    render(<PlanningPage />);
    await screen.findByText(/Semaine 1/);
    expect(screen.getByText('14/09')).toBeInTheDocument();
  });
});
