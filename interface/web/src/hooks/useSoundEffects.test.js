import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSoundEffects } from './useSoundEffects';

describe('useSoundEffects', () => {
  it('should return expected shape', () => {
    const { result } = renderHook(() => useSoundEffects());
    // TODO: Ajouter des assertions sur result.current
    expect(result.current).toBeDefined();
  });
});
