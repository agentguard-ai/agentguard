'use client';

import dynamic from 'next/dynamic';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { useTimeRange } from '../hooks/useTimeRange';
import { PanelErrorBoundary } from '../components/PanelErrorBoundary';
import { EmptyState } from '../components/EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BudgetForecastData {
  percentConsumed: number;
  projectedExhaustionDate: string;
  daysRemaining: number;
  dailyBurnRate: number;
}

// ─── Donut Chart (SVG-based) ─────────────────────────────────────────────────

interface DonutChartProps {
  percentConsumed: number;
}

/**
 * SVG donut chart rendering the percentage consumed as a filled arc.
 * Uses stroke-dasharray/dashoffset for the arc technique.
 */
export function DonutChart({ percentConsumed }: DonutChartProps) {
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percentConsumed));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-bg-tertiary)"
        strokeWidth={strokeWidth}
      />
      {/* Consumed arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-[var(--color-text-primary)] text-lg font-bold"
        fontSize="18"
        fontWeight="bold"
      >
        {Math.round(clampedPercent)}%
      </text>
    </svg>
  );
}

// ─── Budget Forecast Content ─────────────────────────────────────────────────

interface BudgetForecastContentProps {
  data: BudgetForecastData;
}

export function BudgetForecastContent({ data }: BudgetForecastContentProps) {
  const { percentConsumed, projectedExhaustionDate, daysRemaining, dailyBurnRate } = data;

  const formattedDate = new Date(projectedExhaustionDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const ariaLabel = `Budget forecast donut chart showing ${Math.round(percentConsumed)}% consumed, projected exhaustion in ${daysRemaining} days at $${dailyBurnRate.toFixed(2)} daily burn rate`;

  return (
    <div
      className="flex flex-1 items-center gap-6 p-4"
      role="img"
      aria-label={ariaLabel}
    >
      <DonutChart percentConsumed={percentConsumed} />

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Projected Exhaustion</p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formattedDate}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Days Remaining</p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {daysRemaining} <span className="text-xs font-normal text-[var(--color-text-secondary)]">days</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Daily Burn Rate</p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            ${dailyBurnRate.toFixed(2)} <span className="text-xs font-normal text-[var(--color-text-secondary)]">/day</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Dynamically loaded chart component (lazy-loaded, no SSR) ────────────────

const DynamicBudgetForecastContent = dynamic(
  () => Promise.resolve({ default: BudgetForecastContent }),
  {
    ssr: false,
    loading: () => {
      // Inline skeleton loader to avoid circular import issues with dynamic
      return (
        <div
          className="animate-pulse rounded-panel bg-[var(--color-bg-secondary)] p-panel h-[300px] flex flex-col"
          role="status"
          aria-label="Loading chart"
        >
          <div className="h-4 w-40 rounded bg-[var(--color-bg-tertiary)] mb-4" />
          <div className="flex-1 flex items-end gap-2 pb-4">
            <div className="h-[40%] w-full rounded bg-[var(--color-bg-tertiary)]" />
          </div>
        </div>
      );
    },
  }
);

// ─── Main Panel Component ────────────────────────────────────────────────────

/**
 * BudgetForecastChartInner — Internal panel component that fetches and renders
 * the budget forecast donut chart.
 *
 * Consumes `useCachedQuery('/api/v1/metrics/budget-forecast')` with time range params.
 * Renders a donut chart showing percentage consumed, projected exhaustion date,
 * days remaining, and daily burn rate.
 *
 * Requirements: 5.1, 5.3, 15.4, 16.5
 */
function BudgetForecastChartInner() {
  const { timeRange } = useTimeRange();

  const { data, isLoading, error } = useCachedQuery<BudgetForecastData>({
    endpoint: '/api/v1/metrics/budget-forecast',
    params: {
      start: String(timeRange.start),
      end: String(timeRange.end),
    },
  });

  if (isLoading) {
    return (
      <div className="panel flex min-h-[300px] flex-col">
        <div className="panel-header">
          <span>Budget Exhaustion Forecast</span>
        </div>
        <div
          className="animate-pulse flex-1 flex flex-col p-4"
          role="status"
          aria-label="Loading chart"
        >
          <div className="flex-1 flex items-center justify-center">
            <div className="h-[120px] w-[120px] rounded-full bg-[var(--color-bg-tertiary)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex min-h-[300px] flex-col">
        <div className="panel-header">
          <span>Budget Exhaustion Forecast</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <p className="text-sm text-[var(--color-danger)]">Failed to load budget forecast data</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="panel flex min-h-[300px] flex-col"
        aria-label="Budget Exhaustion Forecast chart: no data available"
      >
        <div className="panel-header">
          <span>Budget Exhaustion Forecast</span>
        </div>
        <EmptyState
          panelType="chart"
          message="No budget forecast data available for the selected time range"
        />
      </div>
    );
  }

  return (
    <div
      className="panel flex min-h-[300px] flex-col"
      aria-label={`Budget Exhaustion Forecast: donut chart showing ${Math.round(data.percentConsumed)}% consumed, ${data.daysRemaining} days remaining at $${data.dailyBurnRate.toFixed(2)}/day burn rate`}
    >
      <div className="panel-header">
        <span>Budget Exhaustion Forecast</span>
      </div>
      <DynamicBudgetForecastContent data={data} />
    </div>
  );
}

// ─── Exported Panel (wrapped in PanelErrorBoundary) ──────────────────────────

/**
 * BudgetForecastChart — The exported panel component wrapped in PanelErrorBoundary.
 *
 * Provides error isolation so that if this chart throws a render error,
 * the rest of the dashboard remains functional.
 *
 * Requirements: 5.1, 5.3, 11.1, 15.4, 16.5
 */
export function BudgetForecastChart() {
  return (
    <PanelErrorBoundary panelName="Budget Forecast">
      <BudgetForecastChartInner />
    </PanelErrorBoundary>
  );
}

export default BudgetForecastChart;
