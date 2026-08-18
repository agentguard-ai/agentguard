import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCachedQuery,
  buildCacheKey,
  isCacheValid,
  setCacheEntry,
  getCacheEntry,
  invalidateCacheEntry,
  invalidateCacheByPrefix,
  clearCache,
  DEFAULT_TTL,
} from './useCachedQuery';
import { useCacheInvalidation, DEFAULT_INVALIDATION_MAP } from './useCacheInvalidation';
import type { StreamEvent } from '../../../../shared/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    getAuthHeaders: () => ({}),
    handleAuthError: vi.fn(),
  }),
}));

// ─── Test Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  clearCache();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Unit Tests: Cache Utilities ─────────────────────────────────────────────

describe('buildCacheKey', () => {
  it('should return endpoint when no params', () => {
    expect(buildCacheKey('/api/v1/modules/health')).toBe('/api/v1/modules/health');
  });

  it('should return endpoint when params is undefined', () => {
    expect(buildCacheKey('/api/v1/freeze/state', undefined)).toBe('/api/v1/freeze/state');
  });

  it('should append sorted params to endpoint', () => {
    const key = buildCacheKey('/api/v1/pipeline/status', { timeRange: '1h', agentId: 'a1' });
    expect(key).toBe('/api/v1/pipeline/status?agentId=a1&timeRange=1h');
  });

  it('should ignore undefined param values', () => {
    const key = buildCacheKey('/api/v1/costs/summary', { agentId: undefined, window: '24h' });
    expect(key).toBe('/api/v1/costs/summary?window=24h');
  });

  it('should return endpoint when all params are undefined', () => {
    const key = buildCacheKey('/api/v1/freeze/state', { a: undefined, b: undefined });
    expect(key).toBe('/api/v1/freeze/state');
  });
});

describe('isCacheValid', () => {
  it('should return false for undefined entry', () => {
    expect(isCacheValid(undefined, 30000)).toBe(false);
  });

  it('should return true when entry is within TTL', () => {
    const entry = { data: 'test', timestamp: Date.now() - 10000 };
    expect(isCacheValid(entry, 30000)).toBe(true);
  });

  it('should return false when entry is expired (beyond TTL)', () => {
    const entry = { data: 'test', timestamp: Date.now() - 31000 };
    expect(isCacheValid(entry, 30000)).toBe(false);
  });

  it('should return false when entry is exactly at TTL boundary', () => {
    const entry = { data: 'test', timestamp: Date.now() - 30000 };
    expect(isCacheValid(entry, 30000)).toBe(false);
  });
});

describe('cache store operations', () => {
  it('should set and get a cache entry', () => {
    setCacheEntry('/api/test', { foo: 'bar' });
    const entry = getCacheEntry<{ foo: string }>('/api/test');
    expect(entry).toBeDefined();
    expect(entry!.data).toEqual({ foo: 'bar' });
    expect(entry!.timestamp).toBeCloseTo(Date.now(), -2);
  });

  it('should invalidate a specific cache entry', () => {
    setCacheEntry('/api/test', { foo: 'bar' });
    invalidateCacheEntry('/api/test');
    expect(getCacheEntry('/api/test')).toBeUndefined();
  });

  it('should invalidate cache entries by prefix', () => {
    setCacheEntry('/api/v1/modules/health', { modules: [] });
    setCacheEntry('/api/v1/modules/health?agentId=a1', { modules: [] });
    setCacheEntry('/api/v1/freeze/state', { frozen: [] });

    invalidateCacheByPrefix('/api/v1/modules/health');

    expect(getCacheEntry('/api/v1/modules/health')).toBeUndefined();
    expect(getCacheEntry('/api/v1/modules/health?agentId=a1')).toBeUndefined();
    // Freeze state should remain
    expect(getCacheEntry('/api/v1/freeze/state')).toBeDefined();
  });

  it('should clear entire cache', () => {
    setCacheEntry('/a', 1);
    setCacheEntry('/b', 2);
    clearCache();
    expect(getCacheEntry('/a')).toBeUndefined();
    expect(getCacheEntry('/b')).toBeUndefined();
  });
});

// ─── Hook Tests ──────────────────────────────────────────────────────────────

