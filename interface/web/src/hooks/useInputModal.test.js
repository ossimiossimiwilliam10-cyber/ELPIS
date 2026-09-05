import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useInputModal from './useInputModal';

describe('useInputModal', () => {
  it('démarre fermé', () => {
    const { result } = renderHook(() => useInputModal());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.config).toEqual({ title: '', defaultValue: '', placeholder: '' });
  });

  it('ouvre la modale avec la question posée', () => {
    const { result } = renderHook(() => useInputModal());

    act(() => { result.current.prompt('Temps passé ?', '30', 'en minutes'); });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.config).toEqual({ title: 'Temps passé ?', defaultValue: '30', placeholder: 'en minutes' });
  });

  it('résout avec la valeur saisie', async () => {
    const { result } = renderHook(() => useInputModal());

    let promesse;
    act(() => { promesse = result.current.prompt('Temps passé ?'); });
    act(() => { result.current.handleConfirm('45'); });

    await expect(promesse).resolves.toBe('45');
    expect(result.current.isOpen).toBe(false);
  });

  it('résout avec null à l\'annulation', async () => {
    // L'appelant distingue « annulé » (null) de « vide » : ExerciceCard retombe
    // alors sur le temps moyen de l'exercice.
    const { result } = renderHook(() => useInputModal());

    let promesse;
    act(() => { promesse = result.current.prompt('Temps passé ?'); });
    act(() => { result.current.handleCancel(); });

    await expect(promesse).resolves.toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('ne résout qu\'une fois', async () => {
    const { result } = renderHook(() => useInputModal());

    let promesse;
    act(() => { promesse = result.current.prompt('Temps passé ?'); });
    act(() => { result.current.handleConfirm('45'); });
    act(() => { result.current.handleConfirm('99'); });

    await expect(promesse).resolves.toBe('45');
  });

  it('enchaîne deux questions successives', async () => {
    const { result } = renderHook(() => useInputModal());

    let premiere;
    act(() => { premiere = result.current.prompt('Première ?'); });
    act(() => { result.current.handleConfirm('a'); });
    await expect(premiere).resolves.toBe('a');

    let seconde;
    act(() => { seconde = result.current.prompt('Seconde ?'); });
    expect(result.current.config.title).toBe('Seconde ?');
    act(() => { result.current.handleConfirm('b'); });
    await expect(seconde).resolves.toBe('b');
  });
});
