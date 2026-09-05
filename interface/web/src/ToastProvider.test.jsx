import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

/** Composant d'essai déclenchant des notifications à la demande. */
function Declencheur() {
  const { toast, addToast } = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Enregistré')}>succès</button>
      <button onClick={() => toast.error('Échec')}>erreur</button>
      <button onClick={() => toast.info('Information')}>info</button>
      <button onClick={() => toast.warning('Attention')}>avertissement</button>
      <button onClick={() => addToast('Message brut', 'info')}>brut</button>
      <button onClick={() => addToast('Permanent', 'info', 0)}>permanent</button>
    </div>
  );
}

const afficher = () => render(<ToastProvider><Declencheur /></ToastProvider>);
const declencher = (nom) => fireEvent.click(screen.getByRole('button', { name: nom }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ToastProvider', () => {
  it('affiche une notification de succès', () => {
    afficher();
    act(() => declencher('succès'));
    expect(screen.getByText('Enregistré')).toBeInTheDocument();
  });

  it('distingue les types de notification', () => {
    afficher();
    act(() => declencher('erreur'));
    act(() => declencher('avertissement'));

    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(document.querySelector('.toast-error')).toBeInTheDocument();
    expect(document.querySelector('.toast-warning')).toBeInTheDocument();
  });

  it('empile plusieurs notifications', () => {
    afficher();
    act(() => declencher('succès'));
    act(() => declencher('info'));
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
  });

  it('efface la notification après son délai', () => {
    afficher();
    act(() => declencher('info'));
    expect(screen.getByText('Information')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Information')).not.toBeInTheDocument();
  });

  it('laisse les erreurs plus longtemps à l\'écran', () => {
    afficher();
    act(() => declencher('erreur'));

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Échec')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText('Échec')).not.toBeInTheDocument();
  });

  it('conserve une notification de durée nulle', () => {
    afficher();
    act(() => declencher('permanent'));
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText('Permanent')).toBeInTheDocument();
  });

  it('se referme au clic', () => {
    afficher();
    act(() => declencher('succès'));
    act(() => fireEvent.click(screen.getByText('Enregistré')));
    expect(screen.queryByText('Enregistré')).not.toBeInTheDocument();
  });

  it('expose aussi l\'ajout brut', () => {
    afficher();
    act(() => declencher('brut'));
    expect(screen.getByText('Message brut')).toBeInTheDocument();
  });

  it('refuse d\'être utilisé hors de son fournisseur', () => {
    // Une erreur explicite vaut mieux qu'un `undefined` déréférencé plus loin.
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Declencheur />)).toThrow(/ToastProvider/);
    silence.mockRestore();
  });
});
