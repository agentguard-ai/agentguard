import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetForecastChart, BudgetForecastContent, DonutChart } from './BudgetForecastChart';
import type { BudgetForecastData } from './BudgetForecastChart';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next/dynamic to render children directly (no dynamic import behavior in tests)
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    // Resolve the loader synchronously for tests
    let Component: React.ComponentType<unknown> | null = null;
    loader().then((mod) => {
      Component = mod.default;
    });
    // Return a wrapper that renders the resolved component
    return function DynamicComponent(props: Record<string, unknown>) {
      if (Component) return <Component {...props} />;
      return <div role="status" aria-label="Loading chart" />;
    };
  },
}));

vi.mock('../hooks/useTimeRange', () => ({
  useTimeRange: () => ({
    timeRange: { start: 1700000000000, end: 1700003600000 },
    preset: '1h',
    setPreset: vi.fn(),
    setCustomRange: vi.fn(),
  }),
}));

const mockUseCachedQuery = vi.fn();
vi.mock('../hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockData: BudgetForecastData = {
  percentConsumed: 72,
  projectedExhaustionDate: '2026-04-15T00:00:00Z',
  daysRemaining: 45,
  dailyBurnRate: 12.5,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BudgetForecastChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DonutChart', () => {
    it('renders an SVG with the percentage text', () => {
      const { container } = render(<DonutChart percentConsumed={72} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      const text = container.querySelector('text');
      expect(text?.textContent).toBe('72%');
    });

    it('clamps percentage to 0-100 range', () => {
      const { container: c1 } = render(<DonutChart percentConsumed={-10} />);
      expect(c1.querySelector('text')?.textContent).toBe('0%');

      const { container: c2 } = render(<DonutChart percentConsumed={150} />);
      expect(c2.querySelector('text')?.textContent).toBe('100%');
    });

    it('renders the consumed arc with correct stroke-dashoffset', () => {
      const { container } = render(<DonutChart percentConsumed={50} />);
      const circles = container.querySelectorAll('circle');
      // Second circle is the consumed arc
      const consumedArc = circles[1];
      const radius = (120 - 14) / 2; // (size - strokeWidth) / 2
      const circumference = 2 * Math.PI * radius;
      const expectedOffset = circumference - (50 / 100) * circumference;
      expect(consumedArc?.getAttribute('stroke-dashoffset')).toBe(String(expectedOffset));
    });
  });

  describe('BudgetForecastContent', () => {
    it('renders all forecast metrics', () => {
      render(<BudgetForecastContent data={mockData} />);

      // Check projected exhaustion date is displayed
      expect(screen.getByText('Projected Exhaustion')).toBeTruthy();

      // Check days remaining
      expect(screen.getByText('Days Remaining')).toBeTruthy();
      expect(screen.getByText('45')).toBeTruthy();

      // Check daily burn rate
      expect(screen.getByText('Daily Burn Rate')).toBeTruthy();
      expect(screen.getByText('$12.50')).toBeTruthy();
    });

    it('provides comprehensive ARIA label for screen readers', () => {
      render(<BudgetForecastContent data={mockData} />);

      const chartRegion = screen.getByRole('img');
      const ariaLabel = chartRegion.getAttribute('aria-label');
      expect(ariaLabel).toContain('Budget forecast donut chart');
      expect(ariaLabel).toContain('72% consumed');
      expect(ariaLabel).toContain('45 days');
      expect(ariaLabel).toContain('$12.50');
    });
  });

  describe('BudgetForecastChart (full panel)', () => {
    it('shows loading skeleton while data is loading', () => {
      mockUseCachedQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        invalidate: vi.fn(),
      });

      render(<BudgetForecastChart />);
      expect(screen.getByText('Budget Exhaustion Forecast')).toBeTruthy();
      expect(screen.getByRole('status')).toBeTruthy();
    });

    it('shows error message when fetch fails', () => {
      mockUseCachedQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
        invalidate: vi.fn(),
      });

      render(<BudgetForecastChart />);
      expect(screen.getByText('Failed to load budget forecast data')).toBeTruthy();
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    it('shows empty state when no data is available', () => {
      mockUseCachedQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        invalidate: vi.fn(),
      });

      render(<BudgetForecastChart />);
      expect(screen.getByText('No budget forecast data available for the selected time range')).toBeTruthy();
    });

    it('renders the donut chart with data', () => {
      mockUseCachedQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        invalidate: vi.fn(),
      });

      render(<BudgetForecastChart />);
      expect(screen.getByText('Budget Exhaustion Forecast')).toBeTruthy();
    });

    it('passes correct params to useCachedQuery with time range', () => {
      mockUseCachedQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        invalidate: vi.fn(),
      });

      render(<BudgetForecastChart />);

      expect(mockUseCachedQuery).toHaveBeenCalledWith({
        endpoint: '/api/v1/metrics/budget-forecast',
        params: {
          start: '1700000000000',
          end: '1700003600000',
        },
      });
    });

    it('is wrapped in PanelErrorBoundary', () => {
      // Simulate a render error in the inner component
      mockUseCachedQuery.mockImplementation(() => {
        throw new Error('Unexpected render error');
      });

      render(<BudgetForecastChart />);
      // PanelErrorBoundary should catch the error and display fallback
      expect(screen.getByTestId('panel-error-boundary')).toBeTruthy();
      expect(screen.getByText('Panel unavailable')).toBeTruthy();
      expect(screen.getByLabelText('Retry loading Budget Forecast')).toBeTruthy();
    });
  });
});
