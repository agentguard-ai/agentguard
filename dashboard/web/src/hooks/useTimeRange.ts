'use client';

import { useContext, createContext } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimeRange {
  start: number; // Unix timestamp ms
  end: number;   // Unix timestamp ms
}

export type TimeRangePreset = '1h' | '24h' | '7d' | 'custom';

export interface UseTimeRangeReturn {
  /** Current computed time range (start/end in unix ms) */
  timeRange: TimeRange;
  /** Active preset */
  preset: TimeRangePreset;
  /** Switch to a preset time range */
  setPreset: (preset: TimeRangePreset) => void;
  /** Set a custom time range (also switches preset to 'custom') */
  setCustomRange: (start: number, end: number) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PRESET_DURATIONS: Record<Exclude<TimeRangePreset, 'custom'>, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
};

export const DEFAULT_PRESET: TimeRangePreset = '1h';

export const PRESET_LABELS: Record<TimeRangePreset, string> = {
  '1h': 'Last 1h',
  '24h': 'Last 24h',
  '7d': 'Last 7d',
  'custom': 'Custom',
};

// ─── Context ─────────────────────────────────────────────────────────────────

export const TimeRangeContext = createContext<UseTimeRangeReturn | undefined>(undefined);

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook providing global time range state and controls.
 * Must be used within a TimeRangeProvider.
 *
 * Satisfies Requirement 1.5: Configurable TimeRange selector that scopes all panel queries.
 */
export function useTimeRange(): UseTimeRangeReturn {
  const context = useContext(TimeRangeContext);
  if (context === undefined) {
    throw new Error('useTimeRange must be used within a TimeRangeProvider');
  }
  return context;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Compute a TimeRange from a preset. Uses Date.now() for dynamic computation.
 */
export function computeTimeRangeFromPreset(preset: Exclude<TimeRangePreset, 'custom'>): TimeRange {
  const now = Date.now();
  return {
    start: now - PRESET_DURATIONS[preset],
    end: now,
  };
}
