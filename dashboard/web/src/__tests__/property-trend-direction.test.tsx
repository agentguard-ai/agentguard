/**
 * Property 4: Trend direction indicator correctness
 *
 * For any KPI trend value, if the value is positive the card SHALL render an
 * upward arrow icon with the percentage, and if the value is negative the card
 * SHALL render a downward arrow icon with the absolute percentage value.
 *
 * **Validates: Requirements 4.6, 4.7**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { TrendIndicator } from '@/components/KPIBanner/TrendIndicator';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for positive trend values (increases) */
const positiveTrendArb = fc.double({ min: 0.01, max: 999.99, noNaN: true });

/** Arbitrary for negative trend values (decreases) */
const negativeTrendArb = fc.double({ min: -999.99, max: -0.01, noNaN: true });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 4: Trend direction indicator correctness', () => {
  it('positive trend renders upward arrow with percentage', () => {
    fc.assert(
      fc.property(positiveTrendArb, (value) => {
        cleanup();
        render(<TrendIndicator value={value} />);

        const indicator = screen.getByTestId('trend-indicator');

        // Should have data-direction="up"
        expect(indicator).toHaveAttribute('data-direction', 'up');

        // Should contain an SVG arrow element
        const svg = indicator.querySelector('svg');
        expect(svg).not.toBeNull();

        // SVG path should be the upward arrow (M5 15l7-7 7 7)
        const path = svg!.querySelector('path');
        expect(path).not.toBeNull();
        expect(path!.getAttribute('d')).toContain('5 15');

        // Should display the absolute percentage value
        const absoluteValue = Math.abs(value);
        expect(indicator.textContent).toContain(`${absoluteValue}%`);
      }),
      { numRuns: 100 }
    );
  });

  it('negative trend renders downward arrow with absolute percentage', () => {
    fc.assert(
      fc.property(negativeTrendArb, (value) => {
        cleanup();
        render(<TrendIndicator value={value} />);

        const indicator = screen.getByTestId('trend-indicator');

        // Should have data-direction="down"
        expect(indicator).toHaveAttribute('data-direction', 'down');

        // Should contain an SVG arrow element
        const svg = indicator.querySelector('svg');
        expect(svg).not.toBeNull();

        // SVG path should be the downward arrow (M19 9l-7 7-7-7)
        const path = svg!.querySelector('path');
        expect(path).not.toBeNull();
        expect(path!.getAttribute('d')).toContain('19 9');

        // Should display the absolute percentage value (not negative)
        const absoluteValue = Math.abs(value);
        expect(indicator.textContent).toContain(`${absoluteValue}%`);
      }),
      { numRuns: 100 }
    );
  });

  it('zero trend renders neutral indicator with "No change" text', () => {
    cleanup();
    render(<TrendIndicator value={0} />);

    const indicator = screen.getByTestId('trend-indicator');

    // Should have data-direction="neutral"
    expect(indicator).toHaveAttribute('data-direction', 'neutral');

    // Should display "No change" text
    expect(indicator.textContent).toContain('No change');

    // Should NOT contain an SVG arrow
    const svg = indicator.querySelector('svg');
    expect(svg).toBeNull();
  });
});
