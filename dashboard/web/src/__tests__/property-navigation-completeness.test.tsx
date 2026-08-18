/**
 * Property 1: Navigation config rendering completeness
 *
 * For any valid navigation configuration (array of sections with items),
 * rendering the Sidebar SHALL produce DOM elements for every section label
 * and every navigation item label/icon present in the configuration.
 *
 * **Validates: Requirements 1.3, 1.7**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import type { NavigationSection } from '@/config/navigation';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// We need to declare a mutable config that the mock will return.
let mockNavConfig: NavigationSection[] = [];

// Mock the navigation module to use our generated config
vi.mock('@/config/navigation', () => ({
  get NAVIGATION_CONFIG() {
    return mockNavConfig;
  },
  // Re-export types aren't affected by vi.mock, but we need the interfaces
  // available. The types are stripped at compile time so this is fine.
}));

// Mock next/navigation's usePathname to return a fixed path
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// Mock useMediaQuery to return true (wide/full mode, not collapsed)
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

// ─── Test Icon Component ─────────────────────────────────────────────────────

/**
 * A minimal test icon component that renders an SVG with a data-testid
 * so we can verify icons are rendered for each item.
 */
function TestIcon({ className }: { className?: string }) {
  return createElement('svg', {
    className,
    'data-testid': 'nav-icon',
    'aria-hidden': 'true',
  });
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Arbitrary for safe label strings — alphanumeric with spaces,
 * trimmed and non-empty, simulating real navigation labels.
 */
const labelArb = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')
    ),
    { minLength: 3, maxLength: 30 }
  )
  .map((s) => s.trim())
  .filter((s) => s.length >= 2);

/**
 * Arbitrary for a single navigation item.
 * Each item has a unique id, a random label, the TestIcon, and an href path.
 */
const navigationItemArb = (index: number) =>
  labelArb.map((label) => ({
    id: `item-${index}-${label.replace(/\s+/g, '-').toLowerCase()}`,
    label,
    icon: TestIcon as ComponentType<{ className?: string }>,
    href: `/section-${index}`,
  }));

/**
 * Arbitrary for a navigation section with 1-4 items.
 * Each section has a unique label and a random set of items.
 */
const navigationSectionArb = (sectionIndex: number) =>
  fc
    .tuple(
      labelArb,
      fc.integer({ min: 1, max: 4 })
    )
    .chain(([sectionLabel, itemCount]) =>
      fc
        .tuple(
          ...Array.from({ length: itemCount }, (_, i) =>
            navigationItemArb(sectionIndex * 10 + i)
          )
        )
        .map((items) => ({
          label: sectionLabel,
          items,
        }))
    );

/**
 * Arbitrary for a complete navigation config with 1-5 sections.
 * Generates a random number of sections, each with random items.
 */
const navigationConfigArb: fc.Arbitrary<NavigationSection[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((numSections) =>
    fc.tuple(
      ...Array.from({ length: numSections }, (_, i) => navigationSectionArb(i))
    )
  );

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 1: Navigation config rendering completeness', () => {
  beforeEach(() => {
    cleanup();
  });

  it('all section labels render as DOM elements when sidebar is not collapsed', async () => {
    // Dynamically import Sidebar after mocks are set up
    const { Sidebar } = await import('@/components/Sidebar/Sidebar');

    fc.assert(
      fc.property(navigationConfigArb, (config) => {
        cleanup();
        // Set the mock config for this iteration
        mockNavConfig = config;

        const { container } = render(<Sidebar />);

        // Verify every section label appears in the DOM
        for (const section of config) {
          const sectionLabelElements = container.querySelectorAll('h3');
          const labels = Array.from(sectionLabelElements).map(
            (el) => el.textContent
          );
          expect(labels).toContain(section.label);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all item labels render as DOM elements when sidebar is not collapsed', async () => {
    const { Sidebar } = await import('@/components/Sidebar/Sidebar');

    fc.assert(
      fc.property(navigationConfigArb, (config) => {
        cleanup();
        mockNavConfig = config;

        const { container } = render(<Sidebar />);

        // Verify every item label appears in the DOM
        for (const section of config) {
          for (const item of section.items) {
            const links = container.querySelectorAll('a[href]');
            const linkTexts = Array.from(links).map((el) => el.textContent);
            const hasLabel = linkTexts.some((text) =>
              text?.includes(item.label)
            );
            expect(hasLabel).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every navigation item has an icon (SVG element) rendered', async () => {
    const { Sidebar } = await import('@/components/Sidebar/Sidebar');

    fc.assert(
      fc.property(navigationConfigArb, (config) => {
        cleanup();
        mockNavConfig = config;

        const { container } = render(<Sidebar />);

        // Count total expected items
        const totalItems = config.reduce(
          (sum, section) => sum + section.items.length,
          0
        );

        // Each item should render an SVG icon
        const icons = container.querySelectorAll('svg[data-testid="nav-icon"]');
        expect(icons.length).toBe(totalItems);
      }),
      { numRuns: 100 }
    );
  });
});
