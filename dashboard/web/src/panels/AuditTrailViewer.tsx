'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FixedSizeList as List } from 'react-window';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { useTimeRange } from '@/hooks/useTimeRange';
import type { AuditEvent } from '../../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'pipeline_execution_completed',
  'hook_execution',
  'remediation_attempt',
  'provider_error',
  'freeze_activation',
  'module_exception',
] as const;

type AuditEventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  pipeline_execution_completed: 'Pipeline Completed',
  hook_execution: 'Hook Execution',
  remediation_attempt: 'Remediation',
  provider_error: 'Provider Error',
  freeze_activation: 'Freeze Activation',
  module_exception: 'Module Exception',
};

const EVENT_TYPE_COLORS: Record<AuditEventType, string> = {
  pipeline_execution_completed: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
  hook_execution: 'bg-blue-500/20 text-blue-400',
  remediation_attempt: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
  provider_error: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]',
  freeze_activation: 'bg-purple-500/20 text-purple-400',
  module_exception: 'bg-red-500/20 text-red-400',
};

const CHAIN_STATUS_ICONS: Record<string, { label: string; className: string }> = {
  intact: { label: 'Chain intact', className: 'text-[var(--color-success)]' },
  broken: { label: 'Chain broken', className: 'text-[var(--color-danger)]' },
  'not-applicable': { label: 'N/A', className: 'text-[var(--color-text-secondary)]' },
};

const ROW_HEIGHT = 52;
const LIST_HEIGHT = 520;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AuditTrailViewer — Reverse-chronological event log with virtual scrolling.
 *
 * Displays:
 * - Pipeline events (hook execution, remediation, provider errors, freeze, exceptions)
 * - Filters: event type, agent ID, text search
 * - Expandable detail view with full event payload (JSON)
 * - TEEC chain status indicator per event
 * - Virtual scrolling via react-window for large audit trails
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 12.3
 */
export function AuditTrailViewer() {
  const { timeRange } = useTimeRange();
  const router = useRouter();

  // ─── Filter state ────────────────────────────────────────────────────────
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [agentIdFilter, setAgentIdFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Debounced search query to avoid excessive API calls
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ─── Build query params ──────────────────────────────────────────────────

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      start: timeRange.start,
      end: timeRange.end,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    };
    if (eventTypeFilter) params.eventType = eventTypeFilter;
    if (agentIdFilter) params.agentId = agentIdFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [timeRange.start, timeRange.end, eventTypeFilter, agentIdFilter, debouncedSearch]);

  // ─── Paginated query ─────────────────────────────────────────────────────

  const {
    data: events,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    hasNextPage,
    hasPrevPage,
  } = usePaginatedQuery<AuditEvent>({
    endpoint: '/api/v1/audit/events',
    params: queryParams,
    pageSize: 100,
  });

  // ─── Expand/collapse toggle ──────────────────────────────────────────────

  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  }, []);

  // ─── Navigate to evidence detail view ────────────────────────────────────

  const navigateToEvidence = useCallback((correlationId: string) => {
    router.push(`/evidence/${encodeURIComponent(correlationId)}`);
  }, [router]);

  // ─── Virtual list row renderer ───────────────────────────────────────────

  const listRef = useRef<List | null>(null);

  // Reset scroll to top when filters change
  useEffect(() => {
    listRef.current?.scrollToItem(0);
  }, [eventTypeFilter, agentIdFilter, debouncedSearch, page]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="panel flex flex-col" role="region" aria-label="Audit Trail Viewer">
      {/* Header */}
      <div className="panel-header">
        <span>Audit Trail</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {total} events
        </span>
      </div>

      {/* Filters */}
      <FilterBar
        eventTypeFilter={eventTypeFilter}
        agentIdFilter={agentIdFilter}
        searchQuery={searchQuery}
        onEventTypeChange={setEventTypeFilter}
        onAgentIdChange={setAgentIdFilter}
        onSearchChange={setSearchQuery}
      />

      {/* Content */}
      {isLoading && events.length === 0 ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : events.length === 0 ? (
        <EmptyState />
      ) : expandedEventId ? (
        <ExpandedEventList
          events={events}
          expandedEventId={expandedEventId}
          onToggle={toggleExpanded}
          onNavigateToEvidence={navigateToEvidence}
        />
      ) : (
        <VirtualEventList
          events={events}
          listRef={listRef}
          expandedEventId={expandedEventId}
          onToggle={toggleExpanded}
          onNavigateToEvidence={navigateToEvidence}
        />
      )}

      {/* Pagination */}
      {total > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          onGoToPage={goToPage}
        />
      )}
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

