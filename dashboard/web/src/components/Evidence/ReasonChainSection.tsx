'use client';

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Detail of a single reason code enriched from the TEEC registry. */
export interface ReasonCodeDetail {
  code: string;
  title: string;
  severity: string;
}

/** Per-module evaluation detail within the evidence envelope. */
export interface ModuleEvaluationDetail {
  moduleName: string;
  moduleVersion: string;
  stage: 'PRE_EXECUTION' | 'POST_EXECUTION';
  action: string;
  latencyMs: number;
  reasonCodes: ReasonCodeDetail[];
  findings: unknown[];
  error: string | null;
}

/** Action types in order of restrictiveness (most to least). */
const ACTION_PRECEDENCE = ['DENY', 'SANITIZE', 'REPORT', 'ALLOW'] as const;
type ActionType = (typeof ACTION_PRECEDENCE)[number];

/** Result of merging actions across module evaluations. */
interface MergedActionResult {
  action: ActionType;
  responsibleModule: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ReasonChainSectionProps {
  moduleEvaluations: ModuleEvaluationDetail[];
}

// ─── Action Merge Logic ──────────────────────────────────────────────────────

/**
 * Determine the most restrictive action from a set of module evaluations.
 * Precedence: DENY > SANITIZE > REPORT > ALLOW.
 * Returns the merged action and the name of the responsible module.
 */
export function mergeActions(evaluations: ModuleEvaluationDetail[]): MergedActionResult {
  if (evaluations.length === 0) {
    return { action: 'ALLOW', responsibleModule: '' };
  }

  let bestPrecedenceIndex = ACTION_PRECEDENCE.length - 1; // Start at ALLOW
  let responsibleModule = '';

  for (const evaluation of evaluations) {
    const actionIndex = ACTION_PRECEDENCE.indexOf(evaluation.action as ActionType);
    if (actionIndex === -1) continue;

    if (actionIndex < bestPrecedenceIndex) {
      bestPrecedenceIndex = actionIndex;
      responsibleModule = evaluation.moduleName;
    }
  }

  if (responsibleModule === '' && evaluations.length > 0) {
    responsibleModule = evaluations[0].moduleName;
  }

  return {
    action: ACTION_PRECEDENCE[bestPrecedenceIndex],
    responsibleModule,
  };
}

// ─── Action Badge ────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, string> = {
  ALLOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DENY: 'bg-red-500/15 text-red-400 border-red-500/30',
  SANITIZE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  REPORT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}

// ─── Severity Badge ──────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-blue-500/15 text-blue-400',
  info: 'bg-gray-500/15 text-gray-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity.toLowerCase()] || 'bg-gray-500/15 text-gray-400';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${style}`}>
      {severity}
    </span>
  );
}

// ─── Warning Icon ────────────────────────────────────────────────────────────

function WarningIcon() {
  return (
    <svg
      className="h-4 w-4 text-amber-400 shrink-0"
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
  );
}

// ─── Module Eval Card ────────────────────────────────────────────────────────

interface ModuleEvalCardProps {
  evaluation: ModuleEvaluationDetail;
  isResponsibleModule: boolean;
}

