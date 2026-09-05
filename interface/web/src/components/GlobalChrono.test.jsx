import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalChrono from './GlobalChrono';

let chronoState;
let storeState;

vi.mock('../store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  const useChronoStore = (selector) => (selector ? selector(chronoState) : chronoState);
  useChronoStore.getState = () => chronoState;
  return { default: useStore, useChronoStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../ToastProvider', () => ({ useToast: () => ({ toast, addToast: vi.fn() }) }));

const chronoActif = (extra = {}) => ({
  isRunning: true, elapsedSeconds: 125, titre: 'TD1', matiereNom: 'Algèbre',
  exoId: 'td1', type: 'TD', ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  chronoState = {
    globalChrono: chronoActif(),
    toggleGlobalChrono: vi.fn(),
    resetGlobalChrono: vi.fn(),
    tickGlobalChrono: vi.fn(),
    setGlobalChronoTime: vi.fn(),
  };
  storeState = {
    addHistoriqueEntry: vi.fn(),
    coursConfig: { licences: [] },
    setCoursConfig: vi.fn(),
    config: {},
    notifyTaskCompleted: vi.fn(),
  };
});

describe('GlobalChrono', () => {
  it('reste invisible sans exercice en cours', () => {
    chronoState.globalChrono = chronoActif({ exoId: null, titre: null });
    const { container } = render(<GlobalChrono />);
    expect(container.textContent).not.toContain('TD1');
  });

  it('apparaît dès qu\'un exercice est chronométré', () => {
    const { container } = render(<GlobalChrono />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('affiche le temps écoulé', () => {
    render(<GlobalChrono />);
    expect(screen.getByText(/02:05|2:05/)).toBeInTheDocument();
  });

  it('met le chronomètre en pause', () => {
    render(<GlobalChrono />);
    fireEvent.click(screen.getByTitle('Mettre en pause'));
    expect(chronoState.toggleGlobalChrono).toHaveBeenCalled();
  });

  it('propose de reprendre une fois en pause', () => {
    chronoState.globalChrono = chronoActif({ isRunning: false });
    render(<GlobalChrono />);
    fireEvent.click(screen.getByTitle('Démarrer'));
    expect(chronoState.toggleGlobalChrono).toHaveBeenCalled();
  });

  it('garde les contrôles secondaires discrets à la souris', () => {
    // Ils n'apparaissent qu'au survol pour ne pas encombrer le chronomètre.
    render(<GlobalChrono />);
    expect(screen.queryByTitle('Réinitialiser')).not.toBeInTheDocument();
  });

  it('remet le chronomètre à zéro', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<GlobalChrono />);
    fireEvent.click(screen.getByTitle('Réinitialiser'));
    expect(chronoState.resetGlobalChrono).toHaveBeenCalled();
  });

  it('montre les contrôles d\'emblée sur écran tactile', () => {
    // Régression : sans survol possible, « Réinitialiser » et « Terminer »
    // restaient inatteignables au doigt sur Android.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<GlobalChrono />);
    expect(screen.getByTitle('Réinitialiser')).toBeInTheDocument();
  });
});
