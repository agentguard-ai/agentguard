'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportButtonProps {
  /** The correlationId for the evidence to export */
  correlationId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ExportButton — Triggers a browser download of the TEEC evidence pack as JSON.
 *
 * Fetches from GET /api/v1/decisions/{correlationId}/evidence/export, converts the
 * response to a Blob, and creates a temporary <a> element to trigger the download.
 * On failure, displays an inline error with the failure reason and a "Retry" button.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */
export function ExportButton({ correlationId }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAuthHeaders } = useAuth();

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/v1/decisions/${encodeURIComponent(correlationId)}/evidence/export`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let reason = `HTTP ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.message) reason = parsed.message;
        } catch {
          // Use default reason
        }
        throw new Error(reason);
      }

      const blob = await response.blob();
      const filename = `teec-evidence-${correlationId}.json`;

      // Create a temporary link element to trigger the download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(reason);
    } finally {
      setIsExporting(false);
    }
  }, [correlationId, getAuthHeaders]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        aria-label="Export Evidence Pack"
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary,#0f172a)] focus:ring-blue-500 ${
          isExporting
            ? 'cursor-not-allowed border-[rgba(255,255,255,0.05)] bg-[var(--color-bg-tertiary,#1e293b)] text-[var(--color-text-secondary,#9ca3af)]'
            : 'border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] text-[var(--color-text-primary,#f9fafb)] hover:bg-[var(--color-bg-tertiary,#1e293b)]'
        }`}
      >
        {/* Download icon */}
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {isExporting ? 'Exporting…' : 'Export Evidence Pack'}
      </button>

      {/* Error notification with retry */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2"
          role="alert"
          aria-label="Export error"
        >
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-red-400">
              Export failed: <span className="text-[var(--color-text-primary,#f9fafb)]">{error}</span>
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="self-start text-xs font-medium text-blue-400 hover:text-blue-300 underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
              aria-label="Retry export"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportButton;
