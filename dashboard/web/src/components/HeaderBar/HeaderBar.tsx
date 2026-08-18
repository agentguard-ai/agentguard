'use client';

import { useMemo } from 'react';
import { useTimeRange, PRESET_LABELS } from '@/hooks/useTimeRange';
import { useDataStream } from '@/hooks/useDataStream';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HeaderBarProps {
  /** Current section title (from active nav item label) */
  title: string;
  /** Optional override subtitle; if not provided, composed from hooks */
  subtitle?: string;
}

export interface NotificationBadgeProps {
  /** Alert severity level */
  level: 'warning' | 'critical';
  /** Alert count */
  count: number;
}

interface AlertCounts {
  warning: number;
  critical: number;
}

interface ActiveAgentsResponse {
  count: number;
}

// ─── NotificationBadge ───────────────────────────────────────────────────────

/**
 * NotificationBadge — Displays an alert count with severity-appropriate styling.
 * Only rendered when count > 0.
 *
 * Requirements: 3.3, 3.4
 */
export function NotificationBadge({ level, count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const config = level === 'critical'
    ? { bg: 'bg-red-500', label: 'Critical', icon: '⚠' }
    : { bg: 'bg-amber-500', label: 'Warning', icon: '⚡' };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
        text-xs font-medium text-white ${config.bg}
      `}
      role="status"
      aria-label={`${count} ${config.label.toLowerCase()} alert${count !== 1 ? 's' : ''}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{count}</span>
      <span className="sr-only">{config.label}</span>
    </span>
  );
}

// ─── Subtitle Composition ────────────────────────────────────────────────────

function formatConnectionStatus(status: string): string {
  switch (status) {
    case 'connected':
      return 'System operational';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
}

// ─── HeaderBar Component ─────────────────────────────────────────────────────

/**
 * HeaderBar — The top bar of the main content area displaying the page title,
 * subtitle (time range + agent count + system status), notification badges,
 * and connection status indicator.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 15.3
 */
export function HeaderBar({ title, subtitle: subtitleOverride }: HeaderBarProps) {
  // Hook data sources
  const { preset } = useTimeRange();
  const { status } = useDataStream({ channels: ['alerts'], enabled: true });
  const { data: agentsData } = useCachedQuery<ActiveAgentsResponse>({
    endpoint: '/api/v1/agents/active',
  });
  const { data: alertsData } = useCachedQuery<AlertCounts>({
    endpoint: '/api/v1/alerts/counts',
  });

  // Compose subtitle from hooks when no override provided
  const subtitle = useMemo(() => {
    if (subtitleOverride) return subtitleOverride;

    const timeLabel = PRESET_LABELS[preset] ?? 'Custom';
    const agentCount = agentsData?.count ?? 0;
    const statusText = status === 'connected' ? formatConnectionStatus(status) : '';

    const parts = [`${timeLabel}`, `${agentCount} active agent${agentCount !== 1 ? 's' : ''}`];
    if (statusText) parts.push(statusText);
    return parts.join(' · ');
  }, [subtitleOverride, preset, agentsData, status]);

  // Alert badge counts (default to 0 while loading)
  const warningCount = alertsData?.warning ?? 0;
  const criticalCount = alertsData?.critical ?? 0;

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--panel-border-color,rgba(255,255,255,0.1))] px-6 py-4"
      role="banner"
      aria-label="Dashboard header"
    >
      {/* Left: Title + Subtitle */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {subtitle}
        </p>
      </div>

      {/* Right: Badges + Connection Status */}
      <div className="flex items-center gap-3">
        <NotificationBadge level="warning" count={warningCount} />
        <NotificationBadge level="critical" count={criticalCount} />
        {status === 'connected' && <ConnectionStatusIndicator status={status} />}
      </div>
    </header>
  );
}

export default HeaderBar;
