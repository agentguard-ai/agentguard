'use client';

import type { ConnectionStatus } from '@/hooks/useDataStream';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectionStatusIndicatorProps {
  /** Current WebSocket connection status */
  status: ConnectionStatus;
  /** Whether polling fallback is active */
  isPolling?: boolean;
}

// ─── Status Configuration ────────────────────────────────────────────────────

interface StatusConfig {
  dotColor: string;
  label: string;
  ariaLabel: string;
}

function getStatusConfig(status: ConnectionStatus, isPolling: boolean): StatusConfig {
  if (status === 'connected') {
    return {
      dotColor: 'bg-green-500',
      label: 'Connected',
      ariaLabel: 'WebSocket connected',
    };
  }

  if (status === 'reconnecting') {
    return {
      dotColor: 'bg-amber-500',
      label: 'Reconnecting...',
      ariaLabel: 'WebSocket reconnecting',
    };
  }

  // status === 'disconnected'
  if (isPolling) {
    return {
      dotColor: 'bg-amber-500',
      label: 'Polling',
      ariaLabel: 'WebSocket disconnected, using polling fallback',
    };
  }

  return {
    dotColor: 'bg-red-500',
    label: 'Disconnected',
    ariaLabel: 'WebSocket disconnected',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ConnectionStatusIndicator — Shows the current WebSocket connection state.
 *
 * - Green dot + "Connected" when WebSocket is live
 * - Amber dot + "Reconnecting..." during backoff
 * - Red dot + "Disconnected" when WebSocket is down
 * - Amber dot + "Polling" when fallback polling is active
 *
 * Requirements: 1.4, 11.7
 */
export function ConnectionStatusIndicator({
  status,
  isPolling = false,
}: ConnectionStatusIndicatorProps) {
  const config = getStatusConfig(status, isPolling);

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
      title={config.ariaLabel}
      role="status"
      aria-label={config.ariaLabel}
    >
      <span
        className={`h-2 w-2 rounded-full ${config.dotColor}${
          status === 'reconnecting' ? ' animate-pulse' : ''
        }`}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </div>
  );
}

export default ConnectionStatusIndicator;
