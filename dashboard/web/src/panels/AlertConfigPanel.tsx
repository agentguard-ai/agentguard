'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDataStream } from '../hooks/useDataStream';
import { useAuth } from '../hooks/useAuth';
import type {
  AlertConfiguration,
  TriggeredAlert,
  StreamEvent,
  AlertEvent,
} from '../../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';

const RULE_TYPES: AlertConfiguration['ruleType'][] = [
  'budget',
  'error_rate',
  'timeout_rate',
  'remediation_exhaustion',
  'contiguity_break',
];

const RULE_TYPE_LABELS: Record<AlertConfiguration['ruleType'], string> = {
  budget: 'Budget Warning',
  error_rate: 'Error Rate Spike',
  timeout_rate: 'Timeout Rate',
  remediation_exhaustion: 'Remediation Exhaustion',
  contiguity_break: 'Contiguity Break',
};

const SEVERITY_CLASSES: Record<TriggeredAlert['severity'], string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SEVERITY_DOT_CLASSES: Record<TriggeredAlert['severity'], string> = {
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

// ─── Form State ──────────────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  ruleType: AlertConfiguration['ruleType'];
  threshold: string;
  windowSeconds: string;
}

const EMPTY_FORM: RuleFormState = {
  name: '',
  ruleType: 'budget',
  threshold: '',
  windowSeconds: '300',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AlertConfigPanel — CRUD interface for alert rule configuration with
 * triggered alerts list and real-time notifications.
 *
 * Features:
 * - Alert rules list with enable/disable toggle switches
 * - Create/edit/delete alert rules
 * - Triggered alerts section with severity badges
 * - Real-time alert notifications via WebSocket
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
export function AlertConfigPanel() {
  const { getAuthHeaders } = useAuth();

  // ─── State ─────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<AlertConfiguration[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(EMPTY_FORM);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/alerts/rules`, { headers });
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data: AlertConfiguration[] = await res.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alert rules');
    }
  }, [getAuthHeaders]);

  const fetchTriggeredAlerts = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/alerts/triggered`, { headers });
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data: TriggeredAlert[] = await res.json();
      setTriggeredAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch triggered alerts');
    }
  }, [getAuthHeaders]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchRules(), fetchTriggeredAlerts()]);
    setLoading(false);
  }, [fetchRules, fetchTriggeredAlerts]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Real-time Updates via WebSocket ───────────────────────────────────

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'alert_triggered') {
        const alertPayload = event.payload as AlertEvent;
        const newTriggered: TriggeredAlert = {
          id: `${alertPayload.ruleId}-${alertPayload.timestamp}`,
          ruleId: alertPayload.ruleId,
          timestamp: alertPayload.timestamp,
          currentValue: alertPayload.currentValue,
          threshold: alertPayload.threshold,
          severity: alertPayload.severity,
          message: alertPayload.message,
          acknowledged: false,
          metadata: {},
        };
        setTriggeredAlerts((prev) => [newTriggered, ...prev]);
      }
    },
    [],
  );

  const { status: connectionStatus } = useDataStream({
    channels: ['alerts'],
    onEvent: handleStreamEvent,
  });

  // ─── CRUD Operations ───────────────────────────────────────────────────

  const handleToggleEnabled = useCallback(
    async (rule: AlertConfiguration) => {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/alerts/rules/${rule.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ enabled: !rule.enabled }),
        });
        if (!res.ok) throw new Error(`Failed to update rule: ${res.status}`);
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to toggle rule');
      }
    },
    [getAuthHeaders],
  );

  const handleDelete = useCallback(
    async (ruleId: string) => {
      const headers = getAuthHeaders();
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/alerts/rules/${ruleId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Failed to delete rule: ${res.status}`);
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete rule');
      }
    },
    [getAuthHeaders],
  );

  const handleSubmitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      // Validate
      if (!formState.name.trim()) {
        setFormError('Name is required');
        return;
      }
      const threshold = parseFloat(formState.threshold);
      if (isNaN(threshold) || threshold <= 0) {
        setFormError('Threshold must be a positive number');
        return;
      }
      const windowSeconds = parseInt(formState.windowSeconds, 10);
      if (isNaN(windowSeconds) || windowSeconds <= 0) {
        setFormError('Window must be a positive integer');
        return;
      }

      setSubmitting(true);
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const body = JSON.stringify({
        name: formState.name.trim(),
        ruleType: formState.ruleType,
        threshold,
        windowSeconds,
      });

      try {
        if (editingRuleId) {
          // Update existing rule
          const res = await fetch(
            `${API_BASE_URL}/api/v1/alerts/rules/${editingRuleId}`,
            { method: 'PUT', headers, body },
          );
          if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
          const updated: AlertConfiguration = await res.json();
          setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        } else {
          // Create new rule
          const res = await fetch(`${API_BASE_URL}/api/v1/alerts/rules`, {
            method: 'POST',
            headers,
            body,
          });
          if (!res.ok) throw new Error(`Failed to create: ${res.status}`);
          const created: AlertConfiguration = await res.json();
          setRules((prev) => [...prev, created]);
        }
        // Reset form
        setFormState(EMPTY_FORM);
        setEditingRuleId(null);
        setShowForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save rule');
      } finally {
        setSubmitting(false);
      }
    },
    [formState, editingRuleId, getAuthHeaders],
  );

  const handleEditRule = useCallback((rule: AlertConfiguration) => {
    setFormState({
      name: rule.name,
      ruleType: rule.ruleType,
      threshold: String(rule.threshold),
      windowSeconds: String(rule.windowSeconds),
    });
    setEditingRuleId(rule.id);
    setShowForm(true);
    setFormError(null);
  }, []);

  const handleCancelForm = useCallback(() => {
    setFormState(EMPTY_FORM);
    setEditingRuleId(null);
    setShowForm(false);
    setFormError(null);
  }, []);

  // ─── Loading State ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="panel flex min-h-[200px] flex-col" role="region" aria-label="Alert Configuration">
        <div className="panel-header">
          <span>Alert Configuration</span>
        </div>
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading alert configuration…</p>
        </div>
      </div>
    );
  }

  if (error && rules.length === 0) {
    return (
      <div className="panel flex min-h-[200px] flex-col" role="region" aria-label="Alert Configuration">
        <div className="panel-header">
          <span>Alert Configuration</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>
          <button
            onClick={fetchAll}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="panel flex flex-col" role="region" aria-label="Alert Configuration">
      {/* Header */}
      <div className="panel-header">
        <span>Alert Configuration</span>
        <div className="flex items-center gap-2">
          <ConnectionDot status={connectionStatus} />
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
              aria-label="Create new alert rule"
            >
              + Create Rule
            </button>
          )}
        </div>
      </div>

      {/* Create/Edit Rule Form */}
      {showForm && (
        <RuleForm
          formState={formState}
          setFormState={setFormState}
          onSubmit={handleSubmitForm}
          onCancel={handleCancelForm}
          isEditing={editingRuleId !== null}
          formError={formError}
          submitting={submitting}
        />
      )}

      {/* Alert Rules List */}
      <section aria-label="Alert rules" className="mb-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Rules ({rules.length})
        </h3>
        {rules.length === 0 ? (
          <p className="text-xs italic text-[var(--color-text-secondary)]">
            No alert rules configured. Create one to get started.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Alert rules list">
            {rules.map((rule) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                onToggle={handleToggleEnabled}
                onEdit={handleEditRule}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Triggered Alerts List */}
      <section aria-label="Triggered alerts">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Triggered Alerts ({triggeredAlerts.length})
        </h3>
        {triggeredAlerts.length === 0 ? (
          <p className="text-xs italic text-[var(--color-text-secondary)]">
            No alerts have been triggered.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto" aria-label="Triggered alerts list">
            {triggeredAlerts.map((alert) => (
              <TriggeredAlertItem key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RuleForm({
  formState,
  setFormState,
  onSubmit,
  onCancel,
  isEditing,
  formError,
  submitting,
}: {
  formState: RuleFormState;
  setFormState: React.Dispatch<React.SetStateAction<RuleFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
  formError: string | null;
  submitting: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3"
      aria-label={isEditing ? 'Edit alert rule' : 'Create alert rule'}
    >
      <h4 className="mb-3 text-xs font-semibold text-[var(--color-text-primary)]">
        {isEditing ? 'Edit Rule' : 'Create Rule'}
      </h4>

      {formError && (
        <p className="mb-2 text-xs text-[var(--color-danger)]" role="alert">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Name field */}
        <div className="col-span-2">
          <label
            htmlFor="rule-name"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Name
          </label>
          <input
            id="rule-name"
            type="text"
            value={formState.name}
            onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            placeholder="e.g., High error rate alert"
            required
            aria-required="true"
          />
        </div>

        {/* Rule Type select */}
        <div>
          <label
            htmlFor="rule-type"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Rule Type
          </label>
          <select
            id="rule-type"
            value={formState.ruleType}
            onChange={(e) =>
              setFormState((s) => ({
                ...s,
                ruleType: e.target.value as AlertConfiguration['ruleType'],
              }))
            }
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            aria-label="Alert rule type"
          >
            {RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RULE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Threshold number */}
        <div>
          <label
            htmlFor="rule-threshold"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Threshold
          </label>
          <input
            id="rule-threshold"
            type="number"
            step="any"
            min="0"
            value={formState.threshold}
            onChange={(e) => setFormState((s) => ({ ...s, threshold: e.target.value }))}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            placeholder="e.g., 80 for 80%"
            required
            aria-required="true"
          />
        </div>

        {/* Window Seconds number */}
        <div>
          <label
            htmlFor="rule-window"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Window (seconds)
          </label>
          <input
            id="rule-window"
            type="number"
            min="1"
            step="1"
            value={formState.windowSeconds}
            onChange={(e) => setFormState((s) => ({ ...s, windowSeconds: e.target.value }))}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            placeholder="300"
            required
            aria-required="true"
          />
        </div>
      </div>

      {/* Form actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isEditing ? 'Update Rule' : 'Create Rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function RuleItem({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AlertConfiguration;
  onToggle: (rule: AlertConfiguration) => void;
  onEdit: (rule: AlertConfiguration) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li
      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
        rule.enabled
          ? 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'
          : 'border-[var(--color-border)]/50 bg-[var(--color-bg-tertiary)]/50 opacity-60'
      }`}
      aria-label={`Alert rule: ${rule.name}`}
    >
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {rule.name}
          </span>
          <span className="rounded bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
            {RULE_TYPE_LABELS[rule.ruleType]}
          </span>
        </div>
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          Threshold: {rule.threshold} · Window: {rule.windowSeconds}s
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Enable/Disable Toggle */}
        <button
          onClick={() => onToggle(rule)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            rule.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
          }`}
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`${rule.enabled ? 'Disable' : 'Enable'} rule: ${rule.name}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>

        {/* Edit button */}
        <button
          onClick={() => onEdit(rule)}
          className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]"
          aria-label={`Edit rule: ${rule.name}`}
          title="Edit"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(rule.id)}
          className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-400"
          aria-label={`Delete rule: ${rule.name}`}
          title="Delete"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  );
}

function TriggeredAlertItem({ alert }: { alert: TriggeredAlert }) {
  const time = new Date(alert.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <li
      className={`rounded-md border px-3 py-2 ${SEVERITY_CLASSES[alert.severity]}`}
      aria-label={`${alert.severity} alert: ${alert.message}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT_CLASSES[alert.severity]}`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase">
            {alert.severity}
          </span>
        </div>
        <span className="text-[10px] opacity-70">{time}</span>
      </div>
      <p className="mt-1 text-xs">{alert.message}</p>
      <div className="mt-1 flex items-center gap-3 text-[10px] opacity-70">
        <span>Value: {alert.currentValue.toFixed(2)}</span>
        <span>Threshold: {alert.threshold}</span>
      </div>
    </li>
  );
}

function ConnectionDot({ status }: { status: 'connected' | 'disconnected' | 'reconnecting' }) {
  const colors: Record<typeof status, string> = {
    connected: 'bg-[var(--color-success)]',
    disconnected: 'bg-[var(--color-danger)]',
    reconnecting: 'bg-[var(--color-warning)]',
  };

  const labels: Record<typeof status, string> = {
    connected: 'Live',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting…',
  };

  return (
    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} aria-hidden="true" />
      <span>{labels[status]}</span>
    </div>
  );
}

export default AlertConfigPanel;
