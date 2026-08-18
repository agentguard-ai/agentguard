'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataStream } from '../hooks/useDataStream';
import { useTimeRange } from '../hooks/useTimeRange';
import { useAuth } from '../hooks/useAuth';
import type {
  CostSummaryResponse,
  CostSparklineResponse,
  CostBreakdownResponse,
  StreamEvent,
} from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetCategory {
  label: string;
  total: number;
  budget: number | null;
  utilization: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';
}

/**
 * Determine the color class for a budget utilization bar.
 * - utilization < 0.8 → teal/green (normal)
 * - utilization >= 0.8 and < 0.95 → amber (warning)
 * - utilization >= 0.95 → red (critical)
 */
export function getUtilizationColor(utilization: number | null): string {
  if (utilization === null) return 'bg-[var(--color-accent)]';
  if (utilization >= 0.95) return 'bg-[var(--color-danger)]';
  if (utilization >= 0.8) return 'bg-[var(--color-warning)]';
  return 'bg-[var(--color-accent)]';
}

/**
 * Determine the text color class for a budget utilization label.
 */
export function getUtilizationTextColor(utilization: number | null): string {
  if (utilization === null) return 'text-[var(--color-accent)]';
  if (utilization >= 0.95) return 'text-[var(--color-danger)]';
  if (utilization >= 0.8) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-accent)]';
}

/**
 * Format a cost value as currency string.
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format a percentage for display.
 */
function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

// ─── Sparkline SVG Component ─────────────────────────────────────────────────

