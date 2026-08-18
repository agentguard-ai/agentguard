import type { SkeletonLoaderProps } from '@/config/navigation';

/**
 * SkeletonLoader component — renders pulsing placeholder shapes
 * matching the approximate dimensions of the expected panel content.
 *
 * Variants:
 * - kpi-card: ~120px height, compact card shape
 * - chart: ~300px height, wider chart area with axis placeholders
 * - table: ~250px height with multiple row placeholders
 * - flow: ~200px height with connected block placeholders
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export function SkeletonLoader({ variant, className = '' }: SkeletonLoaderProps) {
  switch (variant) {
    case 'kpi-card':
      return <KpiCardSkeleton className={className} />;
    case 'chart':
      return <ChartSkeleton className={className} />;
    case 'table':
      return <TableSkeleton className={className} />;
    case 'flow':
      return <FlowSkeleton className={className} />;
  }
}

/** ~120px height compact card skeleton */
function KpiCardSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-panel bg-[var(--color-bg-secondary)] p-panel h-[120px] flex flex-col justify-between ${className}`}
      role="status"
      aria-label="Loading KPI card"
    >
      {/* Title placeholder */}
      <div className="h-3 w-24 rounded bg-[var(--color-bg-tertiary)]" />
      {/* Value placeholder */}
      <div className="h-7 w-32 rounded bg-[var(--color-bg-tertiary)]" />
      {/* Trend placeholder */}
      <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
    </div>
  );
}

/** ~300px height chart area skeleton */
function ChartSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-panel bg-[var(--color-bg-secondary)] p-panel h-[300px] flex flex-col ${className}`}
      role="status"
      aria-label="Loading chart"
    >
      {/* Chart title */}
      <div className="h-4 w-40 rounded bg-[var(--color-bg-tertiary)] mb-4" />
      {/* Chart body area */}
      <div className="flex-1 flex items-end gap-2 pb-4">
        <div className="h-[40%] w-full rounded bg-[var(--color-bg-tertiary)]" />
      </div>
      {/* X-axis placeholder */}
      <div className="flex justify-between">
        <div className="h-2 w-10 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-2 w-10 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-2 w-10 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-2 w-10 rounded bg-[var(--color-bg-tertiary)]" />
      </div>
    </div>
  );
}

/** ~250px height table with row placeholders */
function TableSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-panel bg-[var(--color-bg-secondary)] p-panel h-[250px] flex flex-col ${className}`}
      role="status"
      aria-label="Loading table"
    >
      {/* Table header */}
      <div className="flex gap-4 mb-4">
        <div className="h-3 w-20 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-3 w-14 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
      </div>
      {/* Table rows */}
      <div className="flex-1 flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-24 rounded bg-[var(--color-bg-tertiary)]" />
            <div className="h-4 w-16 rounded bg-[var(--color-bg-tertiary)]" />
            <div className="h-4 w-12 rounded bg-[var(--color-bg-tertiary)]" />
            <div className="h-4 w-14 rounded bg-[var(--color-bg-tertiary)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** ~200px height flow with connected block placeholders */
function FlowSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-panel bg-[var(--color-bg-secondary)] p-panel h-[200px] flex flex-col ${className}`}
      role="status"
      aria-label="Loading flow"
    >
      {/* Flow title */}
      <div className="h-4 w-36 rounded bg-[var(--color-bg-tertiary)] mb-4" />
      {/* Flow stages with connectors */}
      <div className="flex-1 flex items-center justify-between gap-2">
        <div className="h-14 w-20 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="h-1 w-6 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-14 w-20 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="h-1 w-6 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-14 w-20 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="h-1 w-6 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-14 w-20 rounded-lg bg-[var(--color-bg-tertiary)]" />
      </div>
    </div>
  );
}
