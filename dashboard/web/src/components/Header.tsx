'use client';

import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import { useDataStream } from '@/hooks/useDataStream';
import { usePollingFallback } from '@/hooks/usePollingFallback';
import type { StreamEvent } from '../../../../shared/types';

// ─── Default polling endpoints for fallback ──────────────────────────────────

const DEFAULT_POLLING_ENDPOINTS = [
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

/**
 * Dashboard Header component with TimeRangeSelector, ThemeToggle, and ConnectionStatusIndicator.
 * Provides top-level navigation and controls for the governance dashboard.
 *
 * The header establishes the primary WebSocket connection and polling fallback,
 * passing connection status to the ConnectionStatusIndicator.
 *
 * Requirements: 1.4, 11.7
 */
export function Header() {
  const { status } = useDataStream({
    channels: ['pipeline', 'cost', 'freeze', 'alerts', 'modules'],
  });

  const { isPolling } = usePollingFallback({
    connectionStatus: status,
    endpoints: DEFAULT_POLLING_ENDPOINTS,
  });

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6">
      {/* Logo and title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-600 text-sm font-bold text-white">
          TT
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Governance Dashboard
        </h1>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* TimeRangeSelector (Requirement 1.5) */}
        <TimeRangeSelector />

        {/* ThemeToggle placeholder */}
        <ThemeTogglePlaceholder />

        {/* Connection status indicator (Requirements 1.4, 11.7) */}
        <ConnectionStatusIndicator status={status} isPolling={isPolling} />
      </div>
    </header>
  );
}

/** Placeholder for the ThemeToggle component (Task 9.4) */
function ThemeTogglePlaceholder() {
  return (
    <button
      className="rounded-md border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}
