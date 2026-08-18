/**
 * Property 6: Velocity alert threshold
 *
 * For any cost velocity value and configured threshold, the velocity alert badge
 * SHALL display in warning color if and only if the velocity value exceeds the
 * threshold.
 *
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { VelocityAlertBadge } from '@/panels/CostVelocityChart';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate random burn rate and threshold pairs.
 * Uses positive doubles representing dollar amounts per hour.
 */
const positiveFloat = fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: Velocity alert threshold', () => {
  it('badge MUST render when burnRate > threshold (velocityAlert = false)', () => {
    fc.assert(
      fc.property(
        positiveFloat,
        positiveFloat,
        (burnRate, threshold) => {
          // Constrain: burnRate > threshold
          fc.pre(burnRate > threshold);

          cleanup();
          render(
            <VelocityAlertBadge
              burnRate={burnRate}
              threshold={threshold}
              velocityAlert={false}
            />
          );

          // Badge must render
          const badge = screen.queryByTestId('velocity-alert-badge');
          expect(badge).toBeInTheDocument();

          // Badge must have role="status"
          expect(badge).toHaveAttribute('role', 'status');

          // Badge must use warning color class (text-[var(--color-warning)])
          expect(badge?.className).toContain('text-[var(--color-warning)]');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('badge MUST NOT render when burnRate <= threshold and velocityAlert = false', () => {
    fc.assert(
      fc.property(
        positiveFloat,
        positiveFloat,
        (burnRate, threshold) => {
          // Constrain: burnRate <= threshold
          fc.pre(burnRate <= threshold);

          cleanup();
          render(
            <VelocityAlertBadge
              burnRate={burnRate}
              threshold={threshold}
              velocityAlert={false}
            />
          );

          // Badge must NOT render
          const badge = screen.queryByTestId('velocity-alert-badge');
          expect(badge).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('badge MUST render when velocityAlert = true regardless of burnRate/threshold', () => {
    fc.assert(
      fc.property(
        positiveFloat,
        positiveFloat,
        (burnRate, threshold) => {
          cleanup();
          render(
            <VelocityAlertBadge
              burnRate={burnRate}
              threshold={threshold}
              velocityAlert={true}
            />
          );

          // Badge must always render when velocityAlert is true
          const badge = screen.queryByTestId('velocity-alert-badge');
          expect(badge).toBeInTheDocument();

          // Badge must have role="status"
          expect(badge).toHaveAttribute('role', 'status');

          // Badge must use warning color class
          expect(badge?.className).toContain('text-[var(--color-warning)]');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('badge includes warning color class and accessible content when rendered', () => {
    fc.assert(
      fc.property(
        positiveFloat,
        positiveFloat,
        fc.boolean(),
        (burnRate, threshold, velocityAlert) => {
          // Only test cases where badge should render
          fc.pre(velocityAlert || burnRate > threshold);

          cleanup();
          render(
            <VelocityAlertBadge
              burnRate={burnRate}
              threshold={threshold}
              velocityAlert={velocityAlert}
            />
          );

          const badge = screen.queryByTestId('velocity-alert-badge');
          expect(badge).toBeInTheDocument();

          // Warning background color class
          expect(badge?.className).toContain('bg-[var(--color-warning)]');

          // Warning text color class
          expect(badge?.className).toContain('text-[var(--color-warning)]');

          // Contains accessible text label
          expect(badge?.textContent).toContain('Velocity Alert');
        }
      ),
      { numRuns: 100 }
    );
  });
});
