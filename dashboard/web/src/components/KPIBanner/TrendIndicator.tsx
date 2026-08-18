import React from 'react';

export interface TrendIndicatorProps {
  /** Trend percentage value. Positive = up, negative = down, zero = no change */
  value: number;
}

/**
 * Renders a directional trend arrow with percentage and accessible text label.
 * - Positive value: green upward arrow + percentage + "increase" text
 * - Negative value: red downward arrow + absolute percentage + "decrease" text
 * - Zero value: "No change" text
 *
 * Includes text labels alongside color-coded arrows for accessibility (Req 15.6).
 * Satisfies Requirements 4.6, 4.7, 15.6
 */
export function TrendIndicator({ value }: TrendIndicatorProps) {
  if (value === 0) {
    return (
      <span
        data-testid="trend-indicator"
        data-direction="neutral"
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)]"
      >
        No change
      </span>
    );
  }

  const isPositive = value > 0;
  const absoluteValue = Math.abs(value);
  const direction = isPositive ? 'up' : 'down';
  const colorVar = isPositive ? 'var(--kpi-trend-up)' : 'var(--kpi-trend-down)';
  const label = isPositive ? 'increase' : 'decrease';

  return (
    <span
      data-testid="trend-indicator"
      data-direction={direction}
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: colorVar }}
      aria-label={`${label} ${absoluteValue}%`}
    >
      {/* Arrow icon */}
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isPositive ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
      {/* Percentage value */}
      <span>{absoluteValue}%</span>
      {/* Visible text label for non-color alternative */}
      <span className="text-[0.65rem] opacity-75" aria-hidden="true">
        {label}
      </span>
      {/* Screen-reader-only full description */}
      <span className="sr-only">{label}</span>
    </span>
  );
}
