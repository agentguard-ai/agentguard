'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTimeRange } from '@/hooks/useTimeRange';
import { useAuth } from '@/hooks/useAuth';
import type { ModuleHealthEntry, ModuleHealthResponse } from '../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortColumn =
  | 'name'
  | 'version'
  | 'evaluationCount'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'errorRate'
  | 'timeoutRate';

type SortOrder = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/** Color class for error/timeout rate thresholds */
function getRateColorClass(rate: number): string {
  if (rate >= 0.10) return 'text-[var(--color-danger)]';
  if (rate >= 0.05) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-success)]';
}

/** Format a rate as percentage string */
function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Format latency in ms */
function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

/** Get trend indicator */
function getTrendIndicator(trend: 'improving' | 'stable' | 'degrading'): {
  symbol: string;
  className: string;
  label: string;
} {
  switch (trend) {
    case 'improving':
      return { symbol: '↑', className: 'text-[var(--color-success)]', label: 'Improving' };
    case 'stable':
      return { symbol: '→', className: 'text-[var(--color-text-secondary)]', label: 'Stable' };
    case 'degrading':
      return { symbol: '↓', className: 'text-[var(--color-danger)]', label: 'Degrading' };
  }
}

/** Get the sort value for a module entry given a column */
function getSortValue(entry: ModuleHealthEntry, column: SortColumn): string | number {
  switch (column) {
    case 'name':
      return entry.name.toLowerCase();
    case 'version':
      return entry.version;
    case 'evaluationCount':
      return entry.evaluationCount;
    case 'p50':
      return entry.latency.p50;
    case 'p95':
      return entry.latency.p95;
    case 'p99':
      return entry.latency.p99;
    case 'errorRate':
      return entry.errorRate;
    case 'timeoutRate':
      return entry.timeoutRate;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ModuleHealthPanel — Displays per-module performance metrics including
 * latency percentiles, error rates, timeout rates, action distributions,
 * trend indicators, and near-timeout warnings.
 *
 * @validates Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export function ModuleHealthPanel() {
  const { timeRange } = useTimeRange();
  const { getAuthHeaders, handleAuthError } = useAuth();

  const [modules, setModules] = useState<ModuleHealthEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // ─── Data fetching ─────────────────────────────────────────────────────

  const fetchModuleHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('/api/v1/modules/health', getApiBaseUrl());
      url.searchParams.set('startTime', String(timeRange.start));
      url.searchParams.set('endTime', String(timeRange.end));
      url.searchParams.set('sortBy', sortBy);
      url.searchParams.set('sortOrder', sortOrder);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError(response.status);
        throw new Error(`Authentication error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const data: ModuleHealthResponse = await response.json();
      setModules(data.modules);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange.start, timeRange.end, sortBy, sortOrder, getAuthHeaders, handleAuthError]);

  useEffect(() => {
    fetchModuleHealth();
  }, [fetchModuleHealth]);

  // ─── Client-side sorting ───────────────────────────────────────────────

  const sortedModules = useMemo(() => {
    const sorted = [...modules].sort((a, b) => {
      const aVal = getSortValue(a, sortBy);
      const bVal = getSortValue(b, sortBy);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [modules, sortBy, sortOrder]);

  // ─── Sort handler ──────────────────────────────────────────────────────

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setSortOrder('asc');
      }
    },
    [sortBy],
  );

  // ─── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Module Health</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading module health data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Module Health</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load module health data
          </p>
          <button
            onClick={fetchModuleHealth}
            className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-white hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sortedModules.length === 0) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Module Health</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No module data in selected time range
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span>Module Health</span>
        <span className="text-xs font-normal text-[var(--color-text-secondary)]">
          {sortedModules.length} module{sortedModules.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" role="grid" aria-label="Module health metrics">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <SortableHeader
                label="Module"
                column="name"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Version"
                column="version"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Evals"
                column="evaluationCount"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="p50"
                column="p50"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="p95"
                column="p95"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="p99"
                column="p99"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Error Rate"
                column="errorRate"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Timeout Rate"
                column="timeoutRate"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <th className="px-2 py-2 font-medium" scope="col">Actions</th>
              <th className="px-2 py-2 font-medium" scope="col">Trend</th>
              <th className="px-2 py-2 font-medium" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedModules.map((module) => (
              <ModuleRow key={`${module.name}-${module.version}`} module={module} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Sortable column header with ARIA attributes for accessibility */
function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentOrder: SortOrder;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = currentSort === column;
  const ariaSortValue = isActive
    ? currentOrder === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th
      scope="col"
      className="cursor-pointer select-none px-2 py-2 font-medium hover:text-[var(--color-text-primary)]"
      aria-sort={ariaSortValue as 'ascending' | 'descending' | 'none'}
      onClick={() => onSort(column)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(column);
        }
      }}
      tabIndex={0}
      role="columnheader"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span aria-hidden="true" className="text-[var(--color-accent)]">
            {currentOrder === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </span>
    </th>
  );
}

/** Individual module row with all metrics, action distribution, trend, and status */
function ModuleRow({ module }: { module: ModuleHealthEntry }) {
  const latencyTrend = getTrendIndicator(module.trend.latency);
  const errorTrend = getTrendIndicator(module.trend.errorRate);

  // Compute action distribution bar widths
  const totalActions =
    module.actionDistribution.ALLOW +
    module.actionDistribution.DENY +
    module.actionDistribution.MONITOR;

  const allowPct = totalActions > 0 ? (module.actionDistribution.ALLOW / totalActions) * 100 : 0;
  const denyPct = totalActions > 0 ? (module.actionDistribution.DENY / totalActions) * 100 : 0;
  const monitorPct = totalActions > 0 ? (module.actionDistribution.MONITOR / totalActions) * 100 : 0;

  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-tertiary)]/30">
      {/* Module Name */}
      <td className="px-2 py-2 font-medium text-[var(--color-text-primary)]">
        {module.name}
      </td>

      {/* Version */}
      <td className="px-2 py-2 text-[var(--color-text-secondary)]">
        {module.version}
      </td>

      {/* Evaluation Count */}
      <td className="px-2 py-2 text-[var(--color-text-secondary)]">
        {module.evaluationCount.toLocaleString()}
      </td>

      {/* p50 */}
      <td className="px-2 py-2 font-mono text-[var(--color-text-secondary)]">
        {formatLatency(module.latency.p50)}
      </td>

      {/* p95 */}
      <td className="px-2 py-2 font-mono text-[var(--color-text-secondary)]">
        {formatLatency(module.latency.p95)}
      </td>

      {/* p99 */}
      <td className="px-2 py-2 font-mono text-[var(--color-text-secondary)]">
        {formatLatency(module.latency.p99)}
      </td>

      {/* Error Rate */}
      <td className={`px-2 py-2 font-mono ${getRateColorClass(module.errorRate)}`}>
        {formatRate(module.errorRate)}
      </td>

      {/* Timeout Rate */}
      <td className={`px-2 py-2 font-mono ${getRateColorClass(module.timeoutRate)}`}>
        {formatRate(module.timeoutRate)}
      </td>

      {/* Action Distribution (stacked bar) */}
      <td className="px-2 py-2">
        <ActionDistributionBar
          allowPct={allowPct}
          denyPct={denyPct}
          monitorPct={monitorPct}
        />
      </td>

      {/* Trend */}
      <td className="px-2 py-2">
        <div className="flex flex-col gap-0.5">
          <span
            className={`inline-flex items-center gap-1 ${latencyTrend.className}`}
            title={`Latency: ${latencyTrend.label}`}
          >
            <span aria-hidden="true">{latencyTrend.symbol}</span>
            <span className="sr-only">Latency {latencyTrend.label}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 ${errorTrend.className}`}
            title={`Error rate: ${errorTrend.label}`}
          >
            <span aria-hidden="true">{errorTrend.symbol}</span>
            <span className="sr-only">Error rate {errorTrend.label}</span>
          </span>
        </div>
      </td>

      {/* Status (Near-timeout warning) */}
      <td className="px-2 py-2">
        {module.nearTimeout ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-[var(--color-warning)]/20 px-1.5 py-0.5 text-[var(--color-warning)]"
            role="alert"
            aria-label="Near timeout warning"
          >
            <span aria-hidden="true">⚠</span>
            Near timeout
          </span>
        ) : (
          <span className="text-[var(--color-success)]" aria-label="Healthy">
            ✓
          </span>
        )}
      </td>
    </tr>
  );
}

/** Stacked bar chart showing ALLOW/DENY/MONITOR proportions */
function ActionDistributionBar({
  allowPct,
  denyPct,
  monitorPct,
}: {
  allowPct: number;
  denyPct: number;
  monitorPct: number;
}) {
  const title = `ALLOW: ${allowPct.toFixed(1)}% | DENY: ${denyPct.toFixed(1)}% | MONITOR: ${monitorPct.toFixed(1)}%`;

  return (
    <div
      className="flex h-3 w-20 overflow-hidden rounded-sm"
      title={title}
      role="img"
      aria-label={`Action distribution: ${title}`}
    >
      {allowPct > 0 && (
        <div
          className="bg-[var(--color-success)]"
          style={{ width: `${allowPct}%` }}
        />
      )}
      {denyPct > 0 && (
        <div
          className="bg-[var(--color-danger)]"
          style={{ width: `${denyPct}%` }}
        />
      )}
      {monitorPct > 0 && (
        <div
          className="bg-[var(--color-warning)]"
          style={{ width: `${monitorPct}%` }}
        />
      )}
    </div>
  );
}

export default ModuleHealthPanel;
