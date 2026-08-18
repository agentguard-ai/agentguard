/**
 * Property 3: Notification badge conditional visibility
 *
 * For any pair of alert counts (warning count, critical count), a NotificationBadge
 * SHALL render if and only if its corresponding count is greater than zero.
 * When rendered, the badge SHALL display the exact count value.
 *
 * **Validates: Requirements 3.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { NotificationBadge } from '@/components/HeaderBar/HeaderBar';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for badge level */
const levelArb = fc.constantFrom('warning' as const, 'critical' as const);

/** Arbitrary for count values spanning non-positive and positive integers */
const countArb = fc.integer({ min: -100, max: 1000 });

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 3: Notification badge conditional visibility', () => {
  it('badge renders if and only if count > 0, displaying exact count', () => {
    fc.assert(
      fc.property(levelArb, countArb, (level, count) => {
        cleanup();
        const { container } = render(
          <NotificationBadge level={level} count={count} />
        );

        if (count > 0) {
          // Badge should render with role="status"
          const badge = screen.getByRole('status');
          expect(badge).toBeInTheDocument();

          // Should display the exact count value
          expect(badge.textContent).toContain(String(count));
        } else {
          // Badge should not render (returns null)
          expect(container.innerHTML).toBe('');
        }
      }),
      { numRuns: 100 }
    );
  });
});
