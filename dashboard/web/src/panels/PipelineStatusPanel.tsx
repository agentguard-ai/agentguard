'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDataStream } from '@/hooks/useDataStream';
import { useTimeRange } from '@/hooks/useTimeRange';
import type {
  PipelineStatusResponse,
  ModuleStatusEntry,
  PipelineDecisionSummary,
  StreamEvent,
} from '../../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_RECENT_DECISIONS_COUNT = 20;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';

// ─── Status Badge Colors ─────────────────────────────────────────────────────

const STATUS_BADGE_CLASSES: Record<PipelineStatusResponse['overallStatus'], string> = {
  HEALTHY: 'bg-[var(--color-success)] text-white',
  DEGRADED: 'bg-[var(--color-warning)] text-black',
  CRITICAL: 'bg-[var(--color-danger)] text-white',
};

const MODULE_STATUS_CLASSES: Record<ModuleStatusEntry['status'], string> = {
  healthy: 'bg-[var(--color-success)]',
  degraded: 'bg-[var(--color-warning)]',
  critical: 'bg-[var(--color-danger)]',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PipelineStatusPanel — Real-time view of the defense pipeline health.
 *
 * Displays:
 * - Overall pipeline status (HEALTHY / DEGRADED / CRITICAL)
 * - Failure policy (fail-closed / fail-open)
 * - Module counts per stage (PRE_EXECUTION, POST_EXECUTION)
 * - Per-module status with degradation highlighting
 * - Last N decisions with timing breakdown
 *
 * Updates in real-time via WebSocket (pipeline channel).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export function PipelineStatusPanel() {
  const { timeRange } = useTimeRange();
  const [data, setData] = useState<PipelineStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch pipeline status from REST API ─────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        start: String(timeRange.start),
        end: String(timeRange.end),
      });
      const response = await fetch(`${API_BASE_URL}/api/v1/pipeline/status?${params}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const result: PipelineStatusResponse = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pipeline status');
    } finally {
      setLoading(false);
    }
  }, [timeRange.start, timeRange.end]);

  // Fetch on mount and when time range changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─── Real-time updates via WebSocket ─────────────────────────────────────

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'pipeline_result' || event.type === 'state_sync') {
        // Refresh data when a new pipeline result arrives or on state sync
        fetchStatus();
      }
    },
    [fetchStatus]
  );

  const { status: connectionStatus } = useDataStream({
    channels: ['pipeline'],
    onEvent: handleStreamEvent,
  });

  // ─── Render states ───────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="panel flex min-h-[200px] flex-col" role="region" aria-label="Pipeline Status">
        <div className="panel-header">
          <span>Pipeline Status</span>
        </div>
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading pipeline status…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel flex min-h-[200px] flex-col" role="region" aria-label="Pipeline Status">
        <div className="panel-header">
          <span>Pipeline Status</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>
          <button
            onClick={fetchStatus}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="panel flex flex-col" role="region" aria-label="Pipeline Status">
      {/* Header */}
      <div className="panel-header">
        <span>Pipeline Status</span>
        <div className="flex items-center gap-2">
          <ConnectionDot status={connectionStatus} />
        </div>
      </div>

      {/* Overall Status + Failure Policy */}
      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={data.overallStatus} />
        <FailurePolicyLabel policy={data.failurePolicy} />
      </div>

      {/* Module Counts by Stage */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StageSection
          title="PRE_EXECUTION"
          modules={data.modules.preExecution}
        />
        <StageSection
          title="POST_EXECUTION"
          modules={data.modules.postExecution}
        />
      </div>

      {/* Recent Decisions Table */}
      <RecentDecisionsTable decisions={data.recentDecisions} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PipelineStatusResponse['overallStatus'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE_CLASSES[status]}`}
      role="status"
      aria-label={`Pipeline status: ${status}`}
    >
      {status}
    </span>
  );
}

function FailurePolicyLabel({ policy }: { policy: PipelineStatusResponse['failurePolicy'] }) {
  return (
    <span
      className="inline-flex items-center rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
      aria-label={`Failure policy: ${policy}`}
    >
      {policy}
    </span>
  );
}

