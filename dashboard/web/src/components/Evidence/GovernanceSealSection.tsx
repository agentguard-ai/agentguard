'use client';

import { useState } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * The genesis receipt reference — 64 zero characters indicating the first
 * decision in an agent's receipt chain.
 */
export const GENESIS_RECEIPT_REF = '0'.repeat(64);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GovernanceSealDetail {
  hmac: string;
  timestamp: number;
  agent_id: string;
}

export interface ReceiptChainData {
  intent_ref: string;
  receipt_ref: string;
  seq: number;
  normalization_id?: string;
}

export interface GovernanceSealSectionProps {
  /** Governance seal data; null when seal is unavailable. */
  seal: GovernanceSealDetail | null;
  /** Receipt chain fields from the evidence envelope. */
  receiptChain: ReceiptChainData;
  /** The decision-level timestamp (Unix ms) used to compute time difference. */
  decisionTimestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Truncate an HMAC hex string to the first 16 characters + "..." for display.
 */
export function truncateHmac(hmac: string): string {
  if (hmac.length <= 16) return hmac;
  return `${hmac.slice(0, 16)}...`;
}

/**
 * Detect whether a receipt_ref represents the chain genesis.
 * Returns true only if the value is exactly 64 zero characters.
 */
export function isGenesisReceipt(receiptRef: string | null | undefined): boolean {
  if (receiptRef == null) return false;
  return receiptRef === GENESIS_RECEIPT_REF;
}

/**
 * Calculate time difference (seal timestamp - decision timestamp) in ms.
 */
export function calculateTimeDifference(
  sealTimestamp: number,
  decisionTimestamp: number,
): number {
  return sealTimestamp - decisionTimestamp;
}

/**
 * Format a millisecond time difference as a human-readable string.
 * Examples: "+12ms", "-5ms", "+1.2s", "+0ms"
 */
export function formatTimeDifference(diffMs: number): string {
  const sign = diffMs >= 0 ? '+' : '';
  if (Math.abs(diffMs) < 1000) {
    return `${sign}${diffMs}ms`;
  }
  return `${sign}${(diffMs / 1000).toFixed(1)}s`;
}

/**
 * Format a Unix millisecond timestamp for seal display.
 */
function formatSealTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SealFieldItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
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

function CopySealButton({ hmac }: { hmac: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hmac);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Graceful fallback — Clipboard API unavailable
      // eslint-disable-next-line no-console
      console.warn('Clipboard API unavailable, could not copy seal.');
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-tertiary,#1e293b)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary,#f9fafb)] transition-colors hover:bg-[var(--color-bg-secondary,#111827)]"
      aria-label="Copy full HMAC seal to clipboard"
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied
        </>
      ) : (
        <>
          <ClipboardIcon />
          Copy Seal
        </>
      )}
    </button>
  );
}

function ClipboardIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function GenesisLabel() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/15 px-2.5 py-0.5 text-xs font-medium text-teal-400"
      aria-label="Chain Genesis"
    >
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
          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
        />
      </svg>
      Chain Genesis
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * GovernanceSealSection — Displays the governance seal and receipt chain fields
 * for a TEEC evidence envelope. Includes HMAC truncation with copy, genesis
 * detection, and seal-to-decision time difference.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function GovernanceSealSection({
  seal,
  receiptChain,
  decisionTimestamp,
}: GovernanceSealSectionProps) {
  const timeDiff =
    seal != null
      ? calculateTimeDifference(seal.timestamp, decisionTimestamp)
      : null;

  const showGenesisLabel = isGenesisReceipt(receiptChain.receipt_ref);

  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
      aria-label="Governance seal and receipt chain"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)]">
          Governance Seal &amp; Receipt Chain
        </h2>
        {showGenesisLabel && <GenesisLabel />}
      </div>

      {/* Seal fields */}
      {seal != null ? (
        <div className="mb-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)] mb-3">
            Seal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]">
                HMAC
              </span>
              <span className="text-sm font-mono text-[var(--color-text-primary,#f9fafb)] break-all">
                {truncateHmac(seal.hmac)}
              </span>
            </div>
            <SealFieldItem
              label="Seal Timestamp"
              value={formatSealTimestamp(seal.timestamp)}
            />
            <SealFieldItem label="Agent ID" value={seal.agent_id} />
          </div>

          {/* Time difference */}
          {timeDiff !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)]">
                Seal–Decision Δ
              </span>
              <span className="text-xs font-mono text-[var(--color-text-primary,#f9fafb)]">
                {formatTimeDifference(timeDiff)}
              </span>
            </div>
          )}

          {/* Copy button */}
          <div className="mt-3">
            <CopySealButton hmac={seal.hmac} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary,#9ca3af)] mb-5">
          No governance seal available
        </p>
      )}

      {/* Receipt chain fields */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)] mb-3">
          Receipt Chain
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SealFieldItem label="Intent Ref" value={receiptChain.intent_ref} mono />
          <SealFieldItem label="Receipt Ref" value={receiptChain.receipt_ref} mono />
          <SealFieldItem label="Sequence" value={String(receiptChain.seq)} />
          {receiptChain.normalization_id != null && (
            <SealFieldItem
              label="Normalization ID"
              value={receiptChain.normalization_id}
              mono
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default GovernanceSealSection;
