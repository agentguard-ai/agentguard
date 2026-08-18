'use client';

/**
 * ConfidenceSection — Displays findings with confidence scores, color-coded
 * by classification level (low/medium/high).
 *
 * Findings are sorted by confidence in descending order (highest first).
 * Each finding shows type, category, confidence percentage, and severity.
 *
 * Confidence classification:
 * - low: value < 0.4 (red/orange)
 * - medium: 0.4 ≤ value ≤ 0.7 (amber/yellow)
 * - high: value > 0.7 (emerald/green)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Detail of a single finding within a module evaluation. */
export interface FindingDetail {
  type: string;
  category: string;
  confidence: number;
  severity: string;
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ConfidenceSectionProps {
  findings: FindingDetail[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Classify a confidence value into low, medium, or high.
 *
 * - low: value < 0.4
 * - medium: 0.4 ≤ value ≤ 0.7
 * - high: value > 0.7
 */
export function classifyConfidence(value: number): ConfidenceLevel {
  if (value < 0.4) return 'low';
  if (value <= 0.7) return 'medium';
  return 'high';
}

/**
 * Format a confidence value (0–1) as a percentage string (0–100%).
 */
export function formatConfidencePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Sort findings by confidence in descending order (highest first).
 * Returns a new array — does not mutate the input.
 */
export function sortFindingsByConfidence(findings: FindingDetail[]): FindingDetail[] {
  return [...findings].sort((a, b) => b.confidence - a.confidence);
}

// ─── Color / Style Mapping ───────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { badge: string; bar: string; label: string }> = {
  low: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    bar: 'bg-red-500',
    label: 'Low',
  },
  medium: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    bar: 'bg-amber-500',
    label: 'Medium',
  },
  high: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    bar: 'bg-emerald-500',
    label: 'High',
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Confidence bar indicator showing a filled percentage bar with color coding. */
function ConfidenceBar({ value, level }: { value: number; level: ConfidenceLevel }) {
  const styles = CONFIDENCE_STYLES[level];
  const widthPercent = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-20 rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden"
        role="progressbar"
        aria-valuenow={widthPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence: ${widthPercent}% (${styles.label})`}
      >
        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--color-text-primary,#f9fafb)] min-w-[3ch]">
        {formatConfidencePercent(value)}
      </span>
    </div>
  );
}

/** Badge displaying the confidence level classification. */
function ConfidenceLevelBadge({ level }: { level: ConfidenceLevel }) {
  const styles = CONFIDENCE_STYLES[level];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}
    >
      {styles.label}
    </span>
  );
}

/** Severity badge for a finding. */
function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity.toLowerCase()] || SEVERITY_STYLES.info;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${style}`}
    >
      {severity}
    </span>
  );
}

/** Single finding row. */
function FindingRow({ finding }: { finding: FindingDetail }) {
  const level = classifyConfidence(finding.confidence);

  return (
    <div
      className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 rounded-md border border-[rgba(255,255,255,0.06)] bg-[var(--color-bg-tertiary,#1e293b)]/50"
      role="row"
    >
      {/* Type */}
      <span
        className="text-sm text-[var(--color-text-primary,#f9fafb)] truncate"
        title={finding.type}
        role="cell"
      >
        {finding.type}
      </span>

      {/* Category */}
      <span
        className="text-sm text-[var(--color-text-secondary,#9ca3af)] truncate"
        title={finding.category}
        role="cell"
      >
        {finding.category}
      </span>

      {/* Confidence bar + percentage */}
      <div role="cell">
        <ConfidenceBar value={finding.confidence} level={level} />
      </div>

      {/* Confidence level badge */}
      <div role="cell">
        <ConfidenceLevelBadge level={level} />
      </div>

      {/* Severity badge */}
      <div role="cell">
        <SeverityBadge severity={finding.severity} />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * ConfidenceSection renders all findings sorted by confidence (descending),
 * with color-coded indicators for confidence level and severity.
 */
export function ConfidenceSection({ findings }: ConfidenceSectionProps) {
  if (!findings || findings.length === 0) {
    return (
      <section
        className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
        aria-label="Confidence scores"
      >
        <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)] mb-3">
          Confidence Scores
        </h2>
        <p className="text-sm text-[var(--color-text-secondary,#9ca3af)] italic">
          No findings available
        </p>
      </section>
    );
  }

  const sorted = sortFindingsByConfidence(findings);

  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
      aria-label="Confidence scores"
    >
      <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)] mb-4">
        Confidence Scores
      </h2>

      {/* Column headers */}
      <div
        className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]"
        role="row"
        aria-hidden="true"
      >
        <span>Type</span>
        <span>Category</span>
        <span className="w-[calc(5rem+2rem+3ch)]">Confidence</span>
        <span>Level</span>
        <span>Severity</span>
      </div>

      {/* Finding rows */}
      <div className="flex flex-col gap-1.5" role="table" aria-label="Findings list">
        {sorted.map((finding, index) => (
          <FindingRow key={`${finding.type}-${finding.category}-${index}`} finding={finding} />
        ))}
      </div>
    </section>
  );
}

export default ConfidenceSection;
