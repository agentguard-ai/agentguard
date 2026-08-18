'use client';

import { useState, useCallback, type CSSProperties, type ReactElement } from 'react';
import { List } from 'react-window';
import { useRouter } from 'next/navigation';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PipelineDecisionRow {
  id: string;
  correlationId: string;
  agentId: string;
  timestamp: number;
  allowed: boolean;
  blockedStage: string | null;
  totalLatencyMs: number;
  preLatencyMs: number;
  executionLatencyMs: number | null;
  postLatencyMs: number | null;
  resampleCount: number;
  remediationAction: string | null;
  redacted: boolean;
  remediationExhausted: boolean;
  providerError: boolean;
}

interface ModuleHealthEntry {
  name: string;
  version: string;
  evaluationCount: number;
}

interface ModuleHealthResponse {
  modules: ModuleHealthEntry[];
}

interface EvidenceFilters {
  reasonCodes: string[];
  moduleName: string | null;
  actionType: string | null;
  agentId: string;
}

// Known reason codes from TEEC registry
const KNOWN_REASON_CODES = [
  'PII_DETECTED',
  'INJECTION_SUSPECTED',
  'SECRET_DETECTED',
  'COST_LIMIT_EXCEEDED',
  'MODEL_NOT_ALLOWED',
  'TOOL_NOT_ALLOWED',
  'CONTENT_MODERATION',
  'RATE_LIMIT_EXCEEDED',
  'TIMEOUT_EXCEEDED',
  'CONFIDENCE_LOW',
];

const ACTION_TYPE_OPTIONS = ['ALLOW', 'DENY', 'SANITIZE', 'REPORT'] as const;

const INITIAL_FILTERS: EvidenceFilters = {
  reasonCodes: [],
  moduleName: null,
  actionType: null,
  agentId: '',
};

// ─── Row Height for Virtual List ─────────────────────────────────────────────

const ROW_HEIGHT = 56;
const LIST_HEIGHT = 600;

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── Row Props Interface ─────────────────────────────────────────────────────

interface DecisionRowProps {
  decisions: PipelineDecisionRow[];
  onRowClick: (correlationId: string) => void;
}

// ─── DecisionRow Component ───────────────────────────────────────────────────

function DecisionRow({
  index,
  style,
  decisions,
  onRowClick,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: CSSProperties;
} & DecisionRowProps): ReactElement | null {
  const decision = decisions[index];
  if (!decision) return null;

  return (
    <div
      style={style}
      className="grid grid-cols-[1fr_140px_80px_80px_70px] gap-3 px-4 items-center text-xs border-b border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      onClick={() => onRowClick(decision.correlationId)}
      role="row"
      aria-label={`Decision ${decision.correlationId}`}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-[var(--color-text-primary)] truncate font-mono text-[11px]">
          {decision.correlationId.slice(0, 20)}...
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          {formatTimestamp(decision.timestamp)}
        </span>
      </div>
      <span className="text-[var(--color-text-primary)] truncate">{decision.agentId}</span>
      <span className={decision.allowed ? 'text-emerald-400' : 'text-red-400'}>
        {decision.allowed ? 'Allowed' : 'Blocked'}
      </span>
      <span className="text-[var(--color-text-secondary)]">
        {decision.blockedStage ?? '—'}
      </span>
      <span className="text-[var(--color-text-secondary)]">
        {decision.totalLatencyMs}ms
      </span>
    </div>
  );
}

// ─── FilterPanel Component ───────────────────────────────────────────────────

