/**
 * Property 10: Status indicators include non-color alternative
 *
 * For any element that uses color to convey a status (active/frozen, healthy/degraded/critical,
 * up-trend/down-trend), that element SHALL also include a text label or icon that conveys the
 * same information without relying on color perception.
 *
 * **Validates: Requirements 15.6**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';

// ─── Mock useCachedQuery ─────────────────────────────────────────────────────

let mockData: unknown = null;

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    invalidate: vi.fn(),
  }),
}));

// ─── Import components after mocks ───────────────────────────────────────────

import { SeverityIndicator } from '@/panels/CanaryAlertsPanel';
import type { CanaryEvent } from '@/panels/CanaryAlertsPanel';
import { TrendIndicator } from '@/components/KPIBanner/TrendIndicator';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import type { ConnectionStatus } from '@/hooks/useDataStream';

// We import the StatusIndicator indirectly via the AgentMatrixPanel
// Since StatusIndicator is not exported, we test via the full AgentMatrixPanel
import { AgentMatrixPanel } from '@/panels/AgentMatrixPanel';
import type { AgentRow, AgentMatrixResponse } from '@/panels/AgentMatrixPanel';

// ─── Suppress console.error from error boundaries during tests ───────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  cleanup();
});

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for agent status values */
const agentStatusArb = fc.constantFrom<AgentRow['status']>('Active', 'FROZEN', 'Inactive');

/** Arbitrary for canary severity values */
const canarySeverityArb = fc.constantFrom<CanaryEvent['severity']>('info', 'warning', 'critical');

/** Arbitrary for canary type values */
const canaryTypeArb = fc.constantFrom<CanaryEvent['type']>('drift', 'anomaly', 'freeze_trigger');

/** Arbitrary for trend values (non-zero positive and negative) */
const trendValueArb = fc.oneof(
  fc.double({ min: 0.01, max: 999.99, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -999.99, max: -0.01, noNaN: true, noDefaultInfinity: true })
);

/** Arbitrary for connection status */
const connectionStatusArb = fc.constantFrom<ConnectionStatus>('connected', 'reconnecting', 'disconnected');

/** Arbitrary for polling fallback state */
const isPollingArb = fc.boolean();

/** Alphanumeric name strings */
const nameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
    minLength: 3,
    maxLength: 20,
  })
  .filter((s) => s.trim().length >= 3);

/** Arbitrary for a single AgentRow */
const agentRowArb = (status: AgentRow['status']): fc.Arbitrary<AgentRow> =>
  fc.record({
    agent: nameArb,
    role: nameArb,
    cost: fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true }),
    status: fc.constant(status),
  });

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Checks that a DOM element contains either:
 * - A visible text label conveying the status
 * - An icon (SVG) that is accompanied by an aria-label or textual sibling
 */
