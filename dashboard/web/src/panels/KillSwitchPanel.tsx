'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDataStream } from '../hooks/useDataStream';
import { useAuth } from '../hooks/useAuth';
import type {
  FreezeStateResponse,
  FreezeAuditEntry,
  StreamEvent,
} from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfirmationDialog {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

// ─── Confirmation Dialog Component ───────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--color-danger)]"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm text-[var(--color-text-secondary)]"
        >
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KillSwitchPanel Component ───────────────────────────────────────────────

/**
 * KillSwitchPanel — Provides freeze/unfreeze kill switch controls with
 * confirmation dialogs, current freeze state display, audit history, and
 * real-time updates via WebSocket.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
export function KillSwitchPanel() {
  const { getAuthHeaders } = useAuth();

  // ─── State ─────────────────────────────────────────────────────────────

  const [freezeState, setFreezeState] = useState<FreezeStateResponse | null>(null);
  const [history, setHistory] = useState<FreezeAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentIdInput, setAgentIdInput] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [dialog, setDialog] = useState<ConfirmationDialog>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const fetchState = useCallback(async () => {
    const baseUrl = getApiBaseUrl();
    const headers = getAuthHeaders();

    try {
      setError(null);

      const [stateRes, historyRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/freeze/state`, { headers }),
        fetch(`${baseUrl}/api/v1/freeze/history`, { headers }),
      ]);

      if (!stateRes.ok) {
        throw new Error(`Failed to fetch freeze state: ${stateRes.status} ${stateRes.statusText}`);
      }
      if (!historyRes.ok) {
        throw new Error(`Failed to fetch freeze history: ${historyRes.status} ${historyRes.statusText}`);
      }

      const stateData = (await stateRes.json()) as FreezeStateResponse;
      const historyData = (await historyRes.json()) as { results: FreezeAuditEntry[] };

      setFreezeState(stateData);
      setHistory(historyData.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch freeze data');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ─── Real-time Updates via WebSocket (Req 8.7) ─────────────────────────

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'freeze_change') {
        // Refresh state when a freeze/unfreeze event arrives
        fetchState();
      }
    },
    [fetchState],
  );

  const { status: streamStatus } = useDataStream({
    channels: ['freeze'],
    onEvent: handleStreamEvent,
  });

  // ─── Freeze/Unfreeze Actions ───────────────────────────────────────────

  const freezeAgent = useCallback(
    async (agentId: string) => {
      const baseUrl = getApiBaseUrl();
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };

      setActionInProgress(true);
      try {
        const res = await fetch(`${baseUrl}/api/v1/freeze/${encodeURIComponent(agentId)}`, {
          method: 'POST',
          headers,
        });

        if (!res.ok) {
          throw new Error(`Freeze failed: ${res.status} ${res.statusText}`);
        }

        // Refresh state after successful action
        await fetchState();
        setAgentIdInput('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Freeze action failed');
      } finally {
        setActionInProgress(false);
      }
    },
    [getAuthHeaders, fetchState],
  );

  const unfreezeAgent = useCallback(
    async (agentId: string) => {
      const baseUrl = getApiBaseUrl();
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };

      setActionInProgress(true);
      try {
        const res = await fetch(`${baseUrl}/api/v1/freeze/${encodeURIComponent(agentId)}`, {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          throw new Error(`Unfreeze failed: ${res.status} ${res.statusText}`);
        }

        // Refresh state after successful action
        await fetchState();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unfreeze action failed');
      } finally {
        setActionInProgress(false);
      }
    },
    [getAuthHeaders, fetchState],
  );

  // ─── Confirmation Dialog Handlers ──────────────────────────────────────

  const showFreezeAgentConfirm = () => {
    const agentId = agentIdInput.trim();
    if (!agentId) return;

    setDialog({
      visible: true,
      title: 'Freeze Agent',
      message: `Are you sure you want to freeze agent "${agentId}"? All requests from this agent will be blocked until unfrozen.`,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        freezeAgent(agentId);
      },
    });
  };

  const showFreezeAllConfirm = () => {
    const frozenCount = freezeState?.frozenAgents.length || 0;
    setDialog({
      visible: true,
      title: 'Freeze All Agents',
      message: `Are you sure you want to activate the global freeze (wildcard *)? ALL agent requests will be blocked across the entire system. ${frozenCount > 0 ? `Currently ${frozenCount} agent(s) are individually frozen.` : ''}`,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        freezeAgent('*');
      },
    });
  };

  const showUnfreezeConfirm = (agentId: string) => {
    const isWildcard = agentId === '*';
    setDialog({
      visible: true,
      title: isWildcard ? 'Unfreeze All Agents' : 'Unfreeze Agent',
      message: isWildcard
        ? 'Are you sure you want to deactivate the global freeze? All agents will resume normal operation.'
        : `Are you sure you want to unfreeze agent "${agentId}"? The agent will resume processing requests.`,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        unfreezeAgent(agentId);
      },
    });
  };

  const closeDialog = () => {
    setDialog((d) => ({ ...d, visible: false }));
  };

  // ─── Loading State ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Kill Switch</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-[var(--color-text-secondary)]">Loading freeze state...</div>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────

  if (error && !freezeState) {
    return (
      <div className="panel flex min-h-[200px] flex-col">
        <div className="panel-header">
          <span>Kill Switch</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchState();
            }}
            className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-white hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Confirmation Dialog */}
      {dialog.visible && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={closeDialog}
        />
      )}

      <div className="panel flex flex-col">
        <div className="panel-header">
          <span>Kill Switch</span>
          <span className="flex items-center gap-1.5 text-xs font-normal text-[var(--color-text-secondary)]">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                streamStatus === 'connected'
                  ? 'bg-[var(--color-success)]'
                  : streamStatus === 'reconnecting'
                    ? 'bg-[var(--color-warning)]'
                    : 'bg-[var(--color-danger)]'
              }`}
            />
            {streamStatus === 'connected' ? 'Live' : streamStatus === 'reconnecting' ? 'Reconnecting' : 'Disconnected'}
          </span>
        </div>

        {/* Error Banner (non-blocking) */}
        {error && (
          <div className="mb-3 rounded border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Current Freeze State (Req 8.1) */}
        <section aria-label="Current freeze state" className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Current State
          </h3>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3">
            {/* Wildcard status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    freezeState?.wildcardActive ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'
                  }`}
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  Global Freeze (*)
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  freezeState?.wildcardActive ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
                }`}
              >
                {freezeState?.wildcardActive ? 'ACTIVE' : 'Inactive'}
              </span>
            </div>

            {/* Frozen agents list */}
            {freezeState && freezeState.frozenAgents.length > 0 && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <div className="mb-2 text-xs text-[var(--color-text-secondary)]">
                  Frozen Agents ({freezeState.frozenAgents.length})
                </div>
                <div className="space-y-1.5">
                  {freezeState.frozenAgents.map((agentId) => (
                    <div
                      key={agentId}
                      className="flex items-center justify-between rounded bg-[var(--color-bg-secondary)] px-2 py-1.5"
                    >
                      <span className="font-mono text-xs text-[var(--color-text-primary)]">
                        {agentId}
                      </span>
                      <button
                        onClick={() => showUnfreezeConfirm(agentId)}
                        disabled={actionInProgress}
                        className="rounded border border-[var(--color-success)]/50 px-2 py-0.5 text-[10px] text-[var(--color-success)] hover:bg-[var(--color-success)]/10 disabled:opacity-50"
                        aria-label={`Unfreeze agent ${agentId}`}
                      >
                        Unfreeze
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No frozen agents message */}
            {freezeState && !freezeState.wildcardActive && freezeState.frozenAgents.length === 0 && (
              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                No agents are currently frozen.
              </div>
            )}

            {/* Global unfreeze button when wildcard is active (Req 8.5) */}
            {freezeState?.wildcardActive && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <button
                  onClick={() => showUnfreezeConfirm('*')}
                  disabled={actionInProgress}
                  className="w-full rounded border border-[var(--color-success)] px-3 py-1.5 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/10 disabled:opacity-50"
                >
                  Unfreeze All
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Freeze Controls (Req 8.2, 8.3, 8.4) */}
        <section aria-label="Freeze controls" className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Freeze Controls
          </h3>
          <div className="space-y-3">
            {/* Freeze Agent by ID */}
            <div className="flex gap-2">
              <input
                type="text"
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value)}
                placeholder="Enter agent ID..."
                className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
                aria-label="Agent ID to freeze"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') showFreezeAgentConfirm();
                }}
              />
              <button
                onClick={showFreezeAgentConfirm}
                disabled={actionInProgress || !agentIdInput.trim()}
                className="rounded bg-[var(--color-danger)] px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Freeze Agent
              </button>
            </div>

            {/* Freeze All (Req 8.3) */}
            <button
              onClick={showFreezeAllConfirm}
              disabled={actionInProgress || freezeState?.wildcardActive}
              className="w-full rounded border border-[var(--color-danger)] px-3 py-2 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
            >
              ⚠ Freeze All Agents (Global Kill Switch)
            </button>
          </div>
        </section>

        {/* Freeze/Unfreeze Audit Log (Req 8.6) */}
        <section aria-label="Freeze audit log" className="mt-auto">
          <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Audit Log
          </h3>
          {history.length === 0 ? (
            <div className="text-xs text-[var(--color-text-secondary)]">
              No freeze/unfreeze actions recorded yet.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded border border-[var(--color-border)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--color-bg-tertiary)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                      Time
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                      Action
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                      Target
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">
                      Actor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 text-[var(--color-text-secondary)]">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            entry.actionType === 'freeze'
                              ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                              : 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                          }`}
                        >
                          {entry.actionType === 'freeze' ? '🔒 Freeze' : '🔓 Unfreeze'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[var(--color-text-primary)]">
                        {entry.targetAgentId === '*' ? '* (all)' : entry.targetAgentId}
                      </td>
                      <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">
                        {entry.actor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default KillSwitchPanel;
