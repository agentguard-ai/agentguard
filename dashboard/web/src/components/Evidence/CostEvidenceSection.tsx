'use client';

/**
 * CostEvidenceSection — Displays cost evidence fields from the TEEC envelope.
 *
 * Shows provider, model, token breakdown, USD costs, and estimated vs actual
 * cost comparison with variance. Displays a warning indicator when the actual
 * cost exceeds the estimated cost by more than 20% or the estimated cost is ≤ 0.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CostEvidenceDetail {
  provider: string;
  model: string;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  estimatedCost: number | null;
  actualCost: number | null;
  variance: number | null;
}

export interface CostEvidenceSectionProps {
  costEvidence: CostEvidenceDetail | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a USD value to 6 decimal places.
 */
function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}

/**
 * Format a token count with locale-aware thousand separators.
 */
function formatTokens(value: number): string {
  return value.toLocaleString();
}

/**
 * Determine if a cost variance warning should be shown.
 *
 * Warning is displayed when:
 * - actualCost > estimatedCost × 1.2 (actual exceeds estimate by more than 20%)
 * - OR estimatedCost ≤ 0
 */
export function shouldShowVarianceWarning(
  estimatedCost: number | null,
  actualCost: number | null,
): boolean {
  if (estimatedCost == null || actualCost == null) return false;
  return actualCost > estimatedCost * 1.2 || estimatedCost <= 0;
}

/**
 * Calculate variance: actual − estimated.
 */
export function calculateVariance(
  estimatedCost: number | null,
  actualCost: number | null,
): number | null {
  if (estimatedCost == null || actualCost == null) return null;
  return actualCost - estimatedCost;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function CostFieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]">
        {label}
      </span>
      <span
        className={`text-sm text-[var(--color-text-primary,#f9fafb)] ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function VarianceWarningIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
      role="alert"
      aria-label="Cost variance warning"
    >
      <svg
        className="h-4 w-4 flex-shrink-0 text-amber-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <span className="text-xs font-medium text-amber-400">
        Cost exceeds estimate threshold
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CostEvidenceSection({ costEvidence }: CostEvidenceSectionProps) {
  // Empty state when no cost data
  if (costEvidence == null) {
    return (
      <section
        className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
        aria-label="Cost evidence"
      >
        <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)] mb-3">
          Cost Evidence
        </h2>
        <p className="text-sm text-[var(--color-text-secondary,#9ca3af)]">
          No cost data available
        </p>
      </section>
    );
  }

  const {
    provider,
    model,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    requestTokens,
    responseTokens,
    totalTokens,
    estimatedCost,
    actualCost,
  } = costEvidence;

  const variance = calculateVariance(estimatedCost, actualCost);
  const showWarning = shouldShowVarianceWarning(estimatedCost, actualCost);

  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
      aria-label="Cost evidence"
    >
      <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)] mb-4">
        Cost Evidence
      </h2>

      {/* Provider & Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <CostFieldItem label="Provider" value={provider} />
        <CostFieldItem label="Model" value={model} />
      </div>

      {/* USD Costs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <CostFieldItem label="Input Cost" value={formatUsd(inputCostUsd)} mono />
        <CostFieldItem label="Output Cost" value={formatUsd(outputCostUsd)} mono />
        <CostFieldItem label="Total Cost" value={formatUsd(totalCostUsd)} mono />
      </div>

      {/* Token Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <CostFieldItem label="Request Tokens" value={formatTokens(requestTokens)} mono />
        <CostFieldItem label="Response Tokens" value={formatTokens(responseTokens)} mono />
        <CostFieldItem label="Total Tokens" value={formatTokens(totalTokens)} mono />
      </div>

      {/* Estimated vs Actual Cost Comparison */}
      {(estimatedCost != null || actualCost != null) && (
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-4 mt-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)] mb-3">
            Estimated vs Actual
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            {estimatedCost != null && (
              <CostFieldItem label="Estimated Cost" value={formatUsd(estimatedCost)} mono />
            )}
            {actualCost != null && (
              <CostFieldItem label="Actual Cost" value={formatUsd(actualCost)} mono />
            )}
            {variance != null && (
              <CostFieldItem
                label="Variance"
                value={`${variance >= 0 ? '+' : ''}${formatUsd(variance)}`}
                mono
              />
            )}
          </div>

          {/* Warning indicator */}
          {showWarning && <VarianceWarningIndicator />}
        </div>
      )}
    </section>
  );
}

export default CostEvidenceSection;