function FilterBar({
  eventTypeFilter,
  agentIdFilter,
  searchQuery,
  onEventTypeChange,
  onAgentIdChange,
  onSearchChange,
}: {
  eventTypeFilter: string;
  agentIdFilter: string;
  searchQuery: string;
  onEventTypeChange: (value: string) => void;
  onAgentIdChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Audit trail filters">
      {/* Event Type Filter */}
      <div className="flex flex-col">
        <label
          htmlFor="audit-event-type-filter"
          className="mb-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          Event Type
        </label>
        <select
          id="audit-event-type-filter"
          value={eventTypeFilter}
          onChange={(e) => onEventTypeChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Filter by event type"
        >
          <option value="">All types</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Agent ID Filter */}
      <div className="flex flex-col">
        <label
          htmlFor="audit-agent-id-filter"
          className="mb-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          Agent ID
        </label>
        <input
          id="audit-agent-id-filter"
          type="text"
          value={agentIdFilter}
          onChange={(e) => onAgentIdChange(e.target.value)}
          placeholder="Filter by agent…"
          className="w-36 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Filter by agent ID"
        />
      </div>

      {/* Text Search */}
      <div className="flex flex-col flex-1 min-w-[180px]">
        <label
          htmlFor="audit-search"
          className="mb-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          Search
        </label>
        <input
          id="audit-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search descriptions & metadata…"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Search audit events"
        />
      </div>
    </div>
  );
}

// ─── Virtual Event List ──────────────────────────────────────────────────────

