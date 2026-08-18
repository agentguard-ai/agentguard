import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { calculateBackoff, useDataStream } from './useDataStream';
import type { StreamEvent } from '../../../../shared/types';

// ─── Mock WebSocket ──────────────────────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Test helpers
  simulateMessage(data: StreamEvent) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// ─── Test Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateBackoff', () => {
  it('should return 1000ms for attempt 0', () => {
    expect(calculateBackoff(0)).toBe(1000);
  });

  it('should return 2000ms for attempt 1', () => {
    expect(calculateBackoff(1)).toBe(2000);
  });

  it('should return 4000ms for attempt 2', () => {
    expect(calculateBackoff(2)).toBe(4000);
  });

  it('should return 8000ms for attempt 3', () => {
    expect(calculateBackoff(3)).toBe(8000);
  });

  it('should return 16000ms for attempt 4', () => {
    expect(calculateBackoff(4)).toBe(16000);
  });

  it('should cap at 30000ms for attempt 5 and beyond', () => {
    expect(calculateBackoff(5)).toBe(30000); // 2^5 * 1000 = 32000, capped at 30000
    expect(calculateBackoff(6)).toBe(30000);
    expect(calculateBackoff(10)).toBe(30000);
    expect(calculateBackoff(100)).toBe(30000);
  });
});

describe('useDataStream', () => {
  it('should start with disconnected status', () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'], enabled: false })
    );

    expect(result.current.status).toBe('disconnected');
    expect(result.current.lastEvent).toBeNull();
  });

  it('should connect and send subscribe message on open', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline', 'cost'], filters: { agentId: 'agent-1' } })
    );

    // WebSocket is created synchronously, open fires async
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('connected');
    expect(MockWebSocket.instances).toHaveLength(1);

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:3100/api/v1/stream');
    expect(ws.sentMessages).toHaveLength(1);

    const subscribeMsg = JSON.parse(ws.sentMessages[0]);
    expect(subscribeMsg).toEqual({
      type: 'subscribe',
      channels: ['pipeline', 'cost'],
      filters: { agentId: 'agent-1' },
    });
  });

  it('should handle incoming events and update lastEvent', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'], onEvent })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const mockEvent: StreamEvent = {
      type: 'pipeline_result',
      timestamp: 1700000000000,
      payload: {
        correlationId: 'corr-1',
        agentId: 'agent-1',
        allowed: true,
        blockedStage: null,
        totalLatencyMs: 50,
        timestamp: 1700000000000,
      },
    };

    act(() => {
      MockWebSocket.instances[0].simulateMessage(mockEvent);
    });

    expect(result.current.lastEvent).toEqual(mockEvent);
    expect(onEvent).toHaveBeenCalledWith(mockEvent);
  });

  it('should handle malformed messages without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEvent = vi.fn();

    renderHook(() => useDataStream({ channels: ['pipeline'], onEvent }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const ws = MockWebSocket.instances[0];
    // Send invalid JSON
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', { data: 'not-json{' }));
      }
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useDataStream]'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('should set status to reconnecting on close and reconnect with backoff', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('connected');

    // Simulate disconnection
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    expect(result.current.status).toBe('reconnecting');

    // After 1000ms (first backoff), a new connection should be attempted
    // +1ms to ensure the timer fires, then flush the onopen setTimeout(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    // New WebSocket instance created
    expect(MockWebSocket.instances).toHaveLength(2);

    expect(result.current.status).toBe('connected');
  });

  it('should use exponential backoff on repeated failures', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // First disconnect — backoff should be 1000ms
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    expect(result.current.status).toBe('reconnecting');

    // Advance 999ms — should NOT have reconnected yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    // Advance 1ms more — should reconnect
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Simulate open then immediate close — second backoff should be 2000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });

    // At 1999ms, should NOT have reconnected
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // At 2000ms, should reconnect
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('should append ?since=<timestamp> on reconnect for state-sync', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Receive an event with a timestamp
    const mockEvent: StreamEvent = {
      type: 'cost_update',
      timestamp: 1700000050000,
      payload: {
        correlationId: 'corr-2',
        agentId: 'agent-1',
        amount: 0.05,
        runningTotal: 1.25,
        provider: 'openai',
        model: 'gpt-4',
        timestamp: 1700000050000,
      },
    };

    act(() => {
      MockWebSocket.instances[0].simulateMessage(mockEvent);
    });

    // Disconnect and reconnect
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // New WebSocket should have ?since= query param
    const ws2 = MockWebSocket.instances[1];
    expect(ws2.url).toBe('ws://localhost:3100/api/v1/stream?since=1700000050000');
  });

  it('should not connect when enabled is false', () => {
    renderHook(() =>
      useDataStream({ channels: ['pipeline'], enabled: false })
    );

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('should disconnect when enabled changes to false', async () => {
    const { rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useDataStream({ channels: ['pipeline'], enabled: props.enabled }),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    rerender({ enabled: false });

    // WebSocket should have been closed (readyState set to CLOSED by our mock)
    expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.CLOSED);
  });

  it('should reset backoff attempt counter on successful connection', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Disconnect
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    // Reconnect after 1000ms backoff + flush onopen setTimeout(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });

    expect(result.current.status).toBe('connected');

    // Disconnect again — should use 1000ms backoff (reset), not 2000ms
    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });

    // At 999ms no reconnect
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // At 1001ms, reconnect (1000ms timer + onopen flush)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('should allow runtime subscribe/unsubscribe', async () => {
    const { result } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const ws = MockWebSocket.instances[0];

    // Dynamic subscribe
    act(() => {
      result.current.subscribe(['cost', 'freeze']);
    });

    expect(ws.sentMessages).toHaveLength(2); // initial subscribe + dynamic
    const dynamicSubscribe = JSON.parse(ws.sentMessages[1]);
    expect(dynamicSubscribe).toEqual({
      type: 'subscribe',
      channels: ['cost', 'freeze'],
    });

    // Dynamic unsubscribe
    act(() => {
      result.current.unsubscribe(['pipeline']);
    });

    expect(ws.sentMessages).toHaveLength(3);
    const unsubMsg = JSON.parse(ws.sentMessages[2]);
    expect(unsubMsg).toEqual({
      type: 'unsubscribe',
      channels: ['pipeline'],
    });
  });

  it('should convert HTTP URL to WS URL for the connection', async () => {
    // Default API URL is http://localhost:3100
    renderHook(() => useDataStream({ channels: ['pipeline'] }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(MockWebSocket.instances[0].url).toMatch(/^ws:\/\//);
  });

  it('should clean up on unmount', async () => {
    const { unmount } = renderHook(() =>
      useDataStream({ channels: ['pipeline'] })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const ws = MockWebSocket.instances[0];
    unmount();

    // WebSocket should be closed
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });
});
