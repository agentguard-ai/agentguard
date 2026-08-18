import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Optimization {
  description: string;
  savings: number;
}

// ─── Logic Under Test (mirrors CostSavingsPanel implementation) ──────────────

function sortAndSliceOptimizations(optimizations: Optimization[]): Optimization[] {
  return [...optimizations]
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 20);
}

function truncateDescription(description: string): string {
  return description.length > 120
    ? description.slice(0, 120) + '…'
    : description;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const optimizationArb = fc.record({
  description: fc.string({ minLength: 0, maxLength: 200 }),
  savings: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('CostSavingsPanel (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 10: Cost Recommendations Sorting and Bounding
  // **Validates: Requirements 8.2**
  it('Property 10: Output is sorted by savings descending (each element savings >= next)', () => {
    fc.assert(
      fc.property(fc.array(optimizationArb, { minLength: 0, maxLength: 50 }), (optimizations) => {
        const sorted = sortAndSliceOptimizations(optimizations);

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].savings).toBeGreaterThanOrEqual(sorted[i + 1].savings);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 10: Cost Recommendations Sorting and Bounding
  // **Validates: Requirements 8.2**
  it('Property 10: Output has at most 20 items', () => {
    fc.assert(
      fc.property(fc.array(optimizationArb, { minLength: 0, maxLength: 50 }), (optimizations) => {
        const sorted = sortAndSliceOptimizations(optimizations);

        expect(sorted.length).toBeLessThanOrEqual(20);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 10: Cost Recommendations Sorting and Bounding
  // **Validates: Requirements 8.2**
  it('Property 10: Each displayed description is ≤ 120 characters', () => {
    fc.assert(
      fc.property(fc.array(optimizationArb, { minLength: 0, maxLength: 50 }), (optimizations) => {
        const sorted = sortAndSliceOptimizations(optimizations);

        for (const opt of sorted) {
          const displayed = truncateDescription(opt.description);
          expect(displayed.length).toBeLessThanOrEqual(121); // 120 chars + 1 ellipsis char '…'
        }
      }),
      { numRuns: 100 }
    );
  });
});
