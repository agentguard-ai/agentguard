import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { CanaryAlertsPanel } from './CanaryAlertsPanel';
import type { CanaryEvent } from './CanaryAlertsPanel';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const canaryEventArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  agentId: fc.string({ minLength: 5, maxLength: 20 }),
  agentName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  type: fc.constantFrom('drift', 'anomaly', 'freeze_trigger') as fc.Arbitrary<'drift' | 'anomaly' | 'freeze_trigger'>,
  severity: fc.constantFrom('info', 'warning', 'critical') as fc.Arbitrary<'info' | 'warning' | 'critical'>,
  message: fc.string({ minLength: 1, maxLength: 50 }),
  metric: fc.string({ minLength: 1, maxLength: 20 }),
  observed: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
  baseline: fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
});

// ─── Setup ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('CanaryAlertsPanel (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 8: Canary Event Field Completeness
  // **Validates: Requirements 6.4**
  it('Property 8: For any valid canary event, output contains agent name, canary type, severity indicator, action attempted, formatted timestamp, and numeric deviation percentage', () => {
    fc.assert(
      fc.property(canaryEventArb, (event: CanaryEvent) => {
        mockUseCachedQuery.mockReturnValue({
          data: [event],
          isLoading: false,
          error: null,
          invalidate: vi.fn(),
        });

        const { unmount } = render(<CanaryAlertsPanel />);

        // 1. Agent name is present (either agentName or derived from agentId)
        const agentEl = screen.getByTestId('canary-event-agent');
        expect(agentEl).toBeInTheDocument();
        const agentText = agentEl.textContent ?? '';
        expect(agentText.length).toBeGreaterThan(0);

        // If agentName is provided, it should be displayed directly
        if (event.agentName) {
          expect(agentText).toBe(event.agentName);
        }

        // 2. Canary type text is present
        const typeEl = screen.getByTestId('canary-event-type');
        expect(typeEl).toBeInTheDocument();
        const typeText = typeEl.textContent ?? '';
        // Must contain one of the formatted type labels
        const validTypes = ['Drift', 'Anomaly', 'Freeze Trigger'];
        expect(validTypes.some((t) => typeText.includes(t))).toBe(true);

        // 3. Severity indicator is present (one of "Frozen", "Warning", "Info")
        const hasFrozen = screen.queryByTestId('severity-frozen') !== null;
        const hasWarning = screen.queryByTestId('severity-warning') !== null;
        const hasInfo = screen.queryByTestId('severity-info') !== null;
        expect(hasFrozen || hasWarning || hasInfo).toBe(true);

        // 4. Action/message text is present
        const actionEl = screen.getByTestId('canary-event-action');
        expect(actionEl).toBeInTheDocument();
        const actionText = actionEl.textContent ?? '';
        expect(actionText).toContain(event.message);

        // 5. Timestamp is present (some formatted representation)
        const timestampEl = screen.getByTestId('canary-event-timestamp');
        expect(timestampEl).toBeInTheDocument();
        const timestampText = timestampEl.textContent ?? '';
        expect(timestampText.length).toBeGreaterThan(0);

        // 6. Deviation percentage is present as numeric string
        const deviationEl = screen.getByTestId('canary-event-deviation');
        expect(deviationEl).toBeInTheDocument();
        const deviationText = deviationEl.textContent ?? '';
        // Should contain a percentage pattern (digits with optional sign and %)
        expect(deviationText).toMatch(/%/);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