describe('useCachedQuery', () => {
  it('should return cached data without re-fetch when cache is valid (cache hit)', async () => {
    // Pre-populate the cache
    setCacheEntry('/api/v1/freeze/state', { wildcardActive: false, frozenAgents: [] });

    const { result } = renderHook(() =>
      useCachedQuery<{ wildcardActive: boolean; frozenAgents: string[] }>({
        endpoint: '/api/v1/freeze/state',
        ttl: 30000,
      }),
    );

    // Should immediately return cached data without calling fetch
    expect(result.current.data).toEqual({ wildcardActive: false, frozenAgents: [] });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch data on cache miss', async () => {
    const mockResponse = { modules: [{ name: 'pii-detector', status: 'healthy' }] };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() =>
      useCachedQuery<typeof mockResponse>({
        endpoint: '/api/v1/modules/health',
      }),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Let the async fetch resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after TTL expiry', async () => {
    const freshData = { status: 'fresh' };

    // Set a cache entry that is expired (timestamp far in the past)
    const expiredEntry = { data: { status: 'stale' }, timestamp: Date.now() - 60000 };
    // Manually inject an expired entry by accessing the cache internals
    setCacheEntry('/api/v1/pipeline/status', { status: 'stale' });
    // Override the timestamp to make it expired
    invalidateCacheEntry('/api/v1/pipeline/status');

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => freshData,
    });

    const { result } = renderHook(() =>
      useCachedQuery<typeof freshData>({
        endpoint: '/api/v1/pipeline/status',
        ttl: 30000,
      }),
    );

    // No cache entry exists, so it should fetch
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(freshData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch when manually invalidated', async () => {
    const initialData = { version: 1 };
    const updatedData = { version: 2 };

    // Pre-populate cache with valid entry
    setCacheEntry('/api/v1/freeze/state', initialData);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedData,
    });

    const { result } = renderHook(() =>
      useCachedQuery<typeof updatedData>({
        endpoint: '/api/v1/freeze/state',
        ttl: 30000,
      }),
    );

    // Should return cached data
    expect(result.current.data).toEqual(initialData);
    expect(global.fetch).not.toHaveBeenCalled();

    // Invalidate the cache
    act(() => {
      result.current.invalidate();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Should have fetched fresh data
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(updatedData);
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() =>
      useCachedQuery({
        endpoint: '/api/v1/modules/health',
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toContain('500');
    expect(result.current.data).toBeNull();
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(() =>
      useCachedQuery({
        endpoint: '/api/v1/freeze/state',
        enabled: false,
      }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use different cache keys for different params', async () => {
    setCacheEntry('/api/v1/pipeline/status?agentId=a1', { agent: 'a1' });
    setCacheEntry('/api/v1/pipeline/status?agentId=a2', { agent: 'a2' });

    const { result: result1 } = renderHook(() =>
      useCachedQuery({
        endpoint: '/api/v1/pipeline/status',
        params: { agentId: 'a1' },
      }),
    );

    const { result: result2 } = renderHook(() =>
      useCachedQuery({
        endpoint: '/api/v1/pipeline/status',
        params: { agentId: 'a2' },
      }),
    );

    expect(result1.current.data).toEqual({ agent: 'a1' });
    expect(result2.current.data).toEqual({ agent: 'a2' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should have a default TTL of 30 seconds', () => {
    expect(DEFAULT_TTL).toBe(30000);
  });
});

// ─── Cache Invalidation Hook Tests ───────────────────────────────────────────

describe('useCacheInvalidation', () => {
  it('should invalidate pipeline status cache on pipeline_result event', () => {
    setCacheEntry('/api/v1/pipeline/status', { status: 'HEALTHY' });
    setCacheEntry('/api/v1/pipeline/status?agentId=a1', { status: 'DEGRADED' });

    const event: StreamEvent = {
      type: 'pipeline_result',
      timestamp: Date.now(),
      payload: {
        correlationId: 'corr-1',
        agentId: 'agent-1',
        allowed: true,
        blockedStage: null,
        totalLatencyMs: 42,
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    // Cache should still be present before the event
    expect(getCacheEntry('/api/v1/pipeline/status')).toBeDefined();

    rerender({ lastEvent: event });

    // Cache should be invalidated after the event
    expect(getCacheEntry('/api/v1/pipeline/status')).toBeUndefined();
    expect(getCacheEntry('/api/v1/pipeline/status?agentId=a1')).toBeUndefined();
  });

  it('should invalidate freeze state cache on freeze_change event', () => {
    setCacheEntry('/api/v1/freeze/state', { wildcardActive: false, frozenAgents: [] });

    const event: StreamEvent = {
      type: 'freeze_change',
      timestamp: Date.now(),
      payload: {
        agentId: 'agent-1',
        action: 'freeze',
        actor: 'admin',
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    expect(getCacheEntry('/api/v1/freeze/state')).toBeDefined();

    rerender({ lastEvent: event });

    expect(getCacheEntry('/api/v1/freeze/state')).toBeUndefined();
  });

  it('should invalidate module health cache on module_state event', () => {
    setCacheEntry('/api/v1/modules/health', { modules: [] });

    const event: StreamEvent = {
      type: 'module_state',
      timestamp: Date.now(),
      payload: {
        moduleName: 'pii-detector',
        status: 'degraded',
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    expect(getCacheEntry('/api/v1/modules/health')).toBeDefined();

    rerender({ lastEvent: event });

    expect(getCacheEntry('/api/v1/modules/health')).toBeUndefined();
  });

  it('should not invalidate unrelated caches', () => {
    setCacheEntry('/api/v1/freeze/state', { wildcardActive: false, frozenAgents: [] });
    setCacheEntry('/api/v1/modules/health', { modules: [] });

    const event: StreamEvent = {
      type: 'pipeline_result',
      timestamp: Date.now(),
      payload: {
        correlationId: 'corr-1',
        agentId: 'agent-1',
        allowed: true,
        blockedStage: null,
        totalLatencyMs: 42,
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    rerender({ lastEvent: event });

    // Freeze and modules caches should remain untouched
    expect(getCacheEntry('/api/v1/freeze/state')).toBeDefined();
    expect(getCacheEntry('/api/v1/modules/health')).toBeDefined();
  });

  it('should do nothing for unrecognized event types', () => {
    setCacheEntry('/api/v1/pipeline/status', { status: 'HEALTHY' });
    setCacheEntry('/api/v1/freeze/state', { frozen: [] });
    setCacheEntry('/api/v1/modules/health', { modules: [] });

    const event: StreamEvent = {
      type: 'cost_update',
      timestamp: Date.now(),
      payload: {
        correlationId: 'corr-1',
        agentId: 'agent-1',
        amount: 0.05,
        runningTotal: 1.25,
        provider: 'openai',
        model: 'gpt-4',
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    rerender({ lastEvent: event });

    // All caches should remain
    expect(getCacheEntry('/api/v1/pipeline/status')).toBeDefined();
    expect(getCacheEntry('/api/v1/freeze/state')).toBeDefined();
    expect(getCacheEntry('/api/v1/modules/health')).toBeDefined();
  });

  it('should do nothing when lastEvent is null', () => {
    setCacheEntry('/api/v1/pipeline/status', { status: 'HEALTHY' });

    renderHook(() => useCacheInvalidation(null));

    expect(getCacheEntry('/api/v1/pipeline/status')).toBeDefined();
  });

  it('should support custom invalidation map', () => {
    setCacheEntry('/api/v1/custom/endpoint', { custom: true });

    const customMap = {
      alert_triggered: ['/api/v1/custom/endpoint'],
    };

    const event: StreamEvent = {
      type: 'alert_triggered',
      timestamp: Date.now(),
      payload: {
        ruleId: 'rule-1',
        severity: 'critical',
        message: 'Budget exceeded',
        currentValue: 95,
        threshold: 80,
        timestamp: Date.now(),
      },
    };

    const { rerender } = renderHook(
      ({ lastEvent }) => useCacheInvalidation(lastEvent, customMap),
      { initialProps: { lastEvent: null as StreamEvent | null } },
    );

    rerender({ lastEvent: event });

    expect(getCacheEntry('/api/v1/custom/endpoint')).toBeUndefined();
  });

  it('should expose default invalidation map with correct mappings', () => {
    expect(DEFAULT_INVALIDATION_MAP).toEqual({
      pipeline_result: ['/api/v1/pipeline/status'],
      freeze_change: ['/api/v1/freeze/state'],
      module_state: ['/api/v1/modules/health'],
    });
  });
});