function ModuleEvalCard({ evaluation, isResponsibleModule }: ModuleEvalCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        isResponsibleModule
          ? 'border-[var(--color-accent,#6366f1)]/40 bg-[var(--color-accent,#6366f1)]/5'
          : 'border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-secondary,#111827)]'
      }`}
      data-testid="module-eval-card"
    >
      {/* Header: module name + action badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[var(--color-text-primary,#f9fafb)] truncate">
            {evaluation.moduleName}
          </span>
          <span className="text-[10px] text-[var(--color-text-secondary,#9ca3af)] font-mono shrink-0">
            v{evaluation.moduleVersion}
          </span>
          {isResponsibleModule && (
            <span className="text-[10px] text-[var(--color-accent,#6366f1)] font-medium shrink-0">
              (most restrictive)
            </span>
          )}
        </div>
        <ActionBadge action={evaluation.action} />
      </div>

      {/* Metadata: stage + latency */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary,#9ca3af)] mb-2">
        <span>Stage: {evaluation.stage.replace('_', ' ')}</span>
        <span>•</span>
        <span>{evaluation.latencyMs}ms</span>
      </div>

      {/* Reason codes */}
      {evaluation.reasonCodes.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="reason-codes">
          {evaluation.reasonCodes.map((rc, idx) => (
            <div
              key={`${rc.code}-${idx}`}
              className="flex items-center gap-2 text-xs"
            >
              <SeverityBadge severity={rc.severity} />
              <span className="text-[var(--color-text-primary,#f9fafb)]">{rc.title}</span>
              <span className="text-[var(--color-text-tertiary,#6b7280)] font-mono text-[10px]">
                {rc.code}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {evaluation.error && (
        <div
          className="mt-3 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2"
          role="alert"
          data-testid="module-error"
        >
          <WarningIcon />
          <span className="text-xs text-amber-300">{evaluation.error}</span>
        </div>
      )}
    </div>
  );
}

// ─── Stage Group ─────────────────────────────────────────────────────────────

interface StageGroupProps {
  stage: 'PRE_EXECUTION' | 'POST_EXECUTION';
  evaluations: ModuleEvaluationDetail[];
  responsibleModule: string;
}

function StageGroup({ stage, evaluations, responsibleModule }: StageGroupProps) {
  if (evaluations.length === 0) return null;

  const label = stage === 'PRE_EXECUTION' ? 'Pre-Execution' : 'Post-Execution';

  return (
    <div data-testid={`stage-group-${stage}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#9ca3af)] mb-3">
        {label}
      </h4>
      <div className="space-y-3">
        {evaluations.map((evaluation, idx) => (
          <ModuleEvalCard
            key={`${evaluation.moduleName}-${idx}`}
            evaluation={evaluation}
            isResponsibleModule={evaluation.moduleName === responsibleModule}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * ReasonChainSection — Displays module evaluations grouped by stage with merged action summary.
 *
 * Renders module evaluations in two groups: PRE_EXECUTION and POST_EXECUTION.
 * Each ModuleEvalCard shows: moduleName, moduleVersion, stage, action, latencyMs,
 * enriched reason codes (title + severity), and any error with warning indicator.
 *
 * Shows the final merged action badge and highlights the module producing the
 * most restrictive action (DENY > SANITIZE > REPORT > ALLOW).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function ReasonChainSection({ moduleEvaluations }: ReasonChainSectionProps) {
  const preExecution = moduleEvaluations.filter((e) => e.stage === 'PRE_EXECUTION');
  const postExecution = moduleEvaluations.filter((e) => e.stage === 'POST_EXECUTION');
  const { action: mergedAction, responsibleModule } = mergeActions(moduleEvaluations);

  return (
    <section
      className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5"
      aria-label="Reason chain"
      data-testid="reason-chain-section"
    >
      {/* Header with merged action badge */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)]">
          Reason Chain
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary,#9ca3af)]">
            Merged Action:
          </span>
          <ActionBadge action={mergedAction} />
        </div>
      </div>

      {/* Module count and responsible module info */}
      {responsibleModule && (
        <p className="text-xs text-[var(--color-text-secondary,#9ca3af)] mb-4">
          {moduleEvaluations.length} module{moduleEvaluations.length !== 1 ? 's' : ''} evaluated
          {' — '}
          most restrictive action from{' '}
          <span className="font-medium text-[var(--color-text-primary,#f9fafb)]">
            {responsibleModule}
          </span>
        </p>
      )}

      {/* Stage groups */}
      <div className="space-y-6">
        <StageGroup
          stage="PRE_EXECUTION"
          evaluations={preExecution}
          responsibleModule={responsibleModule}
        />
        <StageGroup
          stage="POST_EXECUTION"
          evaluations={postExecution}
          responsibleModule={responsibleModule}
        />
      </div>

      {/* Empty state */}
      {moduleEvaluations.length === 0 && (
        <p className="text-sm text-[var(--color-text-secondary,#9ca3af)] text-center py-4">
          No module evaluations available.
        </p>
      )}
    </section>
  );
}

export default ReasonChainSection;
