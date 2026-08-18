import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePollingFallback } from './usePollingFallback';
import type { ConnectionStatus } from './useDataStream';
import type { StreamEvent } from '../../../../shared/types';

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── Test helpers ────────────────────────────────────────────────────────────

const testEndpoints = [
  {
    channel: 'pipeline',
    url: '/api/v1/pipeline/status',
    transform: (data: unknown): StreamEvent => ({
      type: 'pipeline_result' as const,
      timestamp: Date.now(),
      payload: data as StreamEvent['payload'],
    }),
  },
  {
    channel: 'freeze',
    url: '/api/v1/freeze/state',
    transform: (data: unknown): StreamEvent => ({
      type: 'freeze_change' as const,
      timestamp: Date.now(),
      payload: data as StreamEvent['payload'],
    }),
  },
];

function createOptions(overrides: {
  connectionStatus?: ConnectionStatus;
  onEvent?: (event: StreamEvent) => void;
  pollInterval?: number;
  activationDelay?: number;
} = {}) {
  return {
    connectionStatus: overrides.connectionStatus ?? 'connected' as ConnectionStatus,
    endpoints: testEndpoints,
    pollInterval: overrides.pollInterval ?? 10000,
    activationDelay: overrides.activationDelay ?? 30000,
    onEvent: overrides.onEvent,
    apiBaseUrl: 'http://localhost:3100',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePollingFallback', () => {
  it('should not poll when connection status is connected', () => {
    const { result } = renderHook(() =>
      usePollingFallback(createOptions({ connectionStatus: 'connected' }))
    );

    expect(result.current.isPolling).toBe(false);
    expect(result.current.lastEvent).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not immediately poll when disconnected (waits for activation delay)', async () => {
    const { result } = renderHook(() =>
      usePollingFallback(createOptions({ connectionStatus: 'disconnected' }))
    );

    // Advance 29 seconds — should NOT have started polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29000);
    });

    expect(result.current.isPolling).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should activate polling after activation delay when disconnected', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ overallStatus: 'HEALTHY' }),
    });

    const { result } = renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 30000,
      }))
    );

    // Advance past the activation delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001);
    });

    expect(result.current.isPolling).toBe(true);
    // Should have polled both endpoints once immediately
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3100/api/v1/pipeline/status');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3100/api/v1/freeze/state');
  });

  it('should poll at the configured interval after activation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 1000,
        pollInterval: 5000,
      }))
    );

    // Activate polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    // Initial poll (2 endpoints)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance by poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Second poll (2 more calls)
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // Advance by another interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('should deactivate polling when connection is restored', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const { result, rerender } = renderHook(
      (props: { connectionStatus: ConnectionStatus }) =>
        usePollingFallback(createOptions(props)),
      { initialProps: { connectionStatus: 'disconnected' as ConnectionStatus } }
    );

    // Activate polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001);
    });

    expect(result.current.isPolling).toBe(true);

    // Restore connection
    rerender({ connectionStatus: 'connected' as ConnectionStatus });

    expect(result.current.isPolling).toBe(false);

    // Reset fetch mock count
    mockFetch.mockClear();

    // Advance time — should NOT poll anymore
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should cancel activation timer when connection is restored before delay expires', async () => {
    const { result, rerender } = renderHook(
      (props: { connectionStatus: ConnectionStatus }) =>
        usePollingFallback(createOptions(props)),
      { initialProps: { connectionStatus: 'disconnected' as ConnectionStatus } }
    );

    // Advance 15 seconds (halfway to activation)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(result.current.isPolling).toBe(false);

    // Reconnect
    rerender({ connectionStatus: 'connected' as ConnectionStatus });

    // Advance past original activation time — should NOT activate
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(result.current.isPolling).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should call onEvent callback with polled data', async () => {
    const onEvent = vi.fn();
    const mockData = { overallStatus: 'HEALTHY', modules: [] };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 1000,
        onEvent,
      }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    // onEvent should be called for each successful endpoint
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pipeline_result',
        timestamp: expect.any(Number),
      })
    );
  });

  it('should track errors per-endpoint without stopping other polls', async () => {
    // First endpoint fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ wildcardActive: false }),
      });

    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 1000,
        onEvent,
      }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    // One endpoint should have errored, the other succeeded
    expect(result.current.errors['/api/v1/pipeline/status']).toBe('Network error');
    expect(result.current.errors['/api/v1/freeze/state']).toBeUndefined();

    // onEvent should only be called for the successful endpoint
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('should handle HTTP error responses gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 1000,
      }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    expect(result.current.errors['/api/v1/pipeline/status']).toBe('HTTP 500');
    expect(result.current.errors['/api/v1/freeze/state']).toBe('HTTP 500');
  });

  it('should clear errors when connection is restored', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result, rerender } = renderHook(
      (props: { connectionStatus: ConnectionStatus }) =>
        usePollingFallback(createOptions(props)),
      { initialProps: { connectionStatus: 'disconnected' as ConnectionStatus } }
    );

    // Activate and poll (will error)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001);
    });

    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    // Restore connection
    rerender({ connectionStatus: 'connected' as ConnectionStatus });

    expect(result.current.errors).toEqual({});
  });

  it('should also activate during reconnecting status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const { result } = renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'reconnecting',
        activationDelay: 5000,
      }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001);
    });

    expect(result.current.isPolling).toBe(true);
  });

  it('should update lastEvent on successful poll', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const { result } = renderHook(() =>
      usePollingFallback(createOptions({
        connectionStatus: 'disconnected',
        activationDelay: 1000,
      }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    expect(result.current.lastEvent).not.toBeNull();
    expect(result.current.lastEvent?.type).toBeDefined();
  });
});