function StageSection({
  title,
  modules,
}: {
  title: string;
  modules: ModuleStatusEntry[];
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          {modules.length} {modules.length === 1 ? 'module' : 'modules'}
        </span>
      </div>
      {modules.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)] italic">No modules registered</p>
      ) : (
        <ul className="space-y-1.5" aria-label={`${title} modules`}>
          {modules.map((mod) => (
            <ModuleStatusItem key={mod.name} module={mod} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ModuleStatusItem({ module }: { module: ModuleStatusEntry }) {
  const isDegraded = module.errorRate > 10 || module.timeoutRate > 5;

  return (
    <li
      className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
        isDegraded ? 'bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30' : ''
      }`}
      aria-label={`Module ${module.name}: ${module.status}${isDegraded ? ' (degraded)' : ''}`}
    >
      <div className="flex items-center gap-2">
        {/* Status indicator dot */}
        <span
          className={`inline-block h-2 w-2 rounded-full ${MODULE_STATUS_CLASSES[module.status]}`}
          aria-hidden="true"
        />
        <span className="font-medium text-[var(--color-text-primary)]">{module.name}</span>
        <span className="text-[var(--color-text-secondary)]">v{module.version}</span>
      </div>
      <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
        {isDegraded && (
          <span
            className="text-[var(--color-warning)] font-semibold"
            role="alert"
            aria-label={`Warning: ${module.name} is degraded`}
          >
            ⚠
          </span>
        )}
        <span title="Error rate">Err: {module.errorRate.toFixed(1)}%</span>
        <span title="Timeout rate">TO: {module.timeoutRate.toFixed(1)}%</span>
        <span title="Timeout count">×{module.timeoutCount}</span>
      </div>
    </li>
  );
}

function RecentDecisionsTable({ decisions }: { decisions: PipelineDecisionSummary[] }) {
  if (decisions.length === 0) {
    return (
      <div className="mt-2">
        <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Recent Decisions
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] italic">No recent decisions</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        Recent Decisions ({decisions.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Recent pipeline decisions with timing breakdown">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
              <th className="pb-1.5 pr-3 font-medium">Time</th>
              <th className="pb-1.5 pr-3 font-medium">Result</th>
              <th className="pb-1.5 pr-3 font-medium text-right">Pre (ms)</th>
              <th className="pb-1.5 pr-3 font-medium text-right">Exec (ms)</th>
              <th className="pb-1.5 pr-3 font-medium text-right">Post (ms)</th>
              <th className="pb-1.5 font-medium text-right">Total (ms)</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <DecisionRow key={decision.correlationId} decision={decision} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionRow({ decision }: { decision: PipelineDecisionSummary }) {
  const time = new Date(decision.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <tr className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-tertiary)]/50">
      <td className="py-1.5 pr-3 text-[var(--color-text-secondary)]">{time}</td>
      <td className="py-1.5 pr-3">
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            decision.allowed
              ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
              : 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
          }`}
        >
          {decision.allowed ? 'ALLOWED' : 'BLOCKED'}
        </span>
      </td>
      <td className="py-1.5 pr-3 text-right font-mono text-[var(--color-text-primary)]">
        {decision.preLatencyMs}
      </td>
      <td className="py-1.5 pr-3 text-right font-mono text-[var(--color-text-primary)]">
        {decision.executionLatencyMs ?? '—'}
      </td>
      <td className="py-1.5 pr-3 text-right font-mono text-[var(--color-text-primary)]">
        {decision.postLatencyMs ?? '—'}
      </td>
      <td className="py-1.5 text-right font-mono font-semibold text-[var(--color-text-primary)]">
        {decision.totalLatencyMs}
      </td>
    </tr>
  );
}

function ConnectionDot({ status }: { status: 'connected' | 'disconnected' | 'reconnecting' }) {
  const colors: Record<typeof status, string> = {
    connected: 'bg-[var(--color-success)]',
    disconnected: 'bg-[var(--color-danger)]',
    reconnecting: 'bg-[var(--color-warning)]',
  };

  const labels: Record<typeof status, string> = {
    connected: 'Live',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting…',
  };

  return (
    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} aria-hidden="true" />
      <span>{labels[status]}</span>
    </div>
  );
}

export default PipelineStatusPanel;
