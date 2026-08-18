'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { StreamEvent, SubscribeMessage, UnsubscribeMessage } from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StreamChannel = 'pipeline' | 'cost' | 'freeze' | 'alerts' | 'modules';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface UseDataStreamOptions {
  /** Channels to subscribe to on connection */
  channels: StreamChannel[];
  /** Optional filters for server-side event filtering */
  filters?: { agentId?: string };
  /** Callback invoked for each received event */
  onEvent?: (event: StreamEvent) => void;
  /** Whether the WebSocket connection should be active (default: true) */
  enabled?: boolean;
}

export interface UseDataStreamReturn {
  /** Current WebSocket connection status */
  status: ConnectionStatus;
  /** Most recently received event */
  lastEvent: StreamEvent | null;
  /** Subscribe to additional channels at runtime */
  subscribe: (channels: StreamChannel[]) => void;
  /** Unsubscribe from channels at runtime */
  unsubscribe: (channels: StreamChannel[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert HTTP(S) URL to WS(S) URL.
 */
function httpToWs(url: string): string {
  return url.replace(/^http/, 'ws');
}

/**
 * Get the API base URL from environment variable or default.
 */
function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';
}

/**
 * Calculate exponential backoff delay.
 * Formula: Math.min(1000 * 2^attempt, 30000)
 * attempt 0 → 1000ms, attempt 1 → 2000ms, attempt 2 → 4000ms, ..., capped at 30000ms
 */
export function calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useDataStream — WebSocket hook for real-time event streaming from the DashboardAPI.
 *
 * Connects to `/api/v1/stream`, subscribes to specified channels, and auto-reconnects
 * with exponential backoff (1s initial, 30s max). On reconnect, appends `?since=<timestamp>`
 * for state-sync of missed events.
 *
 * @param options - Configuration for channels, filters, event callback, and enabled state
 * @returns Connection status, last event, and subscribe/unsubscribe controls
 *
 * Requirements: 1.4, 11.1, 11.6, 11.7
 */
export function useDataStream(options: UseDataStreamOptions): UseDataStreamReturn {
  const { channels, filters, onEvent, enabled = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);

  // Refs to persist across renders without triggering re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const channelsRef = useRef<StreamChannel[]>(channels);
  const filtersRef = useRef(filters);
  const onEventRef = useRef(onEvent);
  const enabledRef = useRef(enabled);
  const isUnmountedRef = useRef(false);

  // Keep refs up to date with latest values
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // ─── Send message helper ─────────────────────────────────────────────────

  const sendMessage = useCallback((message: SubscribeMessage | UnsubscribeMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  // ─── Subscribe to additional channels ────────────────────────────────────

  const subscribe = useCallback((newChannels: StreamChannel[]) => {
    const msg: SubscribeMessage = {
      type: 'subscribe',
      channels: newChannels,
      ...(filtersRef.current && { filters: filtersRef.current }),
    };
    sendMessage(msg);
  }, [sendMessage]);

  // ─── Unsubscribe from channels ───────────────────────────────────────────

  const unsubscribe = useCallback((removeChannels: StreamChannel[]) => {
    const msg: UnsubscribeMessage = {
      type: 'unsubscribe',
      channels: removeChannels,
    };
    sendMessage(msg);
  }, [sendMessage]);

  // ─── Connection logic ────────────────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;

    if (!enabled) {
      // If disabled, close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    function connect() {
      if (isUnmountedRef.current) return;

      const baseUrl = getApiBaseUrl();
      const wsBaseUrl = httpToWs(baseUrl);
      let streamUrl = `${wsBaseUrl}/api/v1/stream`;

      // On reconnect, append ?since=<last_timestamp> for state-sync (Req 11.7)
      if (lastTimestampRef.current !== null) {
        streamUrl += `?since=${lastTimestampRef.current}`;
      }

      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;

        setStatus('connected');
        attemptRef.current = 0; // Reset backoff on successful connection

        // Subscribe to configured channels on connect (Req 11.6)
        const subscribeMsg: SubscribeMessage = {
          type: 'subscribe',
          channels: channelsRef.current,
          ...(filtersRef.current && { filters: filtersRef.current }),
        };
        ws.send(JSON.stringify(subscribeMsg));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isUnmountedRef.current) return;

        try {
          const streamEvent: StreamEvent = JSON.parse(event.data);

          // Track last timestamp for reconnect state-sync (Req 11.7)
          if (streamEvent.timestamp) {
            lastTimestampRef.current = streamEvent.timestamp;
          }

          // Update last event state
          setLastEvent(streamEvent);

          // Call the event callback if provided (Req 11.6 - client-side filtering)
          if (onEventRef.current) {
            onEventRef.current(streamEvent);
          }
        } catch {
          // Malformed WebSocket message — log warning and skip (error handling spec)
          console.warn('[useDataStream] Failed to parse WebSocket message:', event.data);
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;

        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;

        // Close will be fired after error, which triggers reconnect
        // Just ensure we mark as reconnecting
        wsRef.current = null;
      };
    }

    function scheduleReconnect() {
      if (isUnmountedRef.current || !enabledRef.current) return;

      setStatus('reconnecting');

      const delay = calculateBackoff(attemptRef.current);
      attemptRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    // Initiate connection
    connect();

    // Cleanup on unmount or when enabled changes
    return () => {
      isUnmountedRef.current = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  return {
    status,
    lastEvent,
    subscribe,
    unsubscribe,
  };
}

export default useDataStream;
