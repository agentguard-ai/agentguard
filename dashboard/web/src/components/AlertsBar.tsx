'use client';

import { useState, useCallback } from 'react';
import { useDataStream } from '../hooks/useDataStream';
import type { StreamEvent, AlertEvent } from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
}

const SEVERITY_ICON_COLORS: Record<ActiveAlert['severity'], string> = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

const SEVERITY_BG: Record<ActiveAlert['severity'], string> = {
  info: 'border-blue-500/30 bg-blue-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
};

/**
 * AlertsBar — Displays active alert notifications at the top of the dashboard
 * below the freeze banner. Subscribes to the 'alerts' WebSocket channel and
 * shows real-time alert notifications as they fire.
 *
 * Requirements: 9.6
 */
export function AlertsBar() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    if (event.type === 'alert_triggered') {
      const payload = event.payload as AlertEvent;
      const newAlert: ActiveAlert = {
        id: `${payload.ruleId}-${payload.timestamp}`,
        severity: payload.severity,
        message: payload.message,
        timestamp: payload.timestamp,
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // Keep latest 10
    }
  }, []);

  useDataStream({
    channels: ['alerts'],
    onEvent: handleStreamEvent,
  });

  const handleDismiss = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  if (alerts.length === 0) {
    return null;
  }

  // Show the most severe alert's styling
  const highestSeverity = alerts.reduce<ActiveAlert['severity']>((acc, a) => {
    const order = { critical: 3, warning: 2, info: 1 };
    return order[a.severity] > order[acc] ? a.severity : acc;
  }, 'info');

  return (
    <div
      className={`border-b px-6 py-2 ${SEVERITY_BG[highestSeverity]}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <svg
          className={`h-4 w-4 flex-shrink-0 ${SEVERITY_ICON_COLORS[highestSeverity]}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <div className="flex flex-1 flex-col gap-1">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-primary)]">{alert.message}</span>
              <button
                onClick={() => handleDismiss(alert.id)}
                className="ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label={`Dismiss alert: ${alert.message}`}
              >
                ✕
              </button>
            </div>
          ))}
          {alerts.length > 3 && (
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              +{alerts.length - 3} more alert{alerts.length - 3 !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