function VirtualEventList({
  events,
  listRef,
  expandedEventId,
  onToggle,
  onNavigateToEvidence,
}: {
  events: AuditEvent[];
  listRef: React.RefObject<List | null>;
  expandedEventId: string | null;
  onToggle: (id: string) => void;
  onNavigateToEvidence: (correlationId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-md border border-[var(--color-border)]">
      <List
        ref={listRef}
        height={LIST_HEIGHT}
        width="100%"
        itemCount={events.length}
        itemSize={ROW_HEIGHT}
        overscanCount={5}
        aria-label="Audit events list"
      >
        {({ index, style }) => (
          <EventRow
            key={events[index].id}
            event={events[index]}
            style={style}
            isExpanded={expandedEventId === events[index].id}
            onToggle={onToggle}
            onNavigateToEvidence={onNavigateToEvidence}
          />
        )}
      </List>
    </div>
  );
}

// ─── Expanded Event List (non-virtual for detail expansion) ──────────────────

function ExpandedEventList({
  events,
  expandedEventId,
  onToggle,
  onNavigateToEvidence,
}: {
  events: AuditEvent[];
  expandedEventId: string | null;
  onToggle: (id: string) => void;
  onNavigateToEvidence: (correlationId: string) => void;
}) {
  return (
    <div
      className="flex-1 overflow-y-auto rounded-md border border-[var(--color-border)]"
      style={{ maxHeight: LIST_HEIGHT }}
      aria-label="Audit events list"
    >
      {events.map((event) => (
        <div key={event.id}>
          <EventRow
            event={event}
            style={{}}
            isExpanded={expandedEventId === event.id}
            onToggle={onToggle}
            onNavigateToEvidence={onNavigateToEvidence}
          />
          {expandedEventId === event.id && (
            <EventDetailPanel event={event} onNavigateToEvidence={onNavigateToEvidence} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Event Row ───────────────────────────────────────────────────────────────

function EventRow({
  event,
  style,
  isExpanded,
  onToggle,
  onNavigateToEvidence,
}: {
  event: AuditEvent;
  style: React.CSSProperties;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onNavigateToEvidence: (correlationId: string) => void;
}) {
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const date = new Date(event.timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  const eventTypeColor =
    EVENT_TYPE_COLORS[event.eventType as AuditEventType] ||
    'bg-gray-500/20 text-gray-400';

  const eventTypeLabel =
    EVENT_TYPE_LABELS[event.eventType as AuditEventType] || event.eventType;

  const chainInfo = event.chainStatus
    ? CHAIN_STATUS_ICONS[event.chainStatus]
    : null;

  return (
    <div
      style={style}
      className={`flex items-center gap-3 border-b border-[var(--color-border)]/50 px-3 hover:bg-[var(--color-bg-tertiary)]/50 cursor-pointer ${
        isExpanded ? 'bg-[var(--color-bg-tertiary)]' : ''
      }`}
      onClick={() => onToggle(event.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(event.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${eventTypeLabel} event at ${time} ${date}. ${event.description}. Click to ${isExpanded ? 'collapse' : 'expand'} details.`}
    >
      {/* Expand indicator */}
      <span
        className={`text-[10px] text-[var(--color-text-secondary)] transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`}
        aria-hidden="true"
      >
        ▶
      </span>

      {/* Timestamp */}
      <div className="flex flex-col w-16 shrink-0">
        <span className="text-[10px] text-[var(--color-text-secondary)]">{date}</span>
        <span className="text-xs font-mono text-[var(--color-text-primary)]">{time}</span>
      </div>

      {/* Event Type Badge */}
      <span
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${eventTypeColor}`}
      >
        {eventTypeLabel}
      </span>

      {/* Correlation ID */}
      <span
        className="text-[10px] font-mono text-[var(--color-text-secondary)] w-20 truncate shrink-0"
        title={event.correlationId}
      >
        {event.correlationId.slice(0, 8)}…
      </span>

      {/* Agent ID */}
      <span
        className="text-xs text-[var(--color-text-secondary)] w-24 truncate shrink-0"
        title={event.agentId}
      >
        {event.agentId}
      </span>

      {/* Description */}
      <span className="flex-1 text-xs text-[var(--color-text-primary)] truncate">
        {event.description}
      </span>

      {/* Inspect Evidence Button */}
      {event.correlationId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToEvidence(event.correlationId);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              onNavigateToEvidence(event.correlationId);
            }
          }}
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
          title="Inspect Evidence"
          aria-label={`Inspect evidence for decision ${event.correlationId}`}
        >
          Evidence →
        </button>
      )}

      {/* TEEC Chain Status Indicator */}
      {chainInfo && (
        <span
          className={`text-xs shrink-0 ${chainInfo.className}`}
          title={chainInfo.label}
          aria-label={`TEEC chain status: ${chainInfo.label}`}
        >
          {event.chainStatus === 'intact' && '🔗'}
          {event.chainStatus === 'broken' && '⛓️‍💥'}
          {event.chainStatus === 'not-applicable' && '—'}
        </span>
      )}
    </div>
  );
}

// ─── Event Detail Panel ──────────────────────────────────────────────────────

function EventDetailPanel({ event, onNavigateToEvidence }: { event: AuditEvent; onNavigateToEvidence: (correlationId: string) => void }) {
  return (
    <div
      className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3"
      role="region"
      aria-label={`Details for event ${event.id}`}
    >
      {/* Summary fields */}
      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <DetailField label="Event ID" value={event.id} mono />
        <DetailField label="Correlation ID" value={event.correlationId} mono />
        <DetailField label="Agent ID" value={event.agentId} />
        <DetailField label="Event Type" value={event.eventType} />
        <DetailField
          label="Timestamp"
          value={new Date(event.timestamp).toISOString()}
          mono
        />
        {event.chainStatus && (
          <DetailField label="Chain Status" value={event.chainStatus} />
        )}
      </div>

      {/* Navigate to Evidence Detail */}
      {event.correlationId && (
        <div className="mb-3">
          <button
            onClick={() => onNavigateToEvidence(event.correlationId)}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            aria-label={`Inspect full TEEC evidence for ${event.correlationId}`}
          >
            Inspect Evidence →
          </button>
        </div>
      )}

      {/* Description */}
      <div className="mb-3">
        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Description
        </span>
        <p className="mt-0.5 text-xs text-[var(--color-text-primary)]">{event.description}</p>
      </div>

      {/* Full Metadata (JSON) */}
      <div>
        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Full Payload
        </span>
        <pre className="mt-1 overflow-x-auto rounded-md bg-[var(--color-bg-tertiary)] p-3 text-[11px] font-mono text-[var(--color-text-primary)] leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ─── Detail Field ────────────────────────────────────────────────────────────

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider shrink-0">
        {label}:
      </span>
      <span
        className={`text-xs text-[var(--color-text-primary)] truncate ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Pagination Controls ─────────────────────────────────────────────────────

function PaginationControls({
  page,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onGoToPage,
}: {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGoToPage: (page: number) => void;
}) {
  return (
    <div
      className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-secondary)]"
      role="navigation"
      aria-label="Audit trail pagination"
    >
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="rounded px-2 py-1 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="rounded px-2 py-1 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[200px]" aria-busy="true">
      <p className="text-sm text-[var(--color-text-secondary)]">Loading audit events…</p>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 min-h-[200px]">
      <p className="text-sm text-[var(--color-danger)]" role="alert">
        {error.message}
      </p>
      <button
        onClick={onRetry}
        className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[200px]">
      <p className="text-sm text-[var(--color-text-secondary)] italic">
        No audit events found for the current filters.
      </p>
    </div>
  );
}

export default AuditTrailViewer;
