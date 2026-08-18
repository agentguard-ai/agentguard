'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { formatMicroDollar } from '@/utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoutingEntry {
  sourceModel: string;
  targetModel: string;
  perRequestSavings: number;
}

// ─── RoutingTableRow ─────────────────────────────────────────────────────────

interface RoutingTableRowProps {
  entry: RoutingEntry;
}

/**
 * Renders a single row in the routing table showing source, target, and savings.
 */
function RoutingTableRow({ entry }: RoutingTableRowProps) {
  return (
    <tr
      className="border-b border-[var(--color-border)]/50 last:border-b-0"
      data-testid="routing-entry"
    >
      <td
        className="px-3 py-2 text-sm text-[var(--color-text-primary)]"
        data-testid="routing-source-model"
      >
        {entry.sourceModel}
      </td>
      <td
        className="px-3 py-2 text-sm text-[var(--color-text-primary)]"
        data-testid="routing-target-model"
      >
        {entry.targetModel}
      </td>
      <td
        className="px-3 py-2 text-sm font-medium text-[var(--color-success)]"
        data-testid="routing-savings"
      >
        {formatMicroDollar(entry.perRequestSavings)}
      </td>
    </tr>
  );
}

// ─── ModelRoutingPanelContent ────────────────────────────────────────────────

/**
 * Inner content for the Model Routing panel.
 * Handles data fetching, loading, empty, and rendered states.
 */
function ModelRoutingPanelContent() {
  const { data, isLoading, error } = useCachedQuery<RoutingEntry[]>({
    endpoint: '/api/v1/routing/entries',
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="model-routing-loading">
        <div className="panel-header">
          <span>Model Routing</span>
        </div>
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="model-routing-error">
        <div className="panel-header">
          <span>Model Routing</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load routing data
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="model-routing-empty">
        <div className="panel-header">
          <span>Model Routing</span>
        </div>
        <EmptyState
          panelType="table"
          message="No model routing events for the selected time range."
        />
      </div>
    );
  }

  // Data loaded
  return (
    <div
      className="panel flex flex-col"
      data-testid="model-routing-panel"
      aria-label={`Model Routing: ${data.length} routing entr${data.length !== 1 ? 'ies' : 'y'}`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Model Routing</span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            24h
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {data.length} entr{data.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>

      {/* Routing Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-left"
          role="table"
          aria-label="Model routing entries"
        >
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Source Model
              </th>
              <th className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Target Model
              </th>
              <th className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Per-Request Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => (
              <RoutingTableRow
                key={`${entry.sourceModel}-${entry.targetModel}-${index}`}
                entry={entry}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ModelRoutingPanel (exported panel) ──────────────────────────────────────

/**
 * ModelRoutingPanel — Displays cost ceiling trigger events and a routing table
 * showing source model, target model, and per-request savings.
 *
 * Wrapped in PanelErrorBoundary for error isolation.
 *
 * Requirements: 7.1, 7.3
 */
export function ModelRoutingPanel() {
  return (
    <PanelErrorBoundary panelName="Model Routing">
      <ModelRoutingPanelContent />
    </PanelErrorBoundary>
  );
}

export default ModelRoutingPanel;
