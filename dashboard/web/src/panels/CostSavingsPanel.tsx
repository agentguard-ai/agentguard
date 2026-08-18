'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { formatDollar } from '@/utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Optimization {
  description: string;
  savings: number;
}

export interface CostSavingsData {
  totalMonthlySavings: number;
  optimizations: Optimization[];
}

// ─── OptimizationItem ────────────────────────────────────────────────────────

interface OptimizationItemProps {
  optimization: Optimization;
}

function OptimizationItem({ optimization }: OptimizationItemProps) {
  const truncatedDescription =
    optimization.description.length > 120
      ? optimization.description.slice(0, 120) + '…'
      : optimization.description;

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30 px-3 py-2"
      data-testid="optimization-item"
    >
      <span
        className="text-sm text-[var(--color-text-primary)] mr-2"
        title={optimization.description.length > 120 ? optimization.description : undefined}
      >
        {truncatedDescription}
      </span>
      <span className="text-sm font-semibold text-[var(--kpi-trend-down,#22c55e)] whitespace-nowrap">
        {formatDollar(optimization.savings)}
      </span>
    </div>
  );
}

// ─── CostSavingsPanelContent ─────────────────────────────────────────────────

function CostSavingsPanelContent() {
  const { data, isLoading, error } = useCachedQuery<CostSavingsData>({
    endpoint: '/api/v1/costs/savings',
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="cost-savings-loading">
        <div className="panel-header">
          <span>Cost Savings</span>
        </div>
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="cost-savings-error">
        <div className="panel-header">
          <span>Cost Savings</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load cost savings data
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.optimizations.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="cost-savings-empty">
        <div className="panel-header">
          <span>Cost Savings</span>
        </div>
        <EmptyState
          panelType="table"
          message="No cost saving opportunities identified for the selected time range."
        />
      </div>
    );
  }

  // Data loaded
  // Sort by savings descending, limit to 20 items
  const sortedOptimizations = [...data.optimizations]
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 20);

  return (
    <div
      className="panel flex flex-col"
      data-testid="cost-savings-panel"
      aria-label={`Cost Savings: ${formatDollar(data.totalMonthlySavings)} potential monthly savings`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Cost Savings</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {sortedOptimizations.length} optimization{sortedOptimizations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Total Savings */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[var(--color-accent)]">
          {formatDollar(data.totalMonthlySavings)}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          potential monthly savings
        </span>
      </div>

      {/* Optimizations Breakdown */}
      <div className="flex flex-col gap-2" role="list" aria-label="Cost optimizations list">
        {sortedOptimizations.map((opt) => (
          <div key={opt.description} role="listitem">
            <OptimizationItem optimization={opt} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CostSavingsPanel (exported panel) ───────────────────────────────────────

/**
 * CostSavingsPanel — Displays total potential monthly savings and
 * a breakdown of eligible optimizations.
 *
 * - Fetches from `/api/v1/costs/savings`
 * - Formats total savings via `formatDollar`
 * - Sorts optimizations by savings descending
 * - Limits to 20 recommendations
 * - Truncates descriptions to 120 characters
 * - Wrapped in PanelErrorBoundary for error isolation
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 12.4
 */
export function CostSavingsPanel() {
  return (
    <PanelErrorBoundary panelName="Cost Savings">
      <CostSavingsPanelContent />
    </PanelErrorBoundary>
  );
}

export default CostSavingsPanel;
