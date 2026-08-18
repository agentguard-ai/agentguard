'use client';

import { useMemo } from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useTimeRange } from '@/hooks/useTimeRange';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { formatCount, formatDollar, calcPercentage } from '@/utils/formatters';
import { getMetricColorClass, getMetricAriaLabel, MetricCategory } from '@/utils/semanticColors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KPICard {
  id: string;
  title: string;
  value: string | number;
  colorCategory?: MetricCategory;
  trend?: { direction: 'up' | 'down'; percentage: number };
  subtitle?: string;
  progress?: { current: number; total: number };
}

export interface KPIResponse {
  totalRequests: { value: number; trend: number };
  totalCost: { value: number; trend: number };
  governanceDenials: { total: number; byCategory: Record<string, number> };
  monthlyBudget: { remaining: number; consumed: number; limit: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert raw API trend value to direction + percentage.
 * Positive trend = up, negative trend = down.
 */
function parseTrend(trend: number): KPICard['trend'] | undefined {
  if (trend === 0) return undefined;
  return {
    direction: trend > 0 ? 'up' : 'down',
    percentage: Math.abs(trend),
  };
}

/** Map color category to a human-readable status label for WCAG non-color compliance */
function getStatusLabel(category: MetricCategory): string {
  switch (category) {
    case 'positive':
      return 'Healthy';
    case 'danger':
      return 'Critical';
    case 'warning':
      return 'Warning';
    case 'neutral':
      return '';
  }
}

/**
 * Transform API response into KPICard array.
 */
export function transformKPIData(data: KPIResponse): KPICard[] {
  const { totalRequests, totalCost, governanceDenials, monthlyBudget } = data;

  // Build denial category breakdown subtitle
  const denialCategories = Object.entries(governanceDenials.byCategory)
    .map(([category, count]) => `${category}: ${count}`)
    .join(', ');

  return [
    {
      id: 'total-requests',
      title: 'Total Requests',
      value: formatCount(totalRequests.value),
      colorCategory: 'positive',
      trend: parseTrend(totalRequests.trend),
    },
    {
      id: 'total-cost',
      title: 'Total Cost',
      value: formatDollar(totalCost.value),
      colorCategory: 'neutral',
      trend: parseTrend(totalCost.trend),
    },
    {
      id: 'governance-denials',
      title: 'Governance Denials',
      value: formatCount(governanceDenials.total),
      colorCategory: 'danger',
      subtitle: denialCategories || undefined,
    },
    {
      id: 'monthly-budget',
      title: 'Monthly Budget',
      value: formatDollar(monthlyBudget.remaining),
      colorCategory: 'warning',
      subtitle: `of ${formatDollar(monthlyBudget.limit)} limit`,
      progress: { current: monthlyBudget.consumed, total: monthlyBudget.limit },
    },
  ];
}

// ─── TrendIndicator ──────────────────────────────────────────────────────────

interface TrendIndicatorProps {
  trend: NonNullable<KPICard['trend']>;
}

/**
 * Renders an arrow icon with percentage value for trend display.
 * Includes text label alongside color for accessibility (Requirement 2.4).
 *
 * Requirements: 2.4
 */
export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const isUp = trend.direction === 'up';
  const colorClass = isUp
    ? 'text-[var(--kpi-trend-up,#22c55e)]'
    : 'text-[var(--kpi-trend-down,#ef4444)]';
  const arrowLabel = isUp ? 'Increase' : 'Decrease';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}
      data-testid={`trend-${trend.direction}`}
      aria-label={`${arrowLabel} ${trend.percentage}%`}
    >
      {/* Arrow icon */}
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isUp ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
      {/* Percentage value */}
      <span>{trend.percentage}%</span>
      {/* Screen-reader-only direction label */}
      <span className="sr-only">{arrowLabel}</span>
    </span>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  current: number;
  total: number;
}

/**
 * Horizontal progress bar indicating budget consumption percentage.
 * Uses `calcPercentage` from shared formatters for consistent clamped calculation.
 *
 * Requirements: 3.5
 */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = calcPercentage(current, total);

  return (
    <div className="w-full" data-testid="progress-bar">
      <div
        className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary,#1e293b)] overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget consumed: ${percentage}%`}
      >
        <div
          className="h-full rounded-full bg-[var(--color-accent,#14b8a6)] transition-all duration-300"
          style={{ width: `${percentage}%` }}
          data-testid="progress-bar-fill"
        />
      </div>
    </div>
  );
}

// ─── KPICardComponent ────────────────────────────────────────────────────────

interface KPICardComponentProps {
  card: KPICard;
}

