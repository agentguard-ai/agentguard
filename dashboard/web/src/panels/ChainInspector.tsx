'use client';

import { useState, useCallback } from 'react';
import type { ChainVerificationResponse, ChainDecisionView } from '../../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';

// ─── Seal Status Colors ──────────────────────────────────────────────────────

type SealStatus = 'valid' | 'invalid' | 'not-sealed';

const SEAL_STATUS_CLASSES: Record<SealStatus, string> = {
  valid: 'text-[var(--color-success)]',
  invalid: 'text-[var(--color-danger)]',
  'not-sealed': 'text-[var(--color-text-secondary)]',
};

const SEAL_STATUS_ICONS: Record<SealStatus, string> = {
  valid: '✓',
  invalid: '✗',
  'not-sealed': '○',
};

const SEAL_STATUS_LABELS: Record<SealStatus, string> = {
  valid: 'Seal valid',
  invalid: 'Seal invalid',
  'not-sealed': 'Not sealed',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ChainInspector — Visualize TEEC v2.1 StageDecision chains with seal validation.
 *
 * Displays:
 * - Visual chain flow from PRE_EXECUTION to POST_EXECUTION
 * - intent_ref and receipt_ref values with connecting arrows
 * - Seal validation status (valid / invalid / not-sealed)
 * - "Verify Contiguity" button calling POST endpoint
 * - Break point highlighting on failure with expected vs actual receipt_ref
 * - Seq values with monotonicity indicator
 * - Copy-to-clipboard for HMAC values
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function ChainInspector() {
  const [correlationId, setCorrelationId] = useState('');
  const [chainData, setChainData] = useState<ChainVerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResponse | null>(null);
  const [copiedHmac, setCopiedHmac] = useState<string | null>(null);

  // ─── Fetch chain data ────────────────────────────────────────────────────

  const fetchChain = useCallback(async () => {
    if (!correlationId.trim()) {
      setError('Please enter a correlation ID');
      return;
    }

    setLoading(true);
    setError(null);
    setVerificationResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/chain/${encodeURIComponent(correlationId.trim())}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No chain found for this correlation ID');
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const result: ChainVerificationResponse = await response.json();
      setChainData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chain');
      setChainData(null);
    } finally {
      setLoading(false);
    }
  }, [correlationId]);

  // ─── Verify contiguity ───────────────────────────────────────────────────

  const verifyContiguity = useCallback(async () => {
    if (!correlationId.trim()) return;

    setVerifying(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/chain/${encodeURIComponent(correlationId.trim())}/verify`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }
      const result: ChainVerificationResponse = await response.json();
      setVerificationResult(result);
      // Update chain data with verification result (includes seal validation)
      setChainData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed');
    } finally {
      setVerifying(false);
    }
  }, [correlationId]);

  // ─── Copy HMAC to clipboard ──────────────────────────────────────────────

  const copyHmac = useCallback(async (hmac: string) => {
    try {
      await navigator.clipboard.writeText(hmac);
      setCopiedHmac(hmac);
      setTimeout(() => setCopiedHmac(null), 2000);
    } catch {
      // Fallback: some browsers restrict clipboard in non-secure contexts
      console.warn('[ChainInspector] Clipboard write failed');
    }
  }, []);

  // ─── Handle Enter key in input ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        fetchChain();
      }
    },
    [fetchChain]
  );

  // ─── Seq monotonicity check ──────────────────────────────────────────────

  const isMonotonicallyIncreasing = useCallback((decisions: ChainDecisionView[]): boolean => {
    for (let i = 1; i < decisions.length; i++) {
      if (decisions[i].seq <= decisions[i - 1].seq) {
        return false;
      }
    }
    return true;
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="panel flex flex-col" role="region" aria-label="Chain Inspector">
      {/* Header */}
      <div className="panel-header">
        <span>Chain Inspector</span>
        <span className="text-[10px] text-[var(--color-text-secondary)]">TEEC v2.1</span>
      </div>

      {/* Correlation ID Input */}
      <div className="mb-4 flex gap-2">
        <label htmlFor="chain-correlation-id" className="sr-only">
          Correlation ID
        </label>
        <input
          id="chain-correlation-id"
          type="text"
          value={correlationId}
          onChange={(e) => setCorrelationId(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter correlation ID to inspect chain…"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-describedby="chain-input-help"
        />
        <button
          onClick={fetchChain}
          disabled={loading || !correlationId.trim()}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Inspect chain"
        >
          {loading ? 'Loading…' : 'Inspect'}
        </button>
      </div>
      <p id="chain-input-help" className="sr-only">
        Enter a pipeline execution correlation ID to view its TEEC decision chain
      </p>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2" role="alert">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Chain visualization */}
      {chainData && chainData.decisions.length > 0 && (
        <ChainVisualization
          chainData={chainData}
          verificationResult={verificationResult}
          isMonotonicallyIncreasing={isMonotonicallyIncreasing(chainData.decisions)}
          onVerify={verifyContiguity}
          verifying={verifying}
          onCopyHmac={copyHmac}
          copiedHmac={copiedHmac}
        />
      )}

      {/* Empty state after fetch */}
      {chainData && chainData.decisions.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-[var(--color-text-secondary)] italic">
            No decisions found in chain for this correlation ID
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Chain Visualization Sub-component ───────────────────────────────────────

interface ChainVisualizationProps {
  chainData: ChainVerificationResponse;
  verificationResult: ChainVerificationResponse | null;
  isMonotonicallyIncreasing: boolean;
  onVerify: () => void;
  verifying: boolean;
  onCopyHmac: (hmac: string) => void;
  copiedHmac: string | null;
}

function ChainVisualization({
  chainData,
  verificationResult,
  isMonotonicallyIncreasing,
  onVerify,
  verifying,
  onCopyHmac,
  copiedHmac,
}: ChainVisualizationProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: Verify button + Monotonicity indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onVerify}
            disabled={verifying}
            className="rounded-md border border-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Verify contiguity of the decision chain"
          >
            {verifying ? 'Verifying…' : 'Verify Contiguity'}
          </button>

          {/* Verification result badge */}
          {verificationResult && (
            <VerificationBadge result={verificationResult} />
          )}
        </div>

        {/* Seq monotonicity indicator */}
        <div
          className="flex items-center gap-1.5 text-xs"
          aria-label={`Sequence monotonicity: ${isMonotonicallyIncreasing ? 'valid' : 'broken'}`}
        >
          <span className="text-[var(--color-text-secondary)]">Seq order:</span>
          <span
            className={isMonotonicallyIncreasing ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}
          >
            {isMonotonicallyIncreasing ? '✓ Monotonic' : '✗ Non-monotonic'}
          </span>
        </div>
      </div>

      {/* Break point details (shown on verification failure) */}
      {verificationResult && !verificationResult.valid && (
        <BreakPointDetails result={verificationResult} />
      )}

      {/* Chain cards */}
      <div
        className="flex flex-col"
        role="list"
        aria-label="Decision chain"
      >
        {chainData.decisions.map((decision, index) => (
          <div key={decision.index} role="listitem">
            <ChainCard
              decision={decision}
              isBreakPoint={verificationResult?.breakIndex === decision.index}
              onCopyHmac={onCopyHmac}
              copiedHmac={copiedHmac}
            />
            {/* Connecting arrow between cards */}
            {index < chainData.decisions.length - 1 && (
              <ChainArrow
                fromReceiptRef={decision.receiptRef}
                toIntentRef={chainData.decisions[index + 1].intentRef}
                isBreak={
                  verificationResult?.breakIndex === chainData.decisions[index + 1].index
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Verification Badge ──────────────────────────────────────────────────────

function VerificationBadge({ result }: { result: ChainVerificationResponse }) {
  if (result.valid) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/20 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]"
        role="status"
        aria-label="Contiguity verification passed"
      >
        ✓ Contiguous
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/20 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-danger)]"
      role="status"
      aria-label="Contiguity verification failed"
    >
      ✗ Break detected
    </span>
  );
}

// ─── Break Point Details ─────────────────────────────────────────────────────

function BreakPointDetails({ result }: { result: ChainVerificationResponse }) {
  return (
    <div
      className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3"
      role="alert"
      aria-label="Chain break details"
    >
      <p className="mb-2 text-xs font-semibold text-[var(--color-danger)]">
        Chain break at decision index {result.breakIndex}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--color-text-secondary)]">Expected receipt_ref:</span>
          <p className="mt-0.5 break-all font-mono text-[var(--color-text-primary)]">
            {result.expectedReceiptRef || '—'}
          </p>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">Actual receipt_ref:</span>
          <p className="mt-0.5 break-all font-mono text-[var(--color-text-primary)]">
            {result.actualReceiptRef || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Chain Card ──────────────────────────────────────────────────────────────

interface ChainCardProps {
  decision: ChainDecisionView;
  isBreakPoint: boolean;
  onCopyHmac: (hmac: string) => void;
  copiedHmac: string | null;
}

function ChainCard({ decision, isBreakPoint, onCopyHmac, copiedHmac }: ChainCardProps) {
  const sealStatus: SealStatus = decision.governanceSeal
    ? decision.sealValid
      ? 'valid'
      : 'invalid'
    : 'not-sealed';

  return (
    <div
      className={`rounded-md border p-3 ${
        isBreakPoint
          ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'
      }`}
      aria-label={`Decision ${decision.index}: ${decision.stage} - ${decision.action}${isBreakPoint ? ' (break point)' : ''}`}
    >
      {/* Card header: stage, action, seq, seal status */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">
            {decision.stage}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              decision.action === 'ALLOW'
                ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                : decision.action === 'DENY'
                ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
                : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
            }`}
          >
            {decision.action}
          </span>
          {isBreakPoint && (
            <span className="text-[10px] font-bold text-[var(--color-danger)]" aria-label="Break point">
              ⚠ BREAK
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Seq value */}
          <span
            className="text-xs font-mono text-[var(--color-text-secondary)]"
            title={`Sequence number: ${decision.seq}`}
          >
            seq: {decision.seq}
          </span>

          {/* Seal status indicator */}
          <span
            className={`text-sm font-bold ${SEAL_STATUS_CLASSES[sealStatus]}`}
            title={SEAL_STATUS_LABELS[sealStatus]}
            aria-label={SEAL_STATUS_LABELS[sealStatus]}
          >
            {SEAL_STATUS_ICONS[sealStatus]}
          </span>
        </div>
      </div>

      {/* Ref values */}
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--color-text-secondary)]">intent_ref:</span>
          <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--color-text-primary)]">
            {decision.intentRef}
          </p>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">receipt_ref:</span>
          <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--color-text-primary)]">
            {decision.receiptRef}
          </p>
        </div>
      </div>

      {/* Governance seal details (if sealed) */}
      {decision.governanceSeal && (
        <div className="border-t border-[var(--color-border)]/50 pt-2">
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
            <span>HMAC:</span>
            <code className="flex-1 truncate font-mono text-[var(--color-text-primary)]">
              {decision.governanceSeal.hmac}
            </code>
            <button
              onClick={() => onCopyHmac(decision.governanceSeal!.hmac)}
              className="flex-shrink-0 rounded p-0.5 hover:bg-[var(--color-bg-secondary)]"
              title="Copy HMAC to clipboard"
              aria-label={`Copy HMAC value for decision ${decision.index}`}
            >
              {copiedHmac === decision.governanceSeal.hmac ? (
                <span className="text-[var(--color-success)]" aria-live="polite">✓</span>
              ) : (
                <ClipboardIcon />
              )}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
            <span>Agent: {decision.governanceSeal.agentId}</span>
            <span>
              Sealed: {new Date(decision.governanceSeal.timestamp).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'medium',
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chain Arrow ─────────────────────────────────────────────────────────────

interface ChainArrowProps {
  fromReceiptRef: string;
  toIntentRef: string;
  isBreak: boolean;
}

function ChainArrow({ fromReceiptRef, toIntentRef, isBreak }: ChainArrowProps) {
  const matches = fromReceiptRef === toIntentRef;

  return (
    <div
      className="flex flex-col items-center py-1"
      aria-label={`Chain link: receipt_ref ${matches ? 'matches' : 'does not match'} next intent_ref`}
    >
      {/* Vertical connecting line */}
      <div
        className={`h-4 w-0.5 ${
          isBreak
            ? 'bg-[var(--color-danger)]'
            : matches
            ? 'bg-[var(--color-success)]'
            : 'bg-[var(--color-warning)]'
        }`}
        aria-hidden="true"
      />
      {/* Arrow head */}
      <div
        className={`text-xs ${
          isBreak
            ? 'text-[var(--color-danger)]'
            : matches
            ? 'text-[var(--color-success)]'
            : 'text-[var(--color-warning)]'
        }`}
        aria-hidden="true"
      >
        ▼
      </div>
      {/* Link label */}
      <span
        className={`text-[9px] font-mono ${
          isBreak
            ? 'text-[var(--color-danger)]'
            : matches
            ? 'text-[var(--color-text-secondary)]'
            : 'text-[var(--color-warning)]'
        }`}
      >
        {isBreak ? 'BROKEN' : matches ? 'receipt→intent' : 'MISMATCH'}
      </span>
    </div>
  );
}

// ─── Clipboard Icon ──────────────────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default ChainInspector;
