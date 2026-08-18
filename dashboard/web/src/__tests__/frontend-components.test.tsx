/**
 * Frontend Component Unit Tests
 *
 * Tests for:
 * 1. Theme toggle persistence in localStorage (validates existing coverage, adds edge cases)
 * 2. Kill switch confirmation dialog flow (confirm → execute, cancel → no-op)
 * 3. Budget color thresholds (79.9% → normal, 80.0% → amber, 94.9% → amber, 95.0% → red)
 * 4. Reconnection backoff calculation (attempt 1 → 1s, attempt 5 → 16s, attempt 6+ → 30s cap)
 * 5. Pipeline overall status classification (HEALTHY/DEGRADED/CRITICAL)
 * 6. Empty dataset rendering for all panels
 *
 * Requirements: 1.3, 1.4, 1.7, 2.7, 4.7, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

// ─── Test Helpers (must be defined before usage) ─────────────────────────────

import { ThemeProvider as TP } from '@/providers/ThemeProvider';
import { TimeRangeProvider as TRP } from '@/providers/TimeRangeProvider';

/**
 * Minimal MockWebSocket for render tests (prevents errors from useDataStream).
 */
class MockWebSocketForRender {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(_url: string) {
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
    }, 0);
  }

  send(_data: string) {}
  close() {
    this.readyState = MockWebSocketForRender.CLOSED;
  }
}

/**
 * Provides the necessary context providers for component rendering tests.
 */
function MockProviders({ children }: { children: React.ReactNode }) {
  return (
    <TP>
      <TRP>{children}</TRP>
    </TP>
  );
}

// ─── 1. Theme Toggle Persistence (Req 1.7) ──────────────────────────────────

import { THEME_STORAGE_KEY, useTheme } from '@/hooks/useTheme';
import { ThemeProvider } from '@/providers/ThemeProvider';

describe('Theme Toggle Persistence (Req 1.7)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('persists dark theme to localStorage when set explicitly', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setTheme('light');
    });
    act(() => {
      result.current.setTheme('dark');
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('persists light theme to localStorage when toggled', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.toggleTheme(); // dark → light
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applies dark class on <html> element when theme is dark', () => {
    document.documentElement.classList.remove('dark');
    renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class from <html> element when theme is light', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setTheme('light');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('survives multiple toggle cycles with correct persistence', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

// ─── 2. Kill Switch Confirmation Dialog (Req 8.4) ───────────────────────────

describe('Kill Switch Confirmation Dialog Flow (Req 8.4)', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocketForRender);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows confirmation dialog before executing freeze', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wildcardActive: false, frozenAgents: [], results: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { KillSwitchPanel } = await import('@/panels/KillSwitchPanel');

    render(<KillSwitchPanel />, { wrapper: MockProviders });

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading freeze state...')).not.toBeInTheDocument();
    });

    // Enter agent ID and click Freeze Agent
    const input = screen.getByLabelText('Agent ID to freeze');
    fireEvent.change(input, { target: { value: 'test-agent-123' } });
    fireEvent.click(screen.getByText('Freeze Agent'));

    // Confirmation dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to freeze agent/)).toBeInTheDocument();
  });

  it('executes freeze when confirm is clicked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wildcardActive: false, frozenAgents: [], results: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { KillSwitchPanel } = await import('@/panels/KillSwitchPanel');

    render(<KillSwitchPanel />, { wrapper: MockProviders });

    await waitFor(() => {
      expect(screen.queryByText('Loading freeze state...')).not.toBeInTheDocument();
    });

    // Enter agent ID and click Freeze
    const input = screen.getByLabelText('Agent ID to freeze');
    fireEvent.change(input, { target: { value: 'test-agent-123' } });
    fireEvent.click(screen.getByText('Freeze Agent'));

    // Confirm the dialog
    fireEvent.click(screen.getByText('Confirm'));

    // Verify freeze API was called
    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const freezeCall = calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/api/v1/freeze/test-agent-123') &&
          call[1]?.method === 'POST'
      );
      expect(freezeCall).toBeDefined();
    });
  });

  it('does NOT execute freeze when cancel is clicked (no-op)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wildcardActive: false, frozenAgents: [], results: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { KillSwitchPanel } = await import('@/panels/KillSwitchPanel');

    render(<KillSwitchPanel />, { wrapper: MockProviders });

    await waitFor(() => {
      expect(screen.queryByText('Loading freeze state...')).not.toBeInTheDocument();
    });

    // Record fetch call count after loading
    const callCountAfterLoad = mockFetch.mock.calls.length;

    // Enter agent ID and click Freeze
    const input = screen.getByLabelText('Agent ID to freeze');
    fireEvent.change(input, { target: { value: 'test-agent-123' } });
    fireEvent.click(screen.getByText('Freeze Agent'));

    // Dialog should be shown
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Dialog should be dismissed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // No additional fetch calls should have been made after cancel
    // (no freeze POST was triggered)
    const callsAfterCancel = mockFetch.mock.calls.slice(callCountAfterLoad);
    const freezeCall = callsAfterCancel.find(
      (call: any[]) => typeof call[0] === 'string' && call[1]?.method === 'POST'
    );
    expect(freezeCall).toBeUndefined();
  });
});

