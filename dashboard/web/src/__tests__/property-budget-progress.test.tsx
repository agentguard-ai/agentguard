/**
 * Property 5: Budget progress bar accuracy
 *
 * For any valid budget data (remaining ≥ 0, consumed ≥ 0, limit > 0,
 * consumed + remaining = limit), the Progress_Bar width percentage SHALL equal
 * `(consumed / limit) * 100`, rounded to the nearest integer.
 *
 * **Validates: Requirements 4.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { ProgressBar } from '@/components/KPIBanner/ProgressBar';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate valid budget tuples where:
 * - limit > 0
 * - consumed >= 0
 * - remaining >= 0
 * - consumed + remaining = limit
 *
 * Strategy: generate limit (1..100000) then consumed (0..limit),
 * derive remaining = limit - consumed.
 */
const budgetTupleArb = fc
  .integer({ min: 1, max: 100000 })
  .chain((limit) =>
    fc.integer({ min: 0, max: limit }).map((consumed) => ({
      consumed,
      remaining: limit - consumed,
      limit,
    }))
  );

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 5: Budget progress bar accuracy', () => {
  it('progress bar aria-valuenow equals Math.round((consumed / limit) * 100)', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(budgetTupleArb, ({ consumed, remaining, limit }) => {
        // Verify preconditions
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(consumed).toBeGreaterThanOrEqual(0);
        expect(limit).toBeGreaterThan(0);
        expect(consumed + remaining).toBe(limit);

        cleanup();
        render(<ProgressBar consumed={consumed} limit={limit} />);

        const expectedPercentage = Math.round((consumed / limit) * 100);

        // Verify aria-valuenow
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        expect(Number(progressBar.getAttribute('aria-valuenow'))).toBe(
          expectedPercentage
        );

        // Verify fill width style
        const fill = screen.getByTestId('progress-bar-fill');
        const clampedPercentage = Math.max(0, Math.min(100, expectedPercentage));
        expect(fill.style.width).toBe(`${clampedPercentage}%`);
      }),
      { numRuns: 100 }
    );
  });
});
