'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDataStream } from '../hooks/useDataStream';
import { useAuth } from '../hooks/useAuth';
import type { FreezeStateResponse, StreamEvent } from '../../../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';
}

// ─── FreezeBanner Component ──────────────────────────────────────────────────

/**
 * FreezeBanner — Displays a prominent red/warning banner at the top of the dashboard
 * when any freeze is active (individual agents or global wildcard).
 *
 * Subscribes to the 'freeze' WebSocket channel for real-time state updates.
 *
 * Requirements: 8.8
 */
export function FreezeBanner() {
  const { getAuthHeaders } = useAuth();
  const [freezeState, setFreezeState] = useState<FreezeStateResponse | null>(null);

  // ─── Fetch initial freeze state ────────────────────────────────────────

  const fetchFreezeState = useCallback(async () => {
    const baseUrl = getApiBaseUrl();
    const headers = getAuthHeaders();

    try {
      const res = await fetch(`${baseUrl}/api/v1/freeze/state`, { headers });
      if (res.ok) {
        const data = (await res.json()) as FreezeStateResponse;
        setFreezeState(data);
      }
    } catch {
      // Silently fail — banner is non-critical
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchFreezeState();
  }, [fetchFreezeState]);

  // ─── Real-time updates ─────────────────────────────────────────────────

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'freeze_change') {
        fetchFreezeState();
      }
    },
    [fetchFreezeState],
  );

  useDataStream({
    channels: ['freeze'],
    onEvent: handleStreamEvent,
  });

  // ─── Derived state ─────────────────────────────────────────────────────

  const isAnyFreezeActive = freezeState
    ? freezeState.wildcardActive || freezeState.frozenAgents.length > 0
    : false;

  if (!isAnyFreezeActive) {
    return null;
  }

  // Build description of what's frozen
  const freezeDescription = freezeState?.wildcardActive
    ? 'Global kill switch active — ALL agent requests are being blocked.'
    : `${freezeState?.frozenAgents.length} agent(s) frozen: ${freezeState?.frozenAgents.join(', ')}`;

  return (
    <div
      className="flex items-center justify-between bg-red-600 px-6 py-2 text-sm font-medium text-white"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>
          <strong>Kill Switch Active</strong> — {freezeDescription}
        </span>
      </div>
    </div>
  );
}