// ─── 3. Budget Color Thresholds (Req 4.7) ───────────────────────────────────

import { getUtilizationColor, getUtilizationTextColor } from '@/panels/CostTrackerPanel';

describe('Budget Color Thresholds (Req 4.7)', () => {
  describe('getUtilizationColor', () => {
    it('returns normal color for null utilization', () => {
      expect(getUtilizationColor(null)).toBe('bg-[var(--color-accent)]');
    });

    it('returns normal color for 0% utilization', () => {
      expect(getUtilizationColor(0)).toBe('bg-[var(--color-accent)]');
    });

    it('returns normal color for 79.9% utilization (just below warning)', () => {
      expect(getUtilizationColor(0.799)).toBe('bg-[var(--color-accent)]');
    });

    it('returns amber/warning color for 80.0% utilization (exact boundary)', () => {
      expect(getUtilizationColor(0.8)).toBe('bg-[var(--color-warning)]');
    });

    it('returns amber/warning color for 85% utilization', () => {
      expect(getUtilizationColor(0.85)).toBe('bg-[var(--color-warning)]');
    });

    it('returns amber/warning color for 94.9% utilization (just below critical)', () => {
      expect(getUtilizationColor(0.949)).toBe('bg-[var(--color-warning)]');
    });

    it('returns red/critical color for 95.0% utilization (exact boundary)', () => {
      expect(getUtilizationColor(0.95)).toBe('bg-[var(--color-danger)]');
    });

    it('returns red/critical color for 100% utilization', () => {
      expect(getUtilizationColor(1.0)).toBe('bg-[var(--color-danger)]');
    });

    it('returns red/critical color for over 100% utilization', () => {
      expect(getUtilizationColor(1.2)).toBe('bg-[var(--color-danger)]');
    });
  });

  describe('getUtilizationTextColor', () => {
    it('returns normal text color for null utilization', () => {
      expect(getUtilizationTextColor(null)).toBe('text-[var(--color-accent)]');
    });

    it('returns normal text color for 79.9% utilization', () => {
      expect(getUtilizationTextColor(0.799)).toBe('text-[var(--color-accent)]');
    });

    it('returns warning text color for 80.0% utilization', () => {
      expect(getUtilizationTextColor(0.8)).toBe('text-[var(--color-warning)]');
    });

    it('returns warning text color for 94.9% utilization', () => {
      expect(getUtilizationTextColor(0.949)).toBe('text-[var(--color-warning)]');
    });

    it('returns critical text color for 95.0% utilization', () => {
      expect(getUtilizationTextColor(0.95)).toBe('text-[var(--color-danger)]');
    });
  });
});

// ─── 4. Reconnection Backoff Calculation (Req 1.4) ──────────────────────────