/**
 * Individual KPI metric card rendering.
 * Applies semantic color classes and pairs each color indicator with a text label
 * for WCAG non-color accessibility compliance.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
function KPICardComponent({ card }: KPICardComponentProps) {
  const colorClass = card.colorCategory ? getMetricColorClass(card.colorCategory) : '';
  const statusLabel = card.colorCategory ? getStatusLabel(card.colorCategory) : '';
  const ariaLabel = card.colorCategory
    ? getMetricAriaLabel(card.colorCategory, String(card.value))
    : `${card.title}: ${card.value}`;

  return (
    <article
      className="rounded-panel bg-[var(--color-bg-secondary,#111827)] border border-[rgba(255,255,255,var(--panel-border-opacity,0.15))] p-panel flex flex-col gap-2"
      data-testid={`kpi-card-${card.id}`}
      aria-label={ariaLabel}
    >
      {/* Card title */}
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]">
        {card.title}
      </h3>

      {/* Primary value with semantic color */}
      <p
        className={`text-2xl font-bold ${colorClass || 'text-[var(--color-text-primary,#f9fafb)]'}`}
        data-testid={`kpi-value-${card.id}`}
      >
        {card.value}
      </p>

      {/* WCAG non-color text label paired with the color indicator */}
      {statusLabel && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}
          data-testid={`kpi-status-${card.id}`}
        >
          <span aria-hidden="true">●</span>
          <span>{statusLabel}</span>
        </span>
      )}

      {/* Trend indicator */}
      {card.trend && <TrendIndicator trend={card.trend} />}

      {/* Progress bar (budget card) */}
      {card.progress && (
        <ProgressBar current={card.progress.current} total={card.progress.total} />
      )}

      {/* Subtitle / category breakdown */}
      {card.subtitle && (
        <p className="text-xs text-[var(--color-text-secondary,#9ca3af)] truncate" title={card.subtitle}>
          {card.subtitle}
        </p>
      )}
    </article>
  );
}

// ─── KPIBannerRow ────────────────────────────────────────────────────────────

/**
 * KPIBannerRow — Displays 4 KPI metric cards in a responsive grid.
 *
 * Layout:
 * - ≥ 1600px: 4-column single row
 * - < 1600px: 2x2 grid
 *
 * Data source: useCachedQuery('/api/v1/metrics/kpi') with useTimeRange() params.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
export function KPIBannerRow() {
  const { timeRange } = useTimeRange();

  const { data, isLoading, error, invalidate } = useCachedQuery<KPIResponse>({
    endpoint: '/api/v1/metrics/kpi',
    params: {
      start: timeRange.start,
      end: timeRange.end,
    },
  });

  // Transform API data to card models
  const cards = useMemo(() => {
    if (!data) return null;
    return transformKPIData(data);
  }, [data]);

  // Loading state: show 4 skeleton cards
  if (isLoading && !cards) {
    return (
      <section
        className="grid grid-cols-2 min-[1600px]:grid-cols-4 gap-4"
        aria-label="KPI metrics loading"
        data-testid="kpi-banner-loading"
      >
        {[...Array(4)].map((_, i) => (
          <SkeletonLoader key={i} variant="kpi-card" />
        ))}
      </section>
    );
  }

  // Error state with retry action
  if (error && !cards) {
    return (
      <section
        className="grid grid-cols-2 min-[1600px]:grid-cols-4 gap-4"
        aria-label="KPI metrics error"
        data-testid="kpi-banner-error"
      >
        <div className="col-span-full rounded-panel bg-[var(--color-bg-secondary)] border border-red-500/30 p-panel text-center">
          <p className="text-sm text-red-400" role="alert">Failed to load KPI metrics</p>
          <button
            onClick={() => invalidate()}
            className="mt-3 rounded-md bg-[var(--color-accent,#14b8a6)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
            aria-label="Retry loading KPI metrics"
            data-testid="kpi-banner-retry"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // No data state
  if (!cards) {
    return null;
  }

  return (
    <section
      className="grid grid-cols-2 min-[1600px]:grid-cols-4 gap-4"
      aria-label="Key performance indicators"
      data-testid="kpi-banner-row"
    >
      {cards.map((card) => (
        <KPICardComponent key={card.id} card={card} />
      ))}
    </section>
  );
}

/**
 * Default export wrapped in PanelErrorBoundary for fault isolation.
 * If a render error occurs, the boundary catches it without affecting other panels.
 *
 * Requirements: 12.8, 12.9
 */
export default function KPIBannerRowWithBoundary() {
  return (
    <PanelErrorBoundary panelName="KPI Metrics">
      <KPIBannerRow />
    </PanelErrorBoundary>
  );
}
