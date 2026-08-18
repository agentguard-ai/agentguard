import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, within, cleanup } from '@testing-library/react';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { ModelRoutingPanel } from './ModelRoutingPanel';
import type { RoutingEntry } from './ModelRoutingPanel';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const routingEntryArb = fc.record({
  sourceModel: fc.string({ minLength: 1, maxLength: 30 }),
  targetModel: fc.string({ minLength: 1, maxLength: 30 }),
  perRequestSavings: fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

// ─── Setup ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('ModelRoutingPanel (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 11: Routing Entry Savings Formatting
  // **Validates: Requirements 9.1**
  it('for any routing entry, per-request savings is formatted as USD with exactly 4 decimal places matching /^\\$\\d+\\.\\d{4}$/', () => {
    fc.assert(
      fc.property(routingEntryArb, (entry: RoutingEntry) => {
        // Clean up any previous render
        cleanup();

        mockUseCachedQuery.mockReturnValue({
          data: [entry],
          isLoading: false,
          error: null,
          invalidate: vi.fn(),
        });

        const { container } = render(<ModelRoutingPanel />);

        // Scope queries to this render's container
        const view = within(container);

        // Find the savings cell for the routing entry
        const savingsCell = view.getByTestId('routing-savings');
        const savingsText = savingsCell.textContent || '';

        // Verify the savings is formatted as $X.XXXX (4 decimal places)
        expect(savingsText).toMatch(/^\$\d+\.\d{4}$/);
      }),
      { numRuns: 100 }
    );
  });
});