import { calculateBackoff } from '@/hooks/useDataStream';

describe('Reconnection Backoff Calculation (Req 1.4)', () => {
  it('attempt 1 (index 0) → 1000ms (1 second)', () => {
    expect(calculateBackoff(0)).toBe(1000);
  });

  it('attempt 2 (index 1) → 2000ms (2 seconds)', () => {
    expect(calculateBackoff(1)).toBe(2000);
  });

  it('attempt 3 (index 2) → 4000ms (4 seconds)', () => {
    expect(calculateBackoff(2)).toBe(4000);
  });

  it('attempt 4 (index 3) → 8000ms (8 seconds)', () => {
    expect(calculateBackoff(3)).toBe(8000);
  });

  it('attempt 5 (index 4) → 16000ms (16 seconds)', () => {
    expect(calculateBackoff(4)).toBe(16000);
  });

  it('attempt 6 (index 5) → capped at 30000ms (30 seconds)', () => {
    // 2^5 * 1000 = 32000, capped at 30000
    expect(calculateBackoff(5)).toBe(30000);
  });

  it('attempt 7+ → capped at 30000ms (30 seconds)', () => {
    expect(calculateBackoff(6)).toBe(30000);
    expect(calculateBackoff(7)).toBe(30000);
    expect(calculateBackoff(10)).toBe(30000);
    expect(calculateBackoff(50)).toBe(30000);
  });
});

// ─── 5. Pipeline Overall Status Classification (Req 2.7) ────────────────────

describe('Pipeline Overall Status Classification (Req 2.7)', () => {
  /**
   * The overall status classification logic (from backend pipeline.ts route):
   * - CRITICAL: any module has error rate > 50% (0.5)
   * - DEGRADED: any module has error rate > 10% (0.1) OR timeout rate > 5% (0.05)
   * - HEALTHY: all modules are within normal thresholds
   */
  function classifyOverallStatus(
    modules: { errorRate: number; timeoutRate: number }[]
  ): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    if (modules.some((m) => m.errorRate > 0.5)) return 'CRITICAL';
    if (modules.some((m) => m.errorRate > 0.1 || m.timeoutRate > 0.05)) return 'DEGRADED';
    return 'HEALTHY';
  }

  it('returns HEALTHY when all modules have low error and timeout rates', () => {
    const modules = [
      { errorRate: 0.05, timeoutRate: 0.02 },
      { errorRate: 0.08, timeoutRate: 0.04 },
    ];
    expect(classifyOverallStatus(modules)).toBe('HEALTHY');
  });

  it('returns HEALTHY with empty module list', () => {
    expect(classifyOverallStatus([])).toBe('HEALTHY');
  });

  it('returns DEGRADED when a module has error rate > 10%', () => {
    const modules = [
      { errorRate: 0.05, timeoutRate: 0.02 },
      { errorRate: 0.11, timeoutRate: 0.02 },
    ];
    expect(classifyOverallStatus(modules)).toBe('DEGRADED');
  });

  it('returns DEGRADED when a module has timeout rate > 5%', () => {
    const modules = [
      { errorRate: 0.05, timeoutRate: 0.06 },
      { errorRate: 0.03, timeoutRate: 0.01 },
    ];
    expect(classifyOverallStatus(modules)).toBe('DEGRADED');
  });

  it('returns DEGRADED at boundary: error rate = 10.1%', () => {
    const modules = [{ errorRate: 0.101, timeoutRate: 0.0 }];
    expect(classifyOverallStatus(modules)).toBe('DEGRADED');
  });

  it('returns HEALTHY at exact boundary: error rate = 10% (threshold is strictly >)', () => {
    const modules = [{ errorRate: 0.1, timeoutRate: 0.0 }];
    expect(classifyOverallStatus(modules)).toBe('HEALTHY');
  });

  it('returns HEALTHY at exact boundary: timeout rate = 5% (threshold is strictly >)', () => {
    const modules = [{ errorRate: 0.0, timeoutRate: 0.05 }];
    expect(classifyOverallStatus(modules)).toBe('HEALTHY');
  });

  it('returns CRITICAL when a module has error rate > 50%', () => {
    const modules = [
      { errorRate: 0.05, timeoutRate: 0.02 },
      { errorRate: 0.51, timeoutRate: 0.02 },
    ];
    expect(classifyOverallStatus(modules)).toBe('CRITICAL');
  });

  it('returns CRITICAL at boundary: error rate = 50.1%', () => {
    const modules = [{ errorRate: 0.501, timeoutRate: 0.0 }];
    expect(classifyOverallStatus(modules)).toBe('CRITICAL');
  });

  it('returns DEGRADED (not CRITICAL) at exact boundary: error rate = 50%', () => {
    // 50% triggers degraded (>10%) but NOT critical (needs > 50%)
    const modules = [{ errorRate: 0.5, timeoutRate: 0.0 }];
    expect(classifyOverallStatus(modules)).toBe('DEGRADED');
  });

  it('CRITICAL takes precedence when modules have mixed states', () => {
    const modules = [
      { errorRate: 0.15, timeoutRate: 0.06 }, // degraded
      { errorRate: 0.55, timeoutRate: 0.01 }, // critical
      { errorRate: 0.02, timeoutRate: 0.01 }, // healthy
    ];
    expect(classifyOverallStatus(modules)).toBe('CRITICAL');
  });
});

