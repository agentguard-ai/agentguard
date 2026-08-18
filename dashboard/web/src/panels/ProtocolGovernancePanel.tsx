'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GovernanceProtocol {
  id: string;
  name: string;
  description: string;
  mode: 'ENFORCE' | 'MONITOR' | 'REPORT_ONLY';
  evaluationsToday: number;
  denials: number;
  status: string;
}

// ─── Mode Badge ──────────────────────────────────────────────────────────────

interface ModeBadgeProps {
  mode: GovernanceProtocol['mode'];
}

/**
 * Renders a colored badge for the protocol enforcement mode.
 * - ENFORCE: teal/accent
 * - MONITOR: blue
 * - REPORT_ONLY: gray
 */
function ModeBadge({ mode }: ModeBadgeProps) {
  const styles: Record<GovernanceProtocol['mode'], string> = {
    ENFORCE: 'bg-[var(--color-accent,#14b8a6)]/15 text-[var(--color-accent,#14b8a6)] border-[var(--color-accent,#14b8a6)]/30',
    MONITOR: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    REPORT_ONLY: 'bg-gray-500/15 text-gray-600 border-gray-500/30',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[mode]}`}
      data-testid="protocol-mode-badge"
      aria-label={`Mode: ${mode.replace('_', ' ')}`}
    >
      {mode}
    </span>
  );
}

// ─── ProtocolCardItem ────────────────────────────────────────────────────────

interface ProtocolCardItemProps {
  protocol: GovernanceProtocol;
}

/**
 * Renders a single protocol governance card with mode badge, evaluations, and denials.
 * When denials > 0, the denial count is rendered in red with a warning indicator (⚠)
 * so that meaning is not conveyed by color alone (WCAG 2.1 AA).
 */
function ProtocolCardItem({ protocol }: ProtocolCardItemProps) {
  const hasDenials = protocol.denials > 0;

  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30 p-3"
      data-testid="protocol-card"
      aria-label={`Protocol: ${protocol.name}`}
    >
      {/* Header: Name + Mode Badge */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4
          className="text-sm font-medium text-[var(--color-text-primary)] truncate"
          data-testid="protocol-name"
        >
          {protocol.name}
        </h4>
        <ModeBadge mode={protocol.mode} />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Evaluations Today */}
        <div className="flex flex-col items-center">
          <span
            className="text-lg font-semibold text-[var(--color-text-primary)]"
            data-testid="protocol-evaluations-count"
          >
            {protocol.evaluationsToday}
          </span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            Evaluations
          </span>
        </div>

        {/* Denial Count */}
        <div className="flex flex-col items-center">
          <span
            className={`text-lg font-semibold ${hasDenials ? 'text-[var(--color-danger,#ef4444)]' : 'text-[var(--color-text-primary)]'}`}
            data-testid="protocol-denial-count"
            aria-label={hasDenials ? `Denials: ${protocol.denials} — elevated` : `Denials: ${protocol.denials}`}
          >
            {hasDenials && (
              <span className="mr-1" aria-hidden="true" data-testid="protocol-denial-warning">⚠</span>
            )}
            {protocol.denials}
          </span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {hasDenials ? (
              <span data-testid="protocol-denial-label">
                <span className="text-[var(--color-danger,#ef4444)] font-medium">Denials</span>
              </span>
            ) : (
              'Denials'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── ProtocolGovernancePanelContent ──────────────────────────────────────────

/**
 * Inner content for the Protocol Governance panel.
 * Handles data fetching, loading, empty, and rendered states.
 */
function ProtocolGovernancePanelContent() {
  const { data, isLoading, error } = useCachedQuery<GovernanceProtocol[]>({
    endpoint: '/api/v1/governance/protocols',
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="panel flex flex-col" data-testid="protocol-governance-loading">
        <div className="panel-header">
          <span>Protocol Governance</span>
        </div>
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="panel flex flex-col" data-testid="protocol-governance-error">
        <div className="panel-header">
          <span>Protocol Governance</span>
        </div>
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load governance protocols
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="panel flex flex-col" data-testid="protocol-governance-empty">
        <div className="panel-header">
          <span>Protocol Governance</span>
        </div>
        <EmptyState
          panelType="table"
          message="No active governance protocols for the selected time range."
        />
      </div>
    );
  }

  // Data loaded
  return (
    <div
      className="panel flex flex-col"
      data-testid="protocol-governance-panel"
      aria-label={`Protocol Governance: ${data.length} active protocol${data.length !== 1 ? 's' : ''}`}
    >
      {/* Panel Header */}
      <div className="panel-header">
        <span>Protocol Governance</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {data.length} protocol{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Protocol Cards Grid */}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="list"
        aria-label="Governance protocols list"
      >
        {data.map((protocol) => (
          <div key={protocol.id} role="listitem">
            <ProtocolCardItem protocol={protocol} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ProtocolGovernancePanel (exported panel) ────────────────────────────────

/**
 * ProtocolGovernancePanel — Displays cards for each active governance protocol,
 * showing protocol name, mode badge (ENFORCE/MONITOR/REPORT_ONLY), evaluations
 * count, and denial count with non-color indicator for elevated denials.
 *
 * Wrapped in PanelErrorBoundary for error isolation.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.6
 */
export function ProtocolGovernancePanel() {
  return (
    <PanelErrorBoundary panelName="Protocol Governance">
      <ProtocolGovernancePanelContent />
    </PanelErrorBoundary>
  );
}

export default ProtocolGovernancePanel;
