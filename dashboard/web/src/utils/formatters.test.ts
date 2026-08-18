import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatCount,
  formatDollar,
  formatMicroDollar,
  formatPercent,
  formatLatency,
  calcPercentage,
} from './formatters';

describe('formatters (unit tests)', () => {
  describe('formatCount', () => {
    it('formats zero', () => {
      expect(formatCount(0)).toBe('0');
    });

    it('formats small numbers without commas', () => {
      expect(formatCount(999)).toBe('999');
    });

    it('formats thousands with commas', () => {
      expect(formatCount(1234567)).toBe('1,234,567');
    });
  });

  describe('formatDollar', () => {
    it('formats zero', () => {
      expect(formatDollar(0)).toBe('$0.00');
    });

    it('formats with 2 decimal places', () => {
      expect(formatDollar(12345.6)).toBe('$12,345.60');
    });

    it('formats large values', () => {
      expect(formatDollar(12345.67)).toBe('$12,345.67');
    });
  });

  describe('formatMicroDollar', () => {
    it('formats with 4 decimal places', () => {
      expect(formatMicroDollar(0.0082)).toBe('$0.0082');
    });

    it('pads zeros to 4 decimal places', () => {
      expect(formatMicroDollar(1)).toBe('$1.0000');
    });
  });

  describe('formatPercent', () => {
    it('formats with 1 decimal place', () => {
      expect(formatPercent(72.3)).toBe('72.3%');
    });

    it('formats zero', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });

    it('pads to 1 decimal place', () => {
      expect(formatPercent(100)).toBe('100.0%');
    });
  });

  describe('formatLatency', () => {
    it('rounds and adds ms suffix', () => {
      expect(formatLatency(42.7)).toBe('43ms');
    });

    it('handles integer input', () => {
      expect(formatLatency(100)).toBe('100ms');
    });
  });

  describe('calcPercentage', () => {
    it('calculates basic percentage', () => {
      expect(calcPercentage(50, 100)).toBe(50);
    });

    it('clamps to 100 when current exceeds total', () => {
      expect(calcPercentage(150, 100)).toBe(100);
    });

    it('returns 0 when total is 0', () => {
      expect(calcPercentage(50, 0)).toBe(0);
    });

    it('clamps negative results to 0', () => {
      expect(calcPercentage(-10, 100)).toBe(0);
    });

    it('rounds to nearest integer', () => {
      expect(calcPercentage(1, 3)).toBe(33);
    });
  });
});

describe('formatters (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 3: Integer Formatting with Comma Separators
  // **Validates: Requirements 3.2, 3.4**
  it('formatCount produces comma-separated integers', () => {
    fc.assert(
      fc.property(fc.nat(10_000_000), (n) => {
        const result = formatCount(n);
        expect(result).toMatch(/^[\d,]+$/);
        expect(Number(result.replace(/,/g, ''))).toBe(n);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 4: Dollar Formatting Round-Trip
  // **Validates: Requirements 3.3, 8.1**
  it('formatDollar produces valid dollar strings with 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          const result = formatDollar(n);
          expect(result).toMatch(/^\$[\d,]+\.\d{2}$/);
          const parsed = Number(result.replace(/[$,]/g, ''));
          expect(Math.abs(parsed - n)).toBeLessThan(0.006);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 5: Budget Progress Bar Percentage Calculation
  // **Validates: Requirements 3.5**
  it('calcPercentage is always a 0-100 integer', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: Math.fround(0.01), max: 100_000, noNaN: true, noDefaultInfinity: true }),
        (consumed, limit) => {
          const pct = calcPercentage(consumed, limit);
          expect(Number.isInteger(pct)).toBe(true);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 6: Pipeline Metrics Formatting (latency)
  // **Validates: Requirements 5.2, 5.3**
  it('formatPercent produces valid percentage strings with 1 decimal place', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          const result = formatPercent(n);
          expect(result).toMatch(/^\d+\.\d%$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatLatency produces rounded integer with ms suffix', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          const result = formatLatency(n);
          expect(result).toMatch(/^\d+ms$/);
          expect(Number(result.replace('ms', ''))).toBe(Math.round(n));
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 11: Routing Entry Savings Formatting
  // **Validates: Requirements 9.1**
  it('formatMicroDollar produces valid USD with exactly 4 decimal places', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (n) => {
          const result = formatMicroDollar(n);
          expect(result).toMatch(/^\$\d+\.\d{4}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