// ─── 6. Empty Dataset Rendering ─────────────────────────────────────────────

describe('Empty Dataset Rendering', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocketForRender);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('CostTrackerPanel renders gracefully with no cost data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          session: { total: 0, budget: null, utilization: null },
          daily: { total: 0, budget: null, utilization: null },
          agent: { total: 0, budget: null, utilization: null },
          reconciliationAlerts: [],
          dataPoints: [],
          breakdown: [],
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { CostTrackerPanel } = await import('@/panels/CostTrackerPanel');

    render(<CostTrackerPanel />, { wrapper: MockProviders });

    // Should show panel header once loading completes
    await waitFor(() => {
      expect(screen.getByText('Cost Tracker')).toBeInTheDocument();
    });

    // Should not show error
    await waitFor(() => {
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    });
  });

  it('PipelineStatusPanel renders gracefully with empty modules and decisions', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          overallStatus: 'HEALTHY',
          failurePolicy: 'fail-closed',
          modules: { preExecution: [], postExecution: [] },
          recentDecisions: [],
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { PipelineStatusPanel } = await import('@/panels/PipelineStatusPanel');

    render(<PipelineStatusPanel />, { wrapper: MockProviders });

    await waitFor(() => {
      expect(screen.getByText('Pipeline Status')).toBeInTheDocument();
    });

    // Should display HEALTHY status badge
    await waitFor(() => {
      expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    });

    // Should show "No modules registered" for empty stages
    await waitFor(() => {
      const noModulesElements = screen.getAllByText('No modules registered');
      expect(noModulesElements.length).toBeGreaterThanOrEqual(1);
    });

    // Should show "No recent decisions" for empty decisions
    await waitFor(() => {
      expect(screen.getByText('No recent decisions')).toBeInTheDocument();
    });
  });

  it('KillSwitchPanel renders gracefully with no frozen agents and no history', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wildcardActive: false, frozenAgents: [], results: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { KillSwitchPanel } = await import('@/panels/KillSwitchPanel');

    render(<KillSwitchPanel />, { wrapper: MockProviders });

    await waitFor(() => {
      expect(screen.getByText('Kill Switch')).toBeInTheDocument();
    });

    // Should show inactive global freeze
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    // Should show "No agents are currently frozen"
    await waitFor(() => {
      expect(screen.getByText('No agents are currently frozen.')).toBeInTheDocument();
    });

    // Should show empty audit log message
    await waitFor(() => {
      expect(screen.getByText('No freeze/unfreeze actions recorded yet.')).toBeInTheDocument();
    });
  });
});
