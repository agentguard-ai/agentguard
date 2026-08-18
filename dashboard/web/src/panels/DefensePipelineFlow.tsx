'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineStage {
  name: string;
  tokenRange: { min: number; max: number };
  metrics: Record<string, number>;
}

export interface PipelineFlowResponse {
  stages: PipelineStage[];
  connections: { from: string; to: string }[];
}

// ─── DirectionalArrow ────────────────────────────────────────────────────────

/**
 * Renders a directional arrow indicator between pipeline stages.
 */
function DirectionalArrow() {
  return (
    <div
      className="flex shrink-0 items-center text-[var(--color-text-secondary)]"
      aria-hidden="true"
    >
      <svg
        className="h-4 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 16"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2 8h16m0 0l-4-4m4 4l-4 4"
        />
      </svg>
    </div>
  );
}

// ─── StageCard ───────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: PipelineStage;
}

/**
 * Renders a single pipeline stage as a card showing
 * name, token range (min–max), and per-stage metrics.
 */
function StageCard({ stage }: StageCardProps) {
  const metricEntries = Object.entries(stage.metrics);

  return (
    <div
      className="flex min-w-[140px] flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3"
      data-testid="pipeline-stage-card"
      aria-label={`Stage: ${stage.name}`}
    >
      {/* Stage name */}
      <h4 className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
        {stage.name}
      </h4>

      {/* Token range */}
      <div className="mb-2 flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        <span data-testid="token-range">
          {stage.tokenRange.min.toLocaleString()}–{stage.tokenRange.max.toLocaleString()} tokens
        </span>
      </div>

      {/* Per-stage metrics */}
      {metricEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          {metricEntries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between text-[10px]"
              data-testid="stage-metric"
            >
              <span className="text-[var(--color-text-secondary)] capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {typeof value === 'number' && value >= 1000
                  ? value.toLocaleString()
                  : value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DefensePipelineFlowContent ──────────────────────────────────────────────

/**
 * Inner content of the DefensePipelineFlow panel.
 * Handles data fetching, loading/empty/error states, and rendering the flow.
 */
function DefensePipelineFlowContent() {
  const { data, isLoading, error } = useCachedQuery<PipelineFlowResponse>({
    endpoint: '/api/v1/pipeline/flow',
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="pipeline-flow-loading">
        <div className="panel-header">
          <span>Defense Pipeline</span>
        </div>
        <SkeletonLoader variant="flow" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="pipeline-flow-error">
        <div className="panel-header">
          <span>Defense Pipeline</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load pipeline flow data
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.stages.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="pipeline-flow-empty">
        <div className="panel-header">
          <span>Defense Pipeline</span>
        </div>
        <EmptyState
          panelType="flow"
          message="No pipeline stages configured for the current deployment"
        />
      </div>
    );
  }

  return (
    <div
      className="panel flex flex-col"
      data-testid="pipeline-flow-chart"
      aria-label={`Defense Pipeline flow: ${data.stages.length} stages connected in sequence`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Defense Pipeline</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {data.stages.length} {data.stages.length === 1 ? 'stage' : 'stages'}
        </span>
      </div>

      {/* Flow visualization */}
      <div
        className="flex flex-1 items-center gap-2 overflow-x-auto py-3"
        role="list"
        aria-label="Pipeline stages"
      >
        {data.stages.map((stage, index) => (
          <div key={stage.name} className="flex items-center gap-2" role="listitem">
            <StageCard stage={stage} />
            {index < data.stages.length - 1 && <DirectionalArrow />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DefensePipelineFlow (exported panel) ────────────────────────────────────

/**
 * DefensePipelineFlow — Displays a visual flow showing pipeline stages
 * connected by directional indicators, with token count ranges and per-stage metrics.
 *
 * Wrapped in PanelErrorBoundary for error isolation.
 * Consumes `useCachedQuery('/api/v1/pipeline/flow')`.
 *
 * Requirements: 6.1, 6.2
 */
export function DefensePipelineFlow() {
  return (
    <PanelErrorBoundary panelName="Defense Pipeline">
      <DefensePipelineFlowContent />
    </PanelErrorBoundary>
  );
}

export default DefensePipelineFlow;
