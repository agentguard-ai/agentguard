'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_PRESET,
  TimeRangeContext,
  computeTimeRangeFromPreset,
  type TimeRange,
  type TimeRangePreset,
} from '@/hooks/useTimeRange';

interface TimeRangeProviderProps {
  children: React.ReactNode;
}

/**
 * TimeRangeProvider — wraps the app to provide global time range context.
 *
 * - Default preset: '1h' (last 1 hour)
 * - Presets compute start/end dynamically from Date.now()
 * - Custom range stores user-specified start/end
 *
 * Satisfies Requirement 1.5: Configurable TimeRange selector that scopes all panel queries.
 */
export function TimeRangeProvider({ children }: TimeRangeProviderProps) {
  const [preset, setPresetState] = useState<TimeRangePreset>(DEFAULT_PRESET);
  const [customRange, setCustomRangeState] = useState<TimeRange>(() =>
    computeTimeRangeFromPreset('1h')
  );

  // Compute the active time range based on the current preset
  const timeRange: TimeRange = useMemo(() => {
    if (preset === 'custom') {
      return customRange;
    }
    return computeTimeRangeFromPreset(preset);
  }, [preset, customRange]);

  const setPreset = useCallback((newPreset: TimeRangePreset) => {
    setPresetState(newPreset);
    // When switching to a non-custom preset, recompute time range immediately
    if (newPreset !== 'custom') {
      // TimeRange is computed dynamically in the useMemo above
    }
  }, []);

  const setCustomRange = useCallback((start: number, end: number) => {
    setPresetState('custom');
    setCustomRangeState({ start, end });
  }, []);

  const value = useMemo(
    () => ({
      timeRange,
      preset,
      setPreset,
      setCustomRange,
    }),
    [timeRange, preset, setPreset, setCustomRange]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}
