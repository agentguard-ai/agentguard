import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { getMetricColorClass, getMetricAriaLabel, MetricCategory } from './semanticColors';

const categoryArb = fc.constantFrom<MetricCategory>('positive', 'danger', 'warning', 'neutral');

describe('semanticColors (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 1: KPI Semantic Color Mapping
  // **Validates: Requirements 2.1, 2.2, 2.3**
  it('Property 1: getMetricColorClass returns the correct Tailwind color class for each category', () => {
    const expectedMapping: Record<MetricCategory, string> = {
      positive: 'text-green-500',
      danger: 'text-red-500',
      warning: 'text-orange-500',
      neutral: 'text-gray-500',
    };

    fc.assert(
      fc.property(categoryArb, (category) => {
        const result = getMetricColorClass(category);

        // Result must be a non-empty string
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // Result must match the expected semantic color mapping
        expect(result).toBe(expectedMapping[category]);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: dashboard-overview-redesign, Property 2: Non-Color Accessibility Indicator
  // **Validates: Requirements 2.4, 10.2**
  it('Property 2: getMetricAriaLabel returns an accessible label with descriptive prefix and value', () => {
    fc.assert(
      fc.property(categoryArb, fc.string(), (category, value) => {
        const result = getMetricAriaLabel(category, value);

        // Result must be a non-empty string
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // Result must contain the value so meaning is linked to data
        expect(result).toContain(value);

        // Result must contain a descriptive prefix that differs by category
        // This ensures meaning is conveyed without color
        const prefixes: Record<MetricCategory, string> = {
          positive: 'Healthy metric',
          danger: 'Critical metric',
          warning: 'Warning metric',
          neutral: 'Metric',
        };
        expect(result).toContain(prefixes[category]);

        // Each category has a unique prefix — verify no two categories share same prefix
        // by checking that the result starts with the expected category-specific prefix
        expect(result.startsWith(prefixes[category])).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Additional property: prefixes are distinct across all categories
  it('Property 2 (supplement): each category produces a distinct descriptive prefix', () => {
    const categories: MetricCategory[] = ['positive', 'danger', 'warning', 'neutral'];
    const fixedValue = 'test-value';

    const labels = categories.map((cat) => getMetricAriaLabel(cat, fixedValue));

    // All labels must be unique (since prefixes differ)
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(categories.length);

    // Verify prefixes are different by extracting the part before the value
    const prefixes = labels.map((label) => label.replace(fixedValue, '').trim());
    const uniquePrefixes = new Set(prefixes);
    expect(uniquePrefixes.size).toBe(categories.length);
  });
});