function hasNonColorAlternative(element: HTMLElement, expectedText: string | string[]): boolean {
  const texts = Array.isArray(expectedText) ? expectedText : [expectedText];
  const textContent = element.textContent || '';

  // Check if any of the expected text labels are present in the element
  const hasTextLabel = texts.some((t) => textContent.toLowerCase().includes(t.toLowerCase()));

  // Check if element has an aria-label that conveys status
  const ariaLabel = element.getAttribute('aria-label') || '';
  const hasAriaLabel = texts.some((t) => ariaLabel.toLowerCase().includes(t.toLowerCase()));

  // Check for icon (SVG) presence as additional non-color indicator
  const hasIcon = element.querySelector('svg') !== null;

  // The element passes if it has (text label) OR (aria-label) combined with an icon
  return hasTextLabel || (hasAriaLabel && hasIcon);
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 10: Status indicators include non-color alternative', { timeout: 60000 }, () => {
  describe('AgentMatrixPanel — agent status indicators', () => {
    it('every agent status (Active/FROZEN/Inactive) includes a text label and icon alongside color', () => {
      fc.assert(
        fc.property(agentStatusArb, (status) => {
          // Create a mock data response with one agent having this status
          const agentData: AgentMatrixResponse = {
            agents: [{ agent: 'TestAgent', role: 'Analyzer', cost: 5.0, status }],
            lastUpdated: Date.now(),
          };
          mockData = agentData;
          cleanup();

          render(<AgentMatrixPanel />);

          // Find the status indicator by test ID
          const testIdMap: Record<AgentRow['status'], string> = {
            Active: 'status-active',
            FROZEN: 'status-frozen',
            Inactive: 'status-inactive',
          };

          const indicator = screen.getByTestId(testIdMap[status]);

          // Verify text label is present (the status text itself)
          const expectedTexts: Record<AgentRow['status'], string[]> = {
            Active: ['active'],
            FROZEN: ['frozen'],
            Inactive: ['inactive'],
          };
          expect(indicator.textContent!.toLowerCase()).toContain(expectedTexts[status][0]);

          // Verify an icon (SVG) is present as a non-color alternative
          const svg = indicator.querySelector('svg');
          expect(svg).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CanaryAlertsPanel — severity status indicators', () => {
    it('severity indicators (Frozen/Warning/Info) include a text label and icon alongside color', () => {
      fc.assert(
        fc.property(canarySeverityArb, canaryTypeArb, (severity, type) => {
          cleanup();

          render(<SeverityIndicator severity={severity} type={type} />);

          // Determine expected test ID and text based on severity/type combination
          let testId: string;
          let expectedText: string;

          if (severity === 'critical' || type === 'freeze_trigger') {
            testId = 'severity-frozen';
            expectedText = 'frozen';
          } else if (severity === 'warning') {
            testId = 'severity-warning';
            expectedText = 'warning';
          } else {
            testId = 'severity-info';
            expectedText = 'info';
          }

          const indicator = screen.getByTestId(testId);

          // Verify text label is present
          expect(indicator.textContent!.toLowerCase()).toContain(expectedText);

          // Verify an icon (SVG) is present as a non-color alternative
          const svg = indicator.querySelector('svg');
          expect(svg).not.toBeNull();

          // Verify aria-label conveys the severity
          const ariaLabel = indicator.getAttribute('aria-label') || '';
          expect(ariaLabel.toLowerCase()).toContain(expectedText);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('TrendIndicator — up/down trend direction', () => {
    it('trend indicators include an arrow icon and text label alongside color', () => {
      fc.assert(
        fc.property(trendValueArb, (value) => {
          cleanup();

          render(<TrendIndicator value={value} />);

          const indicator = screen.getByTestId('trend-indicator');
          const isUp = value > 0;

          // Verify arrow SVG icon is present (non-color visual indicator)
          const svg = indicator.querySelector('svg');
          expect(svg).not.toBeNull();

          // Verify the percentage value is displayed as text
          const absoluteValue = Math.abs(value);
          expect(indicator.textContent).toContain(`${absoluteValue}%`);

          // Verify a directional text label ("increase" or "decrease") is present
          const expectedLabel = isUp ? 'increase' : 'decrease';
          expect(indicator.textContent!.toLowerCase()).toContain(expectedLabel);

          // Verify aria-label conveys direction
          const ariaLabel = indicator.getAttribute('aria-label') || '';
          expect(ariaLabel.toLowerCase()).toContain(expectedLabel);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ConnectionStatusIndicator — connection health status', () => {
    it('connection status includes a text label alongside the colored dot', () => {
      fc.assert(
        fc.property(connectionStatusArb, isPollingArb, (status, isPolling) => {
          cleanup();

          render(<ConnectionStatusIndicator status={status} isPolling={isPolling} />);

          const indicator = screen.getByRole('status');

          // Determine expected text label based on status + polling combination
          let expectedLabels: string[];
          if (status === 'connected') {
            expectedLabels = ['connected'];
          } else if (status === 'reconnecting') {
            expectedLabels = ['reconnecting'];
          } else {
            // disconnected
            expectedLabels = isPolling ? ['polling'] : ['disconnected'];
          }

          // Verify text label is present (non-color alternative to the dot)
          const textContent = indicator.textContent!.toLowerCase();
          const hasLabel = expectedLabels.some((label) => textContent.includes(label));
          expect(hasLabel).toBe(true);

          // Verify aria-label provides accessible description
          const ariaLabel = indicator.getAttribute('aria-label') || '';
          expect(ariaLabel.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
