'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { formatCount, formatLatency } from '@/utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'frozen';
  requestsLastHour: number;
  deniedLastHour: number;
  avgLatencyMs: number;
  provider: string;
  model: string;
}

export interface AgentMatrixResponse {
  agents: Agent[];
  totalActive: number;
  totalIdle: number;
  totalFrozen: number;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

/**
 * Status badge with color + icon + text label.
 * Each status has a distinguishing icon so color is never the sole indicator (WCAG 2.1 AA).
 *
 * - active → green, checkmark icon, "active" text
 * - idle → gray, pause/minus icon, "idle" text
 * - frozen → red, snowflake icon, "frozen" text
 */
function StatusBadge({ status }: { status: Agent['status'] }) {
  switch (status) {
    case 'active':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600"
          data-testid="status-active"
        >
          {/* Checkmark icon */}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>active</span>
        </span>
      );

    case 'idle':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-400/15 px-2 py-0.5 text-xs font-medium text-gray-500"
          data-testid="status-idle"
        >
          {/* Pause/minus icon */}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 9v6m4-6v6"
            />
          </svg>
          <span>idle</span>
        </span>
      );

    case 'frozen':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600"
          data-testid="status-frozen"
        >
          {/* Snowflake icon */}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2v20m0-20l4 4m-4-4L8 6m4 14l4-4m-4 4l-4-4M2 12h20M2 12l4-4m-4 4l4 4m14-4l-4-4m4 4l-4 4"
            />
          </svg>
          <span>frozen</span>
        </span>
      );
  }
}

// ─── AgentMatrixPanel ────────────────────────────────────────────────────────

/**
 * AgentMatrixPanel — Displays a table of agents with their provider, model,
 * request metrics, latency, and operational status.
 *
 * Fetches from `/api/v1/agents/matrix`.
 * Status badges use color + icon + text for WCAG 2.1 AA non-color compliance.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 12.3
 */
export function AgentMatrixPanel() {
  const { data, isLoading, error, invalidate } = useCachedQuery<AgentMatrixResponse>({
    endpoint: '/api/v1/agents/matrix',
  });

  // Loading state (Requirement 7.7)
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="agent-matrix-loading">
        <div className="panel-header">
          <span>Agent Matrix</span>
        </div>
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  // Error state with retry (Requirement 7.6)
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="agent-matrix-error">
        <div className="panel-header">
          <span>Agent Matrix</span>
        </div>
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 min-h-[200px] py-8"
          role="alert"
        >
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load agent matrix data
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Endpoint: /api/v1/agents/matrix
          </p>
          <button
            onClick={invalidate}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
            aria-label="Retry loading agent matrix data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state (Requirement 7.8)
  if (!data || data.agents.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="agent-matrix-empty">
        <div className="panel-header">
          <span>Agent Matrix</span>
        </div>
        <EmptyState
          panelType="table"
          message="No agent data available for the selected time range"
        />
      </div>
    );
  }

  // Success state — render table (Requirement 7.1)
  return (
    <div className="panel flex flex-col" data-testid="agent-matrix-panel">
      <div className="panel-header">
        <span>Agent Matrix</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {data.totalActive + data.totalIdle + data.totalFrozen} agents
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" aria-label="Agent Matrix table">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <th className="pb-2 pr-3 font-medium">Agent Name</th>
              <th className="pb-2 pr-3 font-medium">Provider</th>
              <th className="pb-2 pr-3 font-medium">Model</th>
              <th className="pb-2 pr-3 font-medium text-right">Requests/hr</th>
              <th className="pb-2 pr-3 font-medium text-right">Denied/hr</th>
              <th className="pb-2 pr-3 font-medium text-right">Avg Latency (ms)</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-b border-[var(--color-border)]/50 last:border-0"
                data-testid="agent-row"
              >
                <td className="py-2.5 pr-3 text-[var(--color-text-primary)] font-medium">
                  {agent.name}
                </td>
                <td className="py-2.5 pr-3 text-[var(--color-text-secondary)]">
                  {agent.provider}
                </td>
                <td className="py-2.5 pr-3 text-[var(--color-text-secondary)]">
                  {agent.model}
                </td>
                <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">
                  {formatCount(agent.requestsLastHour)}
                </td>
                <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">
                  {formatCount(agent.deniedLastHour)}
                </td>
                <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">
                  {formatLatency(agent.avgLatencyMs)}
                </td>
                <td className="py-2.5">
                  <StatusBadge status={agent.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AgentMatrixPanel;
