'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface AuditEvent {
  id: string;
  correlationId: string;
  timestamp: number;
  eventType: string;
  agentId: string;
  description: string;
  metadata: {
    allowed?: boolean;
    blockedStage?: string | null;
    totalLatencyMs?: number;
  };
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Audit Trail page — governance decision history log.
 */
export default function AuditPage() {

  const { data, isLoading, error } = useCachedQuery<AuditResponse>({
    endpoint: '/api/v1/audit/events',
    params: {
      pageSize: 25,
    },
  });

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Trail</h1>
        {data && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {data.total} events in period
          </span>
        )}
      </div>

      {isLoading && !data && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <SkeletonLoader key={i} variant="kpi-card" />)}
        </div>
      )}

      {error && !data && (
        <p className="text-sm text-red-400">Failed to load audit events</p>
      )}

      {data && data.events.length === 0 && (
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No audit events in the selected time range.</p>
        </div>
      )}

      {data && data.events.length > 0 && (
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[80px_1fr_140px_80px_70px] gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.1)] text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            <span>Time</span>
            <span>Description</span>
            <span>Agent</span>
            <span>Result</span>
            <span>Latency</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {data.events.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[80px_1fr_140px_80px_70px] gap-3 px-4 py-2.5 text-xs hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <span className="text-[var(--color-text-secondary)]">
                  {formatTime(event.timestamp)}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[var(--color-text-primary)] truncate">{event.description}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] truncate font-mono">{event.correlationId.slice(0, 16)}...</span>
                </div>
                <span className="text-[var(--color-text-primary)] truncate">{event.agentId}</span>
                <span className={event.metadata.allowed !== false ? 'text-emerald-400' : 'text-red-400'}>
                  {event.metadata.allowed !== false ? 'Allowed' : 'Blocked'}
                </span>
                <span className="text-[var(--color-text-secondary)]">{event.metadata.totalLatencyMs ?? '-'}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
