'use client';

import { useTimeRange, PRESET_LABELS, type TimeRangePreset } from '@/hooks/useTimeRange';

const PRESETS: TimeRangePreset[] = ['1h', '24h', '7d', 'custom'];

/**
 * TimeRangeSelector — header component for selecting the global time range.
 *
 * Displays preset buttons (1h, 24h, 7d, custom) with active state styling.
 * When 'custom' is selected, shows date/time inputs for specifying range.
 *
 * Satisfies Requirement 1.5: Configurable TimeRange selector that scopes all panel queries.
 */
export function TimeRangeSelector() {
  const { preset, timeRange, setPreset, setCustomRange } = useTimeRange();

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Time range selector">
      {/* Clock icon */}
      <svg
        className="h-4 w-4 text-[var(--color-text-secondary)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Preset buttons */}
      <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              preset === p
                ? 'bg-teal-600 text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
            aria-pressed={preset === p}
            aria-label={`Select time range: ${PRESET_LABELS[p]}`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Custom range inputs (shown only when custom preset is active) */}
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="datetime-local"
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            value={toDateTimeLocal(timeRange.start)}
            onChange={(e) => {
              const start = new Date(e.target.value).getTime();
              if (!isNaN(start)) {
                setCustomRange(start, timeRange.end);
              }
            }}
            aria-label="Custom range start"
          />
          <span className="text-[var(--color-text-secondary)]">–</span>
          <input
            type="datetime-local"
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            value={toDateTimeLocal(timeRange.end)}
            onChange={(e) => {
              const end = new Date(e.target.value).getTime();
              if (!isNaN(end)) {
                setCustomRange(timeRange.start, end);
              }
            }}
            aria-label="Custom range end"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Convert a unix timestamp (ms) to the format expected by datetime-local inputs.
 */
function toDateTimeLocal(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
