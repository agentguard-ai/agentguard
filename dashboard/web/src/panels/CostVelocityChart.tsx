'use client';

import dynamic from 'next/dynamic';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useTimeRange } from '@/hooks/useTimeRange';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CostVelocityData {
  timeSeries: { timestamp: number; cost: number }[];
  burnRate: number;
  threshold: number;
  velocityAlert: boolean;
}

// ─── Lazy-loaded Chart Visualization ─────────────────────────────────────────

/**
 * The chart visualization component is loaded via next/dynamic with ssr: false
 * to keep charting dependencies out of the initial bundle.
 *
 * Requirements: 16.5
 */
const CostVelocityLineChart = dynamic(
  () => import('./CostVelocityLineChart').then((mod) => ({ default: mod.CostVelocityLineChart })),
  {
    ssr: false,
    loading: () => <SkeletonLoader variant="chart" />,
  }
);

// ─── VelocityAlertBadge ──────────────────────────────────────────────────────

interface VelocityAlertBadgeProps {
  burnRate: number;
  threshold: number;
  velocityAlert: boolean;
}

/**
 * Displays a warning badge when the cost velocity exceeds the threshold.
 * Uses --color-warning for the badge color.
 * Includes text label alongside color for accessibility (Requirement 15.6).
 *
 * Requirements: 5.4
 */
export function VelocityAlertBadge({ burnRate, threshold, velocityAlert }: VelocityAlertBadgeProps) {
  const isOverThreshold = velocityAlert || burnRate > threshold;

  if (!isOverThreshold) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-warning)]"
      data-testid="velocity-alert-badge"
      role="status"
      aria-label={`Velocity alert: burn rate $${burnRate.toFixed(2)}/hr exceeds threshold $${threshold.toFixed(2)}/hr`}
    >
      {/* Warning icon */}
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
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <span>Velocity Alert</span>
    </span>
  );
}

// ─── CostVelocityChartContent ────────────────────────────────────────────────

/**
 * Inner content of the CostVelocityChart panel.
 * Handles data fetching, loading state, and rendering.
 */
function CostVelocityChartContent() {
  const { timeRange } = useTimeRange();

  const { data, isLoading, error } = useCachedQuery<CostVelocityData>({
    endpoint: '/api/v1/metrics/cost-velocity',
    params: {
      start: timeRange.start,
      end: timeRange.end,
    },
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="cost-velocity-loading" aria-label="Cost Velocity chart: loading data">
        <div className="panel-header">
          <span>Cost Velocity</span>
        </div>
        <SkeletonLoader variant="chart" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="cost-velocity-error" aria-label="Cost Velocity chart: error loading data">
        <div className="panel-header">
          <span>Cost Velocity</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load cost velocity data
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="panel flex flex-col" data-testid="cost-velocity-empty" aria-label="Cost Velocity chart: no data available">
        <div className="panel-header">
          <span>Cost Velocity</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No cost velocity data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="panel flex flex-col"
      data-testid="cost-velocity-chart"
      aria-label={`Cost Velocity chart: line chart showing cost over time with burn rate $${data.burnRate.toFixed(2)}/hr and threshold $${data.threshold.toFixed(2)}/hr`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Cost Velocity</span>
        <VelocityAlertBadge
          burnRate={data.burnRate}
          threshold={data.threshold}
          velocityAlert={data.velocityAlert}
        />
      </div>

      {/* Burn Rate & Threshold Summary */}
      <div className="mb-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-secondary)]">Burn Rate:</span>
          <span className="font-medium text-[var(--color-text-primary)]" data-testid="burn-rate-value">
            ${data.burnRate.toFixed(2)}/hr
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-secondary)]">Threshold:</span>
          <span className="font-medium text-[var(--color-text-primary)]" data-testid="threshold-value">
            ${data.threshold.toFixed(2)}/hr
          </span>
        </div>
      </div>

      {/* Lazy-loaded line chart */}
      <CostVelocityLineChart
        timeSeries={data.timeSeries}
        threshold={data.threshold}
      />
    </div>
  );
}

// ─── CostVelocityChart (exported panel) ──────────────────────────────────────

/**
 * CostVelocityChart panel — Displays a line chart showing cost over time,
 * burn rate value, threshold reference line, and velocity alert badge.
 *
 * Wrapped in PanelErrorBoundary for error isolation.
 * Chart library is lazy-loaded via next/dynamic with ssr: false.
 *
 * Requirements: 5.1, 5.2, 5.4, 16.5
 */
export function CostVelocityChart() {
  return (
    <PanelErrorBoundary panelName="Cost Velocity">
      <CostVelocityChartContent />
    </PanelErrorBoundary>
  );
}

export default CostVelocityChart;
