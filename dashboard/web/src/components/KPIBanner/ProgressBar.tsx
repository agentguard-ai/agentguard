import React from 'react';

export interface ProgressBarProps {
  /** Amount consumed */
  consumed: number;
  /** Total limit/budget */
  limit: number;
}

/**
 * Renders a horizontal progress bar showing consumption percentage.
 * Width calculation: Math.round((consumed / limit) * 100)
 *
 * Includes:
 * - role="progressbar" with aria-valuenow, aria-valuemin=0, aria-valuemax=100
 * - Visible text percentage label
 * - Accent-colored fill on bg-tertiary background
 *
 * Satisfies Requirements 4.5, 15.6
 */
export function ProgressBar({ consumed, limit }: ProgressBarProps) {
  const percentage = limit > 0 ? Math.round((consumed / limit) * 100) : 0;
  // Clamp percentage between 0 and 100 for visual width
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div data-testid="progress-bar-container" className="w-full">
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget consumption: ${percentage}%`}
        data-testid="progress-bar"
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]"
      >
        <div
          data-testid="progress-bar-fill"
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      <span
        data-testid="progress-bar-label"
        className="mt-1 block text-xs text-[var(--color-text-secondary)]"
      >
        {percentage}% consumed
      </span>
    </div>
  );
}
