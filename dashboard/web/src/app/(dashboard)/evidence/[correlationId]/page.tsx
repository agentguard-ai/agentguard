'use client';

import { useParams } from 'next/navigation';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ReasonChainSection, type ModuleEvaluationDetail } from '@/components/Evidence/ReasonChainSection';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvidenceEnvelopeResponse {
  correlationId: string;
  agentId: string;
  timestamp: number;
  teec_version: string;
  action: string;
  intent_ref: string;
  receipt_ref: string;
  seq: number;
  running_count: number;
  moduleEvaluations: ModuleEvaluationDetail[];
  governanceSeal: unknown | null;
  costEvidence: unknown | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a Unix millisecond timestamp in the user's locale with date, hours, minutes, and seconds.
 */
export function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}

// ─── Action Badge ────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    ALLOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    DENY: 'bg-red-500/15 text-red-400 border-red-500/30',
    SANITIZE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    REPORT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  const style = styles[action] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}

// ─── Top Fields Section ──────────────────────────────────────────────────────

interface TopFieldsSectionProps {
  evidence: EvidenceEnvelopeResponse;
}

function TopFieldsSection({ evidence }: TopFieldsSectionProps) {
  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
      aria-label="Evidence top-level fields"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)]">
          Evidence Envelope
        </h2>
        <ActionBadge action={evidence.action} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <FieldItem label="Correlation ID" value={evidence.correlationId} mono />
        <FieldItem label="Agent ID" value={evidence.agentId} />
        <FieldItem label="Timestamp" value={formatTimestamp(evidence.timestamp)} />
        <FieldItem label="TEEC Version" value={evidence.teec_version} />
        <FieldItem label="Action" value={evidence.action} />
        <FieldItem label="Intent Ref" value={evidence.intent_ref} mono />
        <FieldItem label="Receipt Ref" value={evidence.receipt_ref} mono />
        <FieldItem label="Sequence" value={String(evidence.seq)} />
        <FieldItem label="Running Count" value={String(evidence.running_count)} />
      </div>
    </section>
  );
}

function FieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]">
        {label}
      </span>
      <span
        className={`text-sm text-[var(--color-text-primary,#f9fafb)] break-all ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Error Display ───────────────────────────────────────────────────────────

interface ErrorDisplayProps {
  correlationId: string;
  reason: string;
}

function ErrorDisplay({ correlationId, reason }: ErrorDisplayProps) {
  return (
    <div
      className="rounded-lg border border-red-500/30 bg-red-500/10 p-5"
      role="alert"
      aria-label="Evidence loading error"
    >
      <h2 className="text-sm font-semibold text-red-400 mb-2">Failed to load evidence</h2>
      <p className="text-sm text-[var(--color-text-primary,#f9fafb)]">
        Could not load evidence for correlation ID:{' '}
        <span className="font-mono">{correlationId}</span>
      </p>
      <p className="text-xs text-[var(--color-text-secondary,#9ca3af)] mt-1">
        Reason: {reason}
      </p>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function EvidenceLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonLoader variant="kpi-card" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse flex flex-col gap-1"
            role="status"
            aria-label="Loading field"
          >
            <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary,#1e293b)]" />
            <div className="h-4 w-32 rounded bg-[var(--color-bg-tertiary,#1e293b)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

/**
 * Evidence Detail page — displays the full TEEC evidence envelope for a single decision.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export default function EvidenceDetailPage() {
  const params = useParams<{ correlationId: string }>();
  const correlationId = params.correlationId;

  const { data, isLoading, error } = useCachedQuery<EvidenceEnvelopeResponse>({
    endpoint: `/api/v1/decisions/${correlationId}/evidence`,
    enabled: !!correlationId,
  });

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evidence Detail</h1>
      </div>

      {/* Loading state */}
      {isLoading && !data && <EvidenceLoadingSkeleton />}

      {/* Error state */}
      {error && !data && (
        <ErrorDisplay
          correlationId={correlationId}
          reason={error.message}
        />
      )}

      {/* Loaded state — top-level fields */}
      {data && <TopFieldsSection evidence={data} />}

      {/* Reason chain — module evaluations grouped by stage */}
      {data && data.moduleEvaluations.length > 0 && (
        <ReasonChainSection moduleEvaluations={data.moduleEvaluations} />
      )}
    </div>
  );
}
