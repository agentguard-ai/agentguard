/**
 * Property 9: Empty state rendering
 *
 * For any panel that receives an empty data set, the EmptyState component SHALL:
 * 1. Display when provided (with any valid panelType and message)
 * 2. Be visually distinct from SkeletonLoader (no animate-pulse class)
 * 3. Be visually distinct from error boundary (no danger color)
 * 4. Contain the message text
 * 5. Contain a data-testid="empty-state" attribute
 *
 * **Validates: Requirements 14.1, 14.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { EmptyState } from '@/components/EmptyState';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for valid panel types matching EmptyStateProps['panelType'] */
const panelTypeArb = fc.constantFrom(
  'chart' as const,
  'table' as const,
  'flow' as const,
  'alerts' as const,
  'kpi' as const
);

/**
 * Arbitrary for realistic non-empty message strings.
 * Uses alphanumeric + common punctuation, no leading/trailing whitespace,
 * simulating real empty-state messages like "No data available for the selected time range."
 */
const messageArb = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:'.split('')
    ),
    { minLength: 5, maxLength: 120 }
  )
  .map((s) => s.trim())
  .filter((s) => s.length >= 5);

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 9: Empty state rendering', () => {
  it('displays EmptyState for any valid panelType and message, visually distinct from skeleton and error', () => {
    fc.assert(
      fc.property(panelTypeArb, messageArb, (panelType, message) => {
        // Clean up previous renders to isolate each iteration
        cleanup();

        const { container } = render(
          <EmptyState panelType={panelType} message={message} />
        );

        const wrapper = container.firstElementChild as HTMLElement;

        // 1. Verify data-testid="empty-state" is present
        expect(wrapper.getAttribute('data-testid')).toBe('empty-state');

        // 2. Verify message text is rendered within the component
        expect(wrapper.textContent).toContain(message);

        // 3. Verify NOT a skeleton loader (no animate-pulse class on wrapper)
        expect(wrapper.className).not.toContain('animate-pulse');

        // 4. Verify NOT an error boundary (no danger color classes)
        expect(wrapper.className).not.toContain('danger');
        expect(wrapper.className).not.toContain('red');

        // 5. Verify has dashed border (visual marker distinguishing empty state)
        expect(wrapper.className).toContain('border-dashed');
      }),
      { numRuns: 100 }
    );
  });
});
