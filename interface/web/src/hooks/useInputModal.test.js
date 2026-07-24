import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputModal } from './useInputModal';

describe('useInputModal', () => {
  it('should return expected shape', () => {
    const { result } = renderHook(() => useInputModal());
    // TODO: Ajouter des assertions sur result.current
    expect(result.current).toBeDefined();
  });
});
