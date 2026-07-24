import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkloadEngine } from './useWorkloadEngine';

describe('useWorkloadEngine', () => {
  it('should return expected shape', () => {
    const { result } = renderHook(() => useWorkloadEngine());
    // TODO: Ajouter des assertions sur result.current
    expect(result.current).toBeDefined();
  });
});
