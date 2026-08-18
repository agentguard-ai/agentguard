'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { List } from 'react-window';
import type { CSSProperties, ReactElement } from 'react';
import { useTimeRange } from '../hooks/useTimeRange';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useAuth } from '../hooks/useAuth';
import type { PipelineDecisionRow } from '../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'timeline';
type SortOrder = 'asc' | 'desc';
type PageSize = 25 | 50 | 100;

interface DecisionDrillDown {
  correlationId: string;
  decision: PipelineDecisionRow | null;
  stageDecisions: StageDecisionDetail[];
  moduleDetails: ModuleEvalDetail[];
  timing: TimingMetadata | null;
  loading: boolean;
  error: Error | null;
}

interface StageDecisionDetail {
  index: number;
  stage: string;
  action: string;
  moduleName: string;
  moduleVersion: string;
  latencyMs: number;
  reasonCodes: string[];
  seq: number;
  intentRef: string;
  receiptRef: string;
}

interface ModuleEvalDetail {
  moduleName: string;
  moduleVersion: string;
  stage: string;
  latencyMs: number;
  action: string;
  reasonCodes: string[];
  error: string | null;
}

interface TimingMetadata {
  preLatencyMs: number;
  executionLatencyMs: number | null;
  postLatencyMs: number | null;
  totalLatencyMs: number;
  resampleCount: number;
  remediationAction: string | null;
  remediationExhausted: boolean;
}

interface DecisionListApiResponse {
  results: PipelineDecisionRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    allowedCount: number;
    blockedCount: number;
    allowedPercent: number;
    blockedPercent: number;
  };
}

// ─── Column Definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  width: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'correlationId', label: 'Correlation ID', sortable: true, width: 'w-48' },
  { key: 'timestamp', label: 'Timestamp', sortable: true, width: 'w-44' },
  { key: 'allowed', label: 'Action', sortable: true, width: 'w-24' },
  { key: 'blockedStage', label: 'Blocked Stage', sortable: true, width: 'w-36' },
  { key: 'totalLatencyMs', label: 'Latency (ms)', sortable: true, width: 'w-28' },
  { key: 'agentId', label: 'Agent ID', sortable: true, width: 'w-36' },
];

const PAGE_SIZES: PageSize[] = [25, 50, 100];
const VIRTUAL_ROW_HEIGHT = 40;
const VIRTUAL_SCROLL_THRESHOLD = 200;

// ─── Helper Functions ────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncateId(id: string, maxLen = 12): string {
  if (id.length <= maxLen) return id;
  return `${id.slice(0, maxLen)}…`;
}

// ─── DecisionExplorer Component ──────────────────────────────────────────────

/**
 * DecisionExplorer panel — interactive exploration of PipelineResult decisions.
 *
 * Features:
 * - Timeline and sortable table views with toggle
 * - Filters: action, blocked stage, date range (from TimeRange context), correlation ID search
 * - Drill-down view with StageDecisions, module details, remediation history, timing
 * - Pagination with configurable page sizes (25, 50, 100)
 * - Stats bar showing total count + allowed/blocked percentage
 * - Virtual scrolling via react-window for large result sets
 *
 * @validates Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 12.3
 */