function Sparkline({ dataPoints }: { dataPoints: { timestamp: number; cost: number }[] }) {
  if (dataPoints.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-[var(--color-text-secondary)]">
        Not enough data for sparkline
      </div>
    );
  }

  const width = 320;
  const height = 80;
  const padding = 4;

  const costs = dataPoints.map((d) => d.cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const range = maxCost - minCost || 1;

  const points = dataPoints.map((d, i) => {
    const x = padding + (i / (dataPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.cost - minCost) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');

  // Create area fill path
  const firstX = padding;
  const lastX = padding + ((dataPoints.length - 1) / (dataPoints.length - 1)) * (width - 2 * padding);
  const areaPath = `M ${firstX},${height - padding} L ${points.map((p) => p).join(' L ')} L ${lastX},${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-24 w-full"
      role="img"
      aria-label="Cost per request sparkline chart"
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-gradient)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Budget Utilization Bar Component ────────────────────────────────────────

function BudgetBar({ category }: { category: BudgetCategory }) {
  const { label, total, budget, utilization } = category;
  const barColor = getUtilizationColor(utilization);
  const textColor = getUtilizationTextColor(utilization);
  const barWidth = utilization !== null ? Math.min(utilization * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className={textColor}>
          {formatCost(total)}
          {budget !== null && (
            <span className="text-[var(--color-text-secondary)]"> / {formatCost(budget)}</span>
          )}
        </span>
      </div>
      {budget !== null && utilization !== null ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${barWidth}%` }}
            role="progressbar"
            aria-valuenow={Math.round(utilization * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} budget utilization ${formatPercent(utilization)}`}
          />
        </div>
      ) : (
        <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)]">
          <div className="h-full w-0 rounded-full" />
        </div>
      )}
      {utilization !== null && (
        <div className={`text-right text-[10px] ${textColor}`}>
          {formatPercent(utilization)}
        </div>
      )}
    </div>
  );
}

// ─── CostTrackerPanel Component ──────────────────────────────────────────────

/**
 * CostTrackerPanel — Displays running cost totals, budget utilization bars,
 * cost-per-request sparkline, reconciliation alerts, and cost breakdown by
 * provider/model.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export function CostTrackerPanel() {
  const { timeRange } = useTimeRange();
  const { getAuthHeaders } = useAuth();

  // ─── State ─────────────────────────────────────────────────────────────

  const [summary, setSummary] = useState<CostSummaryResponse | null>(null);
  const [sparkline, setSparkline] = useState<CostSparklineResponse | null>(null);
  const [breakdown, setBreakdown] = useState<CostBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const baseUrl = getApiBaseUrl();
    const headers = getAuthHeaders();
    const params = new URLSearchParams({
      start: String(timeRange.start),
      end: String(timeRange.end),
    });

    try {
      setError(null);

      const [summaryRes, sparklineRes, breakdownRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/costs/summary?${params}`, { headers }),
        fetch(`${baseUrl}/api/v1/costs/sparkline?${params}&resolution=minute`, { headers }),
        fetch(`${baseUrl}/api/v1/costs/breakdown?${params}`, { headers }),
      ]);

      if (!summaryRes.ok || !sparklineRes.ok || !breakdownRes.ok) {
        const failedRes = [summaryRes, sparklineRes, breakdownRes].find((r) => !r.ok);
        throw new Error(`API error: ${failedRes?.status} ${failedRes?.statusText}`);
      }

      const [summaryData, sparklineData, breakdownData] = await Promise.all([
        summaryRes.json() as Promise<CostSummaryResponse>,
        sparklineRes.json() as Promise<CostSparklineResponse>,
        breakdownRes.json() as Promise<CostBreakdownResponse>,
      ]);

      setSummary(summaryData);
      setSparkline(sparklineData);
      setBreakdown(breakdownData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost data');
    } finally {
      setLoading(false);
    }
  }, [timeRange, getAuthHeaders]);

  // Initial fetch and re-fetch on time range change
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // ─── Real-time Updates via WebSocket (Req 4.6) ─────────────────────────

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'cost_update') {
        // Refresh summary data when a cost update arrives
        fetchData();
      }
    },
    [fetchData],
  );

  const { status: streamStatus } = useDataStream({
    channels: ['cost'],
    onEvent: handleStreamEvent,
  });

  // ─── Budget Categories ─────────────────────────────────────────────────

  const budgetCategories: BudgetCategory[] = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Session', ...summary.session },
      { label: 'Daily', ...summary.daily },
      { label: 'Agent', ...summary.agent },
    ];
  }, [summary]);

  // ─── Loading State ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Cost Tracker</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-[var(--color-text-secondary)]">Loading cost data...</div>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Cost Tracker</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-white hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────────────────────────

  if (!summary) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Cost Tracker</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No cost data available</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span>Cost Tracker</span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-[var(--color-text-secondary)]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              streamStatus === 'connected'
                ? 'bg-[var(--color-success)]'
                : streamStatus === 'reconnecting'
                  ? 'bg-[var(--color-warning)]'
                  : 'bg-[var(--color-danger)]'
            }`}
          />
          {streamStatus === 'connected' ? 'Live' : streamStatus === 'reconnecting' ? 'Reconnecting' : 'Disconnected'}
        </span>
      </div>

      {/* Cost Summary - Running Totals (Req 4.1) */}
      <section aria-label="Cost summary totals" className="mb-4">
        <div className="grid grid-cols-3 gap-3">
          {budgetCategories.map((cat) => (
            <div key={cat.label} className="rounded bg-[var(--color-bg-tertiary)] p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                {cat.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
                {formatCost(cat.total)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Budget Utilization Bars (Req 4.2, 4.7) */}
      <section aria-label="Budget utilization" className="mb-4 space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)]">Budget Utilization</h3>
        {budgetCategories.map((cat) => (
          <BudgetBar key={cat.label} category={cat} />
        ))}
      </section>

      {/* Sparkline Chart (Req 4.3) */}
      <section aria-label="Cost per request trend" className="mb-4">
        <h3 className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
          Cost per Request (1-min resolution)
        </h3>
        <Sparkline dataPoints={sparkline?.dataPoints || []} />
      </section>

      {/* Cost Breakdown by Provider/Model (Req 4.5) */}
      {breakdown && breakdown.breakdown.length > 0 && (
        <section aria-label="Cost breakdown by provider and model" className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Breakdown by Provider / Model
          </h3>
          <div className="overflow-hidden rounded border border-[var(--color-border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                  <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                    Provider
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                    Model
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium text-[var(--color-text-secondary)]">
                    Cost
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium text-[var(--color-text-secondary)]">
                    Requests
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.breakdown.map((entry, idx) => (
                  <tr
                    key={`${entry.provider}-${entry.model}-${idx}`}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-2 py-1.5 text-[var(--color-text-primary)]">{entry.provider}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{entry.model}</td>
                    <td className="px-2 py-1.5 text-right text-[var(--color-text-primary)]">
                      {formatCost(entry.totalCost)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[var(--color-text-secondary)]">
                      {entry.requestCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reconciliation Alerts (Req 4.4) */}
      {summary.reconciliationAlerts.length > 0 && (
        <section aria-label="Reconciliation alerts" className="mt-auto">
          <h3 className="mb-2 text-xs font-medium text-[var(--color-warning)]">
            ⚠ Reconciliation Alerts ({summary.reconciliationAlerts.length})
          </h3>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {summary.reconciliationAlerts.map((alert) => (
              <div
                key={alert.correlationId}
                className="rounded border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[var(--color-text-secondary)]">
                    {alert.correlationId.slice(0, 8)}...
                  </span>
                  <span className="text-[var(--color-text-secondary)]">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 text-[var(--color-text-primary)]">
                  Estimated: {formatCost(alert.estimatedCost)} → Actual: {formatCost(alert.actualCost)}
                  <span className="ml-1 text-[var(--color-text-secondary)]">
                    (tolerance: {(alert.tolerance * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default CostTrackerPanel;
