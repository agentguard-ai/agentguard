/**
 * Property 2: Navigation state round-trip
 *
 * For any navigation item in the configuration, loading that URL SHALL highlight
 * the corresponding item as active (aria-current="page"). If the URL does not
 * match any configured item, the "Overview" item SHALL be highlighted.
 *
 * - Generate random pathnames from the config items' hrefs
 * - Verify the corresponding item has aria-current="page"
 * - Verify all other items do NOT have aria-current
 * - Generate random non-matching pathnames
 * - Verify "Overview" gets aria-current="page" (default fallback)
 *
 * **Validates: Requirements 1.4, 3.1, 12.1, 12.2, 12.3**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { NAVIGATION_CONFIG } from '@/config/navigation';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next/navigation — usePathname returns the mocked pathname
let mockedPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname,
}));

// Mock useMediaQuery to return true (full/wide mode) so labels are visible
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** All configured navigation items flattened */
const ALL_ITEMS = NAVIGATION_CONFIG.flatMap((section) => section.items);

/** All configured hrefs */
const ALL_HREFS = ALL_ITEMS.map((item) => item.href);

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary that picks a random navigation item href from the config */
const configuredHrefArb = fc.constantFrom(...ALL_HREFS);

/**
 * Arbitrary for random pathnames that do NOT match any configured route.
 * Generates paths like /xyz123, /random-path, /foo/bar etc.
 * Filters out any that match configured hrefs or start with a configured href + '/'.
 */
const unmatchedPathnameArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
      minLength: 3,
      maxLength: 20,
    }),
    fc.option(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
        minLength: 1,
        maxLength: 10,
      }),
      { nil: undefined }
    )
  )
  .map(([segment, sub]) => (sub ? `/${segment}/${sub}` : `/${segment}`))
  .filter((path) => {
    // Must not exactly match any configured href
    if (ALL_HREFS.includes(path)) return false;
    // Must not be a nested route of a configured href (e.g., /agents/123 matches /agents)
    const isNestedMatch = ALL_ITEMS.some(
      (item) => item.href !== '/' && path.startsWith(item.href + '/')
    );
    return !isNestedMatch;
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 2: Navigation state round-trip', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('loading a configured URL highlights the corresponding item as active', async () => {
    // Dynamically import Sidebar after mocks are set up
    const { Sidebar } = await import('@/components/Sidebar/Sidebar');

    fc.assert(
      fc.property(configuredHrefArb, (href) => {
        cleanup();
        mockedPathname = href;

        const { container } = render(<Sidebar />);

        // Find the item with the matching href
        const expectedItem = ALL_ITEMS.find((item) => item.href === href)!;

        // Get all nav links
        const links = container.querySelectorAll('a[href]');

        for (const link of links) {
          const linkHref = link.getAttribute('href');
          const matchingItem = ALL_ITEMS.find((item) => item.href === linkHref);

          if (matchingItem && matchingItem.id === expectedItem.id) {
            // This link should be active
            expect(link.getAttribute('aria-current')).toBe('page');
          } else {
            // All other links should NOT be active
            expect(link.getAttribute('aria-current')).toBeNull();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('unmatched URLs default to "Overview" active state', async () => {
    const { Sidebar } = await import('@/components/Sidebar/Sidebar');

    fc.assert(
      fc.property(unmatchedPathnameArb, (pathname) => {
        cleanup();
        mockedPathname = pathname;

        const { container } = render(<Sidebar />);

        // Get all nav links
        const links = container.querySelectorAll('a[href]');

        for (const link of links) {
          const linkHref = link.getAttribute('href');

          if (linkHref === '/') {
            // Overview (href='/') should be active as the default fallback
            expect(link.getAttribute('aria-current')).toBe('page');
          } else {
            // All other links should NOT be active
            expect(link.getAttribute('aria-current')).toBeNull();
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
