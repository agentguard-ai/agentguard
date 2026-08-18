import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  useTimeRange,
  computeTimeRangeFromPreset,
  PRESET_DURATIONS,
  DEFAULT_PRESET,
  PRESET_LABELS,
  TimeRangeContext,
} from './useTimeRange';
import { TimeRangeProvider } from '@/providers/TimeRangeProvider';

describe('useTimeRange', () => {
  it('throws when used outside TimeRangeProvider', () => {
    expect(() => {
      renderHook(() => useTimeRange());
    }).toThrow('useTimeRange must be used within a TimeRangeProvider');
  });

  it('defaults to 1h preset', () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });
    expect(result.current.preset).toBe('1h');
  });

  it('provides a time range spanning 1 hour by default', () => {
    const before = Date.now();
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });
    const after = Date.now();

    const { timeRange } = result.current;
    // End should be approximately now
    expect(timeRange.end).toBeGreaterThanOrEqual(before);
    expect(timeRange.end).toBeLessThanOrEqual(after);
    // Start should be ~1 hour before end
    const duration = timeRange.end - timeRange.start;
    expect(duration).toBe(PRESET_DURATIONS['1h']);
  });

  it('setPreset changes to 24h', () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });
    act(() => {
      result.current.setPreset('24h');
    });
    expect(result.current.preset).toBe('24h');
    const duration = result.current.timeRange.end - result.current.timeRange.start;
    expect(duration).toBe(PRESET_DURATIONS['24h']);
  });

  it('setPreset changes to 7d', () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });
    act(() => {
      result.current.setPreset('7d');
    });
    expect(result.current.preset).toBe('7d');
    const duration = result.current.timeRange.end - result.current.timeRange.start;
    expect(duration).toBe(PRESET_DURATIONS['7d']);
  });

  it('setCustomRange sets custom start/end and switches preset to custom', () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });
    const customStart = 1700000000000;
    const customEnd = 1700003600000;

    act(() => {
      result.current.setCustomRange(customStart, customEnd);
    });

    expect(result.current.preset).toBe('custom');
    expect(result.current.timeRange.start).toBe(customStart);
    expect(result.current.timeRange.end).toBe(customEnd);
  });

  it('switching from custom back to a preset recomputes dynamically', () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: TimeRangeProvider });

    // Set custom range first
    act(() => {
      result.current.setCustomRange(1000, 2000);
    });
    expect(result.current.preset).toBe('custom');
    expect(result.current.timeRange.start).toBe(1000);

    // Switch back to 1h
    const before = Date.now();
    act(() => {
      result.current.setPreset('1h');
    });
    const after = Date.now();

    expect(result.current.preset).toBe('1h');
    expect(result.current.timeRange.end).toBeGreaterThanOrEqual(before);
    expect(result.current.timeRange.end).toBeLessThanOrEqual(after);
    expect(result.current.timeRange.end - result.current.timeRange.start).toBe(PRESET_DURATIONS['1h']);
  });
});

describe('computeTimeRangeFromPreset', () => {
  it('computes 1h range correctly', () => {
    const before = Date.now();
    const range = computeTimeRangeFromPreset('1h');
    const after = Date.now();

    expect(range.end).toBeGreaterThanOrEqual(before);
    expect(range.end).toBeLessThanOrEqual(after);
    expect(range.end - range.start).toBe(3_600_000);
  });

  it('computes 24h range correctly', () => {
    const range = computeTimeRangeFromPreset('24h');
    expect(range.end - range.start).toBe(86_400_000);
  });

  it('computes 7d range correctly', () => {
    const range = computeTimeRangeFromPreset('7d');
    expect(range.end - range.start).toBe(604_800_000);
  });
});

describe('constants', () => {
  it('DEFAULT_PRESET is 1h', () => {
    expect(DEFAULT_PRESET).toBe('1h');
  });

  it('PRESET_LABELS has entries for all presets', () => {
    expect(PRESET_LABELS['1h']).toBe('Last 1h');
    expect(PRESET_LABELS['24h']).toBe('Last 24h');
    expect(PRESET_LABELS['7d']).toBe('Last 7d');
    expect(PRESET_LABELS['custom']).toBe('Custom');
  });

  it('PRESET_DURATIONS has correct millisecond values', () => {
    expect(PRESET_DURATIONS['1h']).toBe(3_600_000);
    expect(PRESET_DURATIONS['24h']).toBe(86_400_000);
    expect(PRESET_DURATIONS['7d']).toBe(604_800_000);
  });
});
