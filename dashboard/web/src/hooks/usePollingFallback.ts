'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConnectionStatus } from './useDataStream';
import type { StreamEvent } from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PollingEndpoint {
  /** Channel name this endpoint serves */
  channel: string;
  /** REST endpoint URL to poll */
  url: string;
  /** Transform the REST response into a StreamEvent */
  transform: (data: unknown) => StreamEvent;
}

export interface UsePollingFallbackOptions {
  /** Current WebSocket connection status from useDataStream */
  connectionStatus: ConnectionStatus;
  /** REST endpoints to poll as fallback */
  endpoints: PollingEndpoint[];
  /** Polling interval in milliseconds (default: 10000) */
  pollInterval?: number;
  /** Time in ms the connection must be disconnected before fallback activates (default: 30000) */
  activationDelay?: number;
  /** Callback invoked for each polled event */
  onEvent?: (event: StreamEvent) => void;
  /** Base URL for API requests (default: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100') */
  apiBaseUrl?: string;
}

export interface UsePollingFallbackReturn {
  /** Whether polling fallback is currently active */
  isPolling: boolean;
  /** Most recently polled event */
  lastEvent: StreamEvent | null;
  /** Any endpoint-specific errors (key = endpoint URL) */
  errors: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds
const DEFAULT_ACTIVATION_DELAY = 30000; // 30 seconds (matches max backoff)

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * usePollingFallback — Activates REST polling when WebSocket is unavailable.
 *
 * When the WebSocket connection status remains 'disconnected' for longer than
 * the activation delay (default 30s, matching the max backoff period), this hook
 * begins polling specified REST endpoints at a configured interval (default 10s).
 *
 * Panels continue operating independently — if a specific endpoint is unreachable,
 * other endpoints continue polling. Errors are tracked per-endpoint.
 *
 * Requirements: 1.4, 11.7
 */
export function usePollingFallback(options: UsePollingFallbackOptions): UsePollingFallbackReturn {
  const {
    connectionStatus,
    endpoints,
    pollInterval = DEFAULT_POLL_INTERVAL,
    activationDelay = DEFAULT_ACTIVATION_DELAY,
    onEvent,
    apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100',
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onEventRef = useRef(onEvent);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Keep onEvent ref current
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // ─── Poll function ─────────────────────────────────────────────────────────

  const pollEndpoints = useCallback(async () => {
    if (isUnmountedRef.current) return;

    const newErrors: Record<string, string> = {};

    for (const endpoint of endpoints) {
      if (isUnmountedRef.current) break;

      try {
        const response = await fetch(`${apiBaseUrl}${endpoint.url}`);

        if (!response.ok) {
          newErrors[endpoint.url] = `HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();
        const event = endpoint.transform(data);

        if (!isUnmountedRef.current) {
          setLastEvent(event);
          if (onEventRef.current) {
            onEventRef.current(event);
          }
        }
      } catch (err) {
        // Endpoint unreachable — other endpoints continue independently
        newErrors[endpoint.url] = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    if (!isUnmountedRef.current) {
      setErrors(newErrors);
    }
  }, [endpoints, apiBaseUrl]);

  // ─── Activation logic ──────────────────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;

    if (connectionStatus === 'connected') {
      // WebSocket is back — deactivate polling
      if (activationTimerRef.current) {
        clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setIsPolling(false);
      setErrors({});
      return;
    }

    if (connectionStatus === 'reconnecting' || connectionStatus === 'disconnected') {
      // Start activation timer if not already running and not already polling
      if (!activationTimerRef.current && !pollTimerRef.current) {
        activationTimerRef.current = setTimeout(() => {
          activationTimerRef.current = null;

          if (isUnmountedRef.current) return;

          // Activate polling
          setIsPolling(true);

          // Immediately poll once
          pollEndpoints();

          // Start interval
          pollTimerRef.current = setInterval(() => {
            pollEndpoints();
          }, pollInterval);
        }, activationDelay);
      }
    }

    return () => {
      isUnmountedRef.current = true;
      if (activationTimerRef.current) {
        clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [connectionStatus, pollInterval, activationDelay, pollEndpoints]);

  return {
    isPolling,
    lastEvent,
    errors,
  };
}

export default usePollingFallback;