function FilterPanel({
  filters,
  onFiltersChange,
  onClear,
  moduleNames,
}: {
  filters: EvidenceFilters;
  onFiltersChange: (filters: EvidenceFilters) => void;
  onClear: () => void;
  moduleNames: string[];
}) {
  const hasActiveFilters =
    filters.reasonCodes.length > 0 ||
    filters.moduleName !== null ||
    filters.actionType !== null ||
    filters.agentId !== '';

  const handleReasonCodeToggle = (code: string) => {
    const updated = filters.reasonCodes.includes(code)
      ? filters.reasonCodes.filter((c) => c !== code)
      : [...filters.reasonCodes, code];
    onFiltersChange({ ...filters, reasonCodes: updated });
  };

  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-4"
      aria-label="Evidence filters"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs text-[var(--color-accent,#14b8a6)] hover:underline"
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Reason Code Multi-Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Reason Codes
          </label>
          <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-tertiary,#1e293b)] p-2">
            {KNOWN_REASON_CODES.map((code) => (
              <button
                key={code}
                onClick={() => handleReasonCodeToggle(code)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  filters.reasonCodes.includes(code)
                    ? 'bg-[var(--color-accent,#14b8a6)] text-white'
                    : 'bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.1)]'
                }`}
                aria-pressed={filters.reasonCodes.includes(code)}
                aria-label={`Filter by reason code ${code}`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* Module Name Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="module-name-filter"
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
          >
            Module Name
          </label>
          <select
            id="module-name-filter"
            value={filters.moduleName ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, moduleName: e.target.value || null })
            }
            className="text-xs rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-tertiary,#1e293b)] text-[var(--color-text-primary)] px-2 py-1.5"
            aria-label="Filter by module name"
          >
            <option value="">All Modules</option>
            {moduleNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Type Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="action-type-filter"
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
          >
            Action Type
          </label>
          <select
            id="action-type-filter"
            value={filters.actionType ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, actionType: e.target.value || null })
            }
            className="text-xs rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-tertiary,#1e293b)] text-[var(--color-text-primary)] px-2 py-1.5"
            aria-label="Filter by action type"
          >
            <option value="">All Actions</option>
            {ACTION_TYPE_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        {/* Agent ID Input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="agent-id-filter"
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
          >
            Agent ID
          </label>
          <input
            id="agent-id-filter"
            type="text"
            value={filters.agentId}
            onChange={(e) => onFiltersChange({ ...filters, agentId: e.target.value })}
            placeholder="Partial match..."
            className="text-xs rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-tertiary,#1e293b)] text-[var(--color-text-primary)] px-2 py-1.5 placeholder:text-[var(--color-text-secondary)]"
            aria-label="Filter by agent ID (partial match)"
          />
        </div>
      </div>
    </section>
  );
}

// ─── DecisionList Component ──────────────────────────────────────────────────

function DecisionList({
  decisions,
  isLoading,
  onRowClick,
}: {
  decisions: PipelineDecisionRow[];
  isLoading: boolean;
  onRowClick: (correlationId: string) => void;
}) {
  if (isLoading && decisions.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <SkeletonLoader key={i} variant="kpi-card" />
        ))}
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary)] p-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          No decisions match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] overflow-hidden">
      {/* Table Header */}
      <div
        className="grid grid-cols-[1fr_140px_80px_80px_70px] gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.1)] text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
        role="row"
        aria-label="Column headers"
      >
        <span>Correlation ID</span>
        <span>Agent</span>
        <span>Result</span>
        <span>Stage</span>
        <span>Latency</span>
      </div>

      {/* Virtual Scrolled List */}
      <List
        rowCount={decisions.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={DecisionRow}
        rowProps={{ decisions, onRowClick }}
        style={{ height: Math.min(LIST_HEIGHT, decisions.length * ROW_HEIGHT) }}
        overscanCount={5}
        aria-label="Filtered decisions list"
      />
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

/**
 * Evidence list page — filterable decision list with TEEC filter panel.
 *
 * Uses the existing dashboard layout shell (sidebar, time range context, auth context).
 * Implements virtual scrolling for large result sets via react-window.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.2, 9.4
 */
export default function EvidencePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<EvidenceFilters>(INITIAL_FILTERS);

  // Build query params from active filters
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (filters.reasonCodes.length > 0) {
    queryParams.reasonCode = filters.reasonCodes.join(',');
  }
  if (filters.moduleName) {
    queryParams.moduleName = filters.moduleName;
  }
  if (filters.actionType) {
    queryParams.actionType = filters.actionType;
  }
  if (filters.agentId) {
    queryParams.agentId = filters.agentId;
  }

  // Fetch paginated decisions with filter params
  const {
    data: decisions,
    total,
    isLoading,
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
  } = usePaginatedQuery<PipelineDecisionRow>({
    endpoint: '/api/v1/decisions',
    params: queryParams,
    pageSize: 50,
  });

  // Fetch distinct module names from modules health endpoint
  const { data: modulesData } = useCachedQuery<ModuleHealthResponse>({
    endpoint: '/api/v1/modules/health',
  });

  const moduleNames = modulesData?.modules.map((m) => m.name) ?? [];

  const hasActiveFilters =
    filters.reasonCodes.length > 0 ||
    filters.moduleName !== null ||
    filters.actionType !== null ||
    filters.agentId !== '';

  const handleClearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleRowClick = useCallback(
    (correlationId: string) => {
      router.push(`/evidence/${correlationId}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evidence</h1>
        {hasActiveFilters && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {total} result{total !== 1 ? 's' : ''} matching filters
          </span>
        )}
      </div>

      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onClear={handleClearFilters}
        moduleNames={moduleNames}
      />

      {/* Decision List with Virtual Scrolling */}
      <DecisionList
        decisions={decisions}
        isLoading={isLoading}
        onRowClick={handleRowClick}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={prevPage}
              disabled={!hasPrevPage}
              className="text-xs px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              onClick={nextPage}
              disabled={!hasNextPage}
              className="text-xs px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