export function DecisionExplorer() {
  const { timeRange } = useTimeRange();
  const { getAuthHeaders } = useAuth();
  const router = useRouter();

  // ─── Filter State ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [correlationSearch, setCorrelationSearch] = useState<string>('');
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ─── Drill-down State ──────────────────────────────────────────────────
  const [drillDown, setDrillDown] = useState<DecisionDrillDown | null>(null);

  // ─── Build query params for usePaginatedQuery ──────────────────────────
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      sortBy,
      sortOrder,
      startTime: timeRange.start,
      endTime: timeRange.end,
    };
    if (actionFilter !== 'all') {
      params.action = actionFilter;
    }
    if (stageFilter !== 'all') {
      params.blockedStage = stageFilter;
    }
    if (correlationSearch.trim()) {
      params.correlationId = correlationSearch.trim();
    }
    return params;
  }, [actionFilter, stageFilter, correlationSearch, sortBy, sortOrder, timeRange]);

  const {
    data: decisions,
    total,
    page,
    totalPages,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    refresh,
  } = usePaginatedQuery<PipelineDecisionRow>({
    endpoint: '/api/v1/decisions',
    params: queryParams,
    pageSize,
  });

  // ─── Stats (from API response via extra fetch for stats) ───────────────
  const [stats, setStats] = useState<{
    allowedCount: number;
    blockedCount: number;
    allowedPercent: number;
    blockedPercent: number;
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = new URL('/api/v1/decisions', getApiBaseUrl());
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '1');
        url.searchParams.set('startTime', String(timeRange.start));
        url.searchParams.set('endTime', String(timeRange.end));
        if (actionFilter !== 'all') url.searchParams.set('action', actionFilter);
        if (stageFilter !== 'all') url.searchParams.set('blockedStage', stageFilter);
        if (correlationSearch.trim()) url.searchParams.set('correlationId', correlationSearch.trim());

        const res = await fetch(url.toString(), {
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        if (res.ok) {
          const data: DecisionListApiResponse = await res.json();
          setStats(data.stats);
        }
      } catch {
        // Stats fetch failure is non-critical
      }
    };
    fetchStats();
  }, [timeRange, actionFilter, stageFilter, correlationSearch, getAuthHeaders]);

  // ─── Sort Handler ──────────────────────────────────────────────────────
  const handleSort = useCallback((columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  }, [sortBy]);

  // ─── Drill-down Handler ────────────────────────────────────────────────
  const handleRowClick = useCallback(async (correlationId: string) => {
    setDrillDown({
      correlationId,
      decision: null,
      stageDecisions: [],
      moduleDetails: [],
      timing: null,
      loading: true,
      error: null,
    });

    try {
      const url = `${getApiBaseUrl()}/api/v1/decisions/${encodeURIComponent(correlationId)}`;
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch decision details: ${res.status}`);
      }

      const data = await res.json();
      setDrillDown({
        correlationId,
        decision: data.decision ?? null,
        stageDecisions: data.stageDecisions ?? [],
        moduleDetails: data.moduleDetails ?? [],
        timing: data.timing ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setDrillDown((prev) => prev ? {
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      } : null);
    }
  }, [getAuthHeaders]);

  const closeDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  // ─── Navigate to evidence detail view ────────────────────────────────────

  const navigateToEvidence = useCallback((correlationId: string) => {
    router.push(`/evidence/${encodeURIComponent(correlationId)}`);
  }, [router]);

  // ─── Use virtual scrolling for large datasets ──────────────────────────
  const useVirtualScroll = decisions.length > VIRTUAL_SCROLL_THRESHOLD;

  // ─── Render ────────────────────────────────────────────────────────────
  if (drillDown) {
    return (
      <section className="panel flex flex-col" aria-label="Decision Explorer - Drill Down">
        <DrillDownView drillDown={drillDown} onClose={closeDrillDown} onNavigateToEvidence={navigateToEvidence} />
      </section>
    );
  }

  return (
    <section className="panel flex flex-col" aria-label="Decision Explorer">
      {/* Panel Header */}
      <div className="panel-header">
        <span>Decision Explorer</span>
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <button
            onClick={refresh}
            className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            aria-label="Refresh results"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        actionFilter={actionFilter}
        stageFilter={stageFilter}
        correlationSearch={correlationSearch}
        onActionChange={setActionFilter}
        onStageChange={setStageFilter}
        onCorrelationChange={setCorrelationSearch}
      />

      {/* Stats Bar */}
      <StatsBar total={total} stats={stats} />

      {/* Main Content */}
      <div className="mt-3 flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading decisions">
            <span className="text-sm text-[var(--color-text-secondary)]">Loading…</span>
          </div>
        )}

        {error && (
          <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]" role="alert">
            {error.message}
          </div>
        )}

        {!isLoading && !error && decisions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-[var(--color-text-secondary)]">No decisions found for the current filters.</span>
          </div>
        )}

        {!isLoading && !error && decisions.length > 0 && viewMode === 'table' && (
          useVirtualScroll ? (
            <VirtualTable
              decisions={decisions}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onRowClick={handleRowClick}
            />
          ) : (
            <DecisionTable
              decisions={decisions}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onRowClick={handleRowClick}
            />
          )
        )}

        {!isLoading && !error && decisions.length > 0 && viewMode === 'timeline' && (
          <TimelineView decisions={decisions} onRowClick={handleRowClick} />
        )}
      </div>

      {/* Pagination */}
      <PaginationControls
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        hasPrevPage={hasPrevPage}
        onNextPage={nextPage}
        onPrevPage={prevPage}
        onGoToPage={goToPage}
        onPageSizeChange={setPageSize}
      />
    </section>
  );
}

export default DecisionExplorer;


// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Toggle between table and timeline views */
function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex rounded border border-[var(--color-border)]" role="group" aria-label="View mode">
      <button
        onClick={() => onChange('table')}
        className={`px-2 py-1 text-xs ${viewMode === 'table' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
        aria-pressed={viewMode === 'table'}
      >
        Table
      </button>
      <button
        onClick={() => onChange('timeline')}
        className={`px-2 py-1 text-xs ${viewMode === 'timeline' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
        aria-pressed={viewMode === 'timeline'}
      >
        Timeline
      </button>
    </div>
  );
}


/** Filter controls for action, blocked stage, and correlation ID search */
function FilterBar({
  actionFilter,
  stageFilter,
  correlationSearch,
  onActionChange,
  onStageChange,
  onCorrelationChange,
}: {
  actionFilter: string;
  stageFilter: string;
  correlationSearch: string;
  onActionChange: (v: string) => void;
  onStageChange: (v: string) => void;
  onCorrelationChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2" role="search" aria-label="Decision filters">
      {/* Action Filter */}
      <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        Action:
        <select
          value={actionFilter}
          onChange={(e) => onActionChange(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
          aria-label="Filter by action"
        >
          <option value="all">All</option>
          <option value="allowed">Allowed</option>
          <option value="blocked">Blocked</option>
        </select>
      </label>

      {/* Blocked Stage Filter */}
      <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        Blocked Stage:
        <select
          value={stageFilter}
          onChange={(e) => onStageChange(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
          aria-label="Filter by blocked stage"
        >
          <option value="all">All</option>
          <option value="PRE_EXECUTION">PRE_EXECUTION</option>
          <option value="POST_EXECUTION">POST_EXECUTION</option>
        </select>
      </label>

      {/* Correlation ID Search */}
      <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        Correlation ID:
        <input
          type="text"
          value={correlationSearch}
          onChange={(e) => onCorrelationChange(e.target.value)}
          placeholder="Search by ID…"
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
          aria-label="Search by correlation ID"
        />
      </label>
    </div>
  );
}


/** Stats bar showing total count + allowed/blocked percentage */
function StatsBar({
  total,
  stats,
}: {
  total: number;
  stats: { allowedCount: number; blockedCount: number; allowedPercent: number; blockedPercent: number } | null;
}) {
  if (!stats && total === 0) return null;

  return (
    <div
      className="mt-2 flex items-center gap-3 rounded bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
      aria-live="polite"
      aria-label="Results summary"
    >
      <span className="font-medium text-[var(--color-text-primary)]">
        {total.toLocaleString()} results
      </span>
      {stats && total > 0 && (
        <>
          <span className="text-[var(--color-success)]">
            {stats.allowedPercent.toFixed(1)}% allowed
          </span>
          <span className="text-[var(--color-danger)]">
            {stats.blockedPercent.toFixed(1)}% blocked
          </span>
        </>
      )}
    </div>
  );
}


/** Sortable table header */
function SortableHeader({
  columns,
  sortBy,
  sortOrder,
  onSort,
}: {
  columns: ColumnDef[];
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string) => void;
}) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border)]">
        {columns.map((col) => (
          <th
            key={col.key}
            className={`px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] ${col.width} ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--color-text-primary)]' : ''}`}
            onClick={col.sortable ? () => onSort(col.key) : undefined}
            aria-sort={sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <span className="flex items-center gap-1">
              {col.label}
              {col.sortable && sortBy === col.key && (
                <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );
}


/** Standard table (non-virtual, for smaller datasets) */
function DecisionTable({
  decisions,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}: {
  decisions: PipelineDecisionRow[];
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string) => void;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs" aria-label="Decisions table">
        <SortableHeader columns={COLUMNS} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        <tbody>
          {decisions.map((d) => (
            <tr
              key={d.id}
              onClick={() => onRowClick(d.correlationId)}
              className="cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(d.correlationId); }}
              aria-label={`Decision ${d.correlationId}, ${d.allowed ? 'allowed' : 'blocked'}`}
            >
              <td className="px-3 py-2 font-mono" title={d.correlationId}>{truncateId(d.correlationId)}</td>
              <td className="px-3 py-2">{formatTimestamp(d.timestamp)}</td>
              <td className="px-3 py-2">
                <ActionBadge allowed={d.allowed} />
              </td>
              <td className="px-3 py-2 text-[var(--color-text-secondary)]">{d.blockedStage ?? '—'}</td>
              <td className="px-3 py-2 font-mono">{d.totalLatencyMs}</td>
              <td className="px-3 py-2 font-mono" title={d.agentId}>{truncateId(d.agentId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// Row props for virtual scrolling (custom data passed through react-window)
interface VirtualRowProps {
  decisions: PipelineDecisionRow[];
  onClick: (id: string) => void;
}

/** Virtual scrolling table using react-window for large datasets */
function VirtualTable({
  decisions,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}: {
  decisions: PipelineDecisionRow[];
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string) => void;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden" role="table" aria-label="Decisions table (virtual scroll)">
      {/* Virtual table header */}
      <div className="flex border-b border-[var(--color-border)]" role="row">
        {COLUMNS.map((col) => (
          <span
            key={col.key}
            className={`px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] ${col.width} ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--color-text-primary)]' : ''}`}
            onClick={col.sortable ? () => onSort(col.key) : undefined}
            role="columnheader"
            aria-sort={sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            {col.label}
            {col.sortable && sortBy === col.key && (
              <span aria-hidden="true"> {sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </span>
        ))}
      </div>
      {/* Virtual list body */}
      <List<VirtualRowProps>
        rowComponent={VirtualRow}
        rowCount={decisions.length}
        rowHeight={VIRTUAL_ROW_HEIGHT}
        rowProps={{ decisions, onClick: onRowClick }}
        style={{ height: 400 }}
      />
    </div>
  );
}

function VirtualRow({
  index,
  style,
  decisions,
  onClick,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: CSSProperties;
} & VirtualRowProps): ReactElement | null {
  const d = decisions[index];
  if (!d) return null;
  return (
    <div
      style={style}
      className="flex items-center border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors"
      onClick={() => onClick(d.correlationId)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(d.correlationId); }}
      aria-label={`Decision ${d.correlationId}, ${d.allowed ? 'allowed' : 'blocked'}`}
    >
      <span className="w-48 px-3 py-2 text-xs font-mono truncate" title={d.correlationId}>{truncateId(d.correlationId)}</span>
      <span className="w-44 px-3 py-2 text-xs">{formatTimestamp(d.timestamp)}</span>
      <span className="w-24 px-3 py-2 text-xs"><ActionBadge allowed={d.allowed} /></span>
      <span className="w-36 px-3 py-2 text-xs text-[var(--color-text-secondary)]">{d.blockedStage ?? '—'}</span>
      <span className="w-28 px-3 py-2 text-xs font-mono">{d.totalLatencyMs}</span>
      <span className="w-36 px-3 py-2 text-xs font-mono truncate" title={d.agentId}>{truncateId(d.agentId)}</span>
    </div>
  );
}


/** Timeline visualization of decisions */
function TimelineView({
  decisions,
  onRowClick,
}: {
  decisions: PipelineDecisionRow[];
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="relative overflow-auto pl-4" aria-label="Decision timeline">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-[var(--color-border)]" aria-hidden="true" />

      {decisions.map((d) => (
        <div
          key={d.id}
          className="relative mb-3 ml-6 cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3 hover:border-[var(--color-accent)] transition-colors"
          onClick={() => onRowClick(d.correlationId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(d.correlationId); }}
        >
          {/* Timeline dot */}
          <div
            className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-[var(--color-bg-secondary)] ${d.allowed ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
            aria-hidden="true"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActionBadge allowed={d.allowed} />
              <span className="text-xs font-mono text-[var(--color-text-secondary)]" title={d.correlationId}>
                {truncateId(d.correlationId, 16)}
              </span>
            </div>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {formatTimestamp(d.timestamp)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            {d.blockedStage && (
              <span>Stage: <span className="text-[var(--color-warning)]">{d.blockedStage}</span></span>
            )}
            <span>Latency: {d.totalLatencyMs}ms</span>
            <span>Agent: <span className="font-mono">{truncateId(d.agentId)}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}


/** Action badge (Allowed / Blocked) */
function ActionBadge({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        allowed
          ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
          : 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
      }`}
    >
      {allowed ? 'Allowed' : 'Blocked'}
    </span>
  );
}


/** Pagination controls with page size selector */
function PaginationControls({
  page,
  totalPages,
  pageSize,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onGoToPage,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3" aria-label="Pagination controls">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--color-text-secondary)]">
          Per page:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="ml-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            aria-label="Results per page"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}


/** Drill-down detail view for a single decision */
function DrillDownView({
  drillDown,
  onClose,
  onNavigateToEvidence,
}: {
  drillDown: DecisionDrillDown;
  onClose: () => void;
  onNavigateToEvidence: (correlationId: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header with back button */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            aria-label="Back to results"
          >
            ← Back
          </button>
          <span className="font-mono text-xs">{drillDown.correlationId}</span>
        </div>
        {/* View Full Evidence link */}
        <button
          onClick={() => onNavigateToEvidence(drillDown.correlationId)}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          aria-label={`View full TEEC evidence for ${drillDown.correlationId}`}
        >
          View Full Evidence →
        </button>
      </div>

      {drillDown.loading && (
        <div className="flex items-center justify-center py-8" role="status">
          <span className="text-sm text-[var(--color-text-secondary)]">Loading details…</span>
        </div>
      )}

      {drillDown.error && (
        <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]" role="alert">
          {drillDown.error.message}
        </div>
      )}

      {!drillDown.loading && !drillDown.error && (
        <div className="space-y-4 overflow-auto">
          {/* Timing Overview */}
          {drillDown.timing && (
            <section aria-label="Timing metadata">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">Timing</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TimingCard label="Total" value={`${drillDown.timing.totalLatencyMs}ms`} />
                <TimingCard label="Pre-Execution" value={`${drillDown.timing.preLatencyMs}ms`} />
                <TimingCard label="Execution" value={drillDown.timing.executionLatencyMs != null ? `${drillDown.timing.executionLatencyMs}ms` : '—'} />
                <TimingCard label="Post-Execution" value={drillDown.timing.postLatencyMs != null ? `${drillDown.timing.postLatencyMs}ms` : '—'} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                <span>Resample count: {drillDown.timing.resampleCount}</span>
                {drillDown.timing.remediationAction && (
                  <span>Remediation: <span className="text-[var(--color-warning)]">{drillDown.timing.remediationAction}</span></span>
                )}
                {drillDown.timing.remediationExhausted && (
                  <span className="text-[var(--color-danger)]">Remediation exhausted</span>
                )}
              </div>
            </section>
          )}

          {/* Stage Decisions */}
          {drillDown.stageDecisions.length > 0 && (
            <section aria-label="Stage decisions">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">Stage Decisions</h3>
              <div className="overflow-auto">
                <table className="w-full text-xs" aria-label="Stage decisions table">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">#</th>
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">Stage</th>
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">Module</th>
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">Action</th>
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">Latency</th>
                      <th className="px-2 py-1 text-left text-[var(--color-text-secondary)]">Reason Codes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.stageDecisions.map((sd) => (
                      <tr key={sd.index} className="border-b border-[var(--color-border)]">
                        <td className="px-2 py-1 font-mono">{sd.seq}</td>
                        <td className="px-2 py-1">{sd.stage}</td>
                        <td className="px-2 py-1">{sd.moduleName} <span className="text-[var(--color-text-secondary)]">v{sd.moduleVersion}</span></td>
                        <td className="px-2 py-1">
                          <span className={sd.action === 'DENY' ? 'text-[var(--color-danger)]' : sd.action === 'ALLOW' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                            {sd.action}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono">{sd.latencyMs}ms</td>
                        <td className="px-2 py-1 font-mono text-[var(--color-text-secondary)]">{sd.reasonCodes.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Module Details */}
          {drillDown.moduleDetails.length > 0 && (
            <section aria-label="Module evaluation details">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">Module Evaluations</h3>
              <div className="space-y-2">
                {drillDown.moduleDetails.map((mod, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {mod.moduleName} <span className="text-[var(--color-text-secondary)]">v{mod.moduleVersion}</span>
                      </span>
                      <span className={`text-xs font-semibold ${mod.action === 'DENY' ? 'text-[var(--color-danger)]' : mod.action === 'ALLOW' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                        {mod.action}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-secondary)]">
                      <span>Stage: {mod.stage}</span>
                      <span>Latency: {mod.latencyMs}ms</span>
                      {mod.reasonCodes.length > 0 && (
                        <span>Reasons: {mod.reasonCodes.join(', ')}</span>
                      )}
                      {mod.error && (
                        <span className="text-[var(--color-danger)]">Error: {mod.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}


/** Small card for timing values */
function TimingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2">
      <div className="text-[10px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
