'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CanaryEvent {
  id: string;
  timestamp: number;
  agentId: string;
  agentName?: string;
  type: 'drift' | 'anomaly' | 'freeze_trigger';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  observed: number;
  baseline: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable agent name from agentId if agentName is not provided.
 * e.g., "agent-coding-03" → "Coding-03"
 */
function getAgentDisplayName(event: CanaryEvent): string {
  if (event.agentName) return event.agentName;
  // Strip "agent-" prefix and capitalize
  const name = event.agentId.replace(/^agent-/, '');
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Calculate deviation percentage: how far observed exceeds baseline.
 * Returns a positive percentage rounded to 1 decimal place.
 */
function calcDeviationPercent(observed: number, baseline: number): string {
  if (baseline === 0) return 'N/A';
  const deviation = ((observed - baseline) / baseline) * 100;
  return `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`;
}

/**
 * Format a canary type for display.
 */
function formatCanaryType(type: CanaryEvent['type']): string {
  switch (type) {
    case 'drift':
      return 'Drift';
    case 'anomaly':
      return 'Anomaly';
    case 'freeze_trigger':
      return 'Freeze Trigger';
    default:
      return type;
  }
}

/**
 * Format timestamp to a short readable string.
 */
function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── SeverityIndicator ───────────────────────────────────────────────────────

interface SeverityIndicatorProps {
  severity: CanaryEvent['severity'];
  type: CanaryEvent['type'];
}

/**
 * Displays severity indicator with color AND text for accessibility.
 * - critical / freeze_trigger → red "Frozen"
 * - warning → orange "Warning"
 * - info → gray "Info"
 *
 * Requirements: 6.2, 6.3
 */
export function SeverityIndicator({ severity, type }: SeverityIndicatorProps) {
  // Critical severity or freeze_trigger type → red "Frozen"
  if (severity === 'critical' || type === 'freeze_trigger') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500"
        data-testid="severity-frozen"
        aria-label="Severity: Frozen"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Frozen</span>
      </span>
    );
  }

  // Warning severity → orange "Warning"
  if (severity === 'warning') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-500"
        data-testid="severity-warning"
        aria-label="Severity: Warning"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>Warning</span>
      </span>
    );
  }

  // Info severity → gray "Info"
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-500"
      data-testid="severity-info"
      aria-label="Severity: Info"
    >
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Info</span>
    </span>
  );
}

// ─── CanaryAlertsPanelContent ────────────────────────────────────────────────

/**
 * Inner content for the Canary Alerts panel.
 * - Fetches from /api/v1/canary/events
 * - Sorts events by timestamp descending
 * - Limits display to 50 items
 * - Shows per-event: agent name, canary type, severity, action, timestamp, deviation %
 * - Handles loading/error/empty states
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.2
 */
function CanaryAlertsPanelContent() {
  const { data, isLoading, error, invalidate } = useCachedQuery<CanaryEvent[]>({
    endpoint: '/api/v1/canary/events',
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="canary-alerts-loading">
        <div className="panel-header">
          <span>Canary Alerts</span>
        </div>
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  // Error state with retry action
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="canary-alerts-error">
        <div className="panel-header">
          <span>Canary Alerts</span>
        </div>
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 min-h-[200px] py-8"
          role="alert"
        >
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load canary alerts
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Endpoint: /api/v1/canary/events
          </p>
          <button
            onClick={invalidate}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
            aria-label="Retry loading canary alerts"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="canary-alerts-empty">
        <div className="panel-header">
          <span>Canary Alerts</span>
        </div>
        <EmptyState
          panelType="alerts"
          message="No canary alerts have been triggered for the selected time range."
        />
      </div>
    );
  }

  // Sort by timestamp descending and limit to 50 items
  const sortedEvents = [...data]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  // Data loaded — render event list
  return (
    <div
      className="panel flex flex-col"
      data-testid="canary-alerts-panel"
      aria-label={`Canary Alerts: ${sortedEvents.length} triggered event${sortedEvents.length !== 1 ? 's' : ''}`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Canary Alerts</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events List */}
      <ul
        className="flex flex-col gap-2 overflow-y-auto max-h-[400px]"
        role="list"
        aria-label="Canary events list"
      >
        {sortedEvents.map((event) => (
          <li
            key={event.id}
            className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30 px-3 py-2.5"
            data-testid="canary-event-item"
          >
            {/* Top row: agent name + severity indicator */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm font-medium text-[var(--color-text-primary)] truncate"
                data-testid="canary-event-agent"
              >
                {getAgentDisplayName(event)}
              </span>
              <SeverityIndicator severity={event.severity} type={event.type} />
            </div>

            {/* Detail row: canary type, action (message), deviation %, timestamp */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
              <span data-testid="canary-event-type">
                <span className="font-medium">Type:</span> {formatCanaryType(event.type)}
              </span>
              <span data-testid="canary-event-action">
                <span className="font-medium">Action:</span>{' '}
                <span className="truncate max-w-[180px] inline-block align-bottom" title={event.message}>
                  {event.message}
                </span>
              </span>
              <span data-testid="canary-event-deviation">
                <span className="font-medium">Deviation:</span>{' '}
                {calcDeviationPercent(event.observed, event.baseline)}
              </span>
              <span data-testid="canary-event-timestamp">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── CanaryAlertsPanel (exported panel) ──────────────────────────────────────

/**
 * CanaryAlertsPanel — Displays a sorted list of up to 50 triggered canary events,
 * showing agent name, canary type, severity indicator, action, timestamp,
 * and deviation percentage.
 *
 * Severity indicators:
 * - critical / freeze_trigger → red "Frozen"
 * - warning → orange "Warning"
 * - info → gray "Info"
 *
 * Wrapped in PanelErrorBoundary for error isolation.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.2
 */
export function CanaryAlertsPanel() {
  return (
    <PanelErrorBoundary panelName="Canary Alerts">
      <CanaryAlertsPanelContent />
    </PanelErrorBoundary>
  );
}

export default CanaryAlertsPanel;
