import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next/dynamic to render the chart component synchronously in tests
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>, _opts?: unknown) => {
    // In tests, we render the loading state placeholder since the dynamic import
    // is async. We'll test the content component directly instead.
    const MockDynamic = (props: Record<string, unknown>) => {
      return <div data-testid="mock-dynamic-chart" {...props} />;
    };
    MockDynamic.displayName = 'MockDynamic';
    return MockDynamic;
  },
}));

// Mock the hooks
const mockUseCachedQuery = vi.fn();
const mockUseTimeRange = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

vi.mock('@/hooks/useTimeRange', () => ({
  useTimeRange: () => mockUseTimeRange(),
}));

// Must import AFTER mocks are set up
import { CostVelocityChart, VelocityAlertBadge } from './CostVelocityChart';
import type { CostVelocityData } from './CostVelocityChart';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockCostVelocityData: CostVelocityData = {
  timeSeries: [
    { timestamp: 1700000000000, cost: 12.5 },
    { timestamp: 1700003600000, cost: 15.3 },
    { timestamp: 1700007200000, cost: 18.1 },
    { timestamp: 1700010800000, cost: 22.7 },
  ],
  burnRate: 5.2,
  threshold: 4.0,
  velocityAlert: true,
};

const mockTimeRange = {
  timeRange: { start: 1700000000000, end: 1700014400000 },
  preset: '24h' as const,
  setPreset: vi.fn(),
  setCustomRange: vi.fn(),
};

// ─── Setup ───────────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  mockUseTimeRange.mockReturnValue(mockTimeRange);
});

afterEach(() => {
  consoleSpy.mockRestore();
  vi.clearAllMocks();
});

// ─── Tests: VelocityAlertBadge ───────────────────────────────────────────────

describe('VelocityAlertBadge', () => {
  it('renders when velocityAlert is true', () => {
    render(
      <VelocityAlertBadge burnRate={5.0} threshold={4.0} velocityAlert={true} />
    );

    expect(screen.getByTestId('velocity-alert-badge')).toBeInTheDocument();
    expect(screen.getByText('Velocity Alert')).toBeInTheDocument();
  });

  it('renders when burnRate exceeds threshold (even if velocityAlert is false)', () => {
    render(
      <VelocityAlertBadge burnRate={5.0} threshold={4.0} velocityAlert={false} />
    );

    expect(screen.getByTestId('velocity-alert-badge')).toBeInTheDocument();
  });

  it('does not render when velocity is below threshold and velocityAlert is false', () => {
    render(
      <VelocityAlertBadge burnRate={3.0} threshold={4.0} velocityAlert={false} />
    );

    expect(screen.queryByTestId('velocity-alert-badge')).not.toBeInTheDocument();
  });

  it('has proper ARIA label with burn rate and threshold values', () => {
    render(
      <VelocityAlertBadge burnRate={5.2} threshold={4.0} velocityAlert={true} />
    );

    const badge = screen.getByTestId('velocity-alert-badge');
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('5.20'));
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('4.00'));
  });

  it('has role="status" for accessibility', () => {
    render(
      <VelocityAlertBadge burnRate={5.0} threshold={4.0} velocityAlert={true} />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses warning color styling', () => {
    render(
      <VelocityAlertBadge burnRate={5.0} threshold={4.0} velocityAlert={true} />
    );

    const badge = screen.getByTestId('velocity-alert-badge');
    expect(badge.className).toContain('color-warning');
  });
});

// ─── Tests: CostVelocityChart (full panel) ───────────────────────────────────

describe('CostVelocityChart', () => {
  it('renders loading state when data is loading', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.getByTestId('cost-velocity-loading')).toBeInTheDocument();
    expect(screen.getByText('Cost Velocity')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.getByTestId('cost-velocity-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cost velocity data')).toBeInTheDocument();
  });

  it('renders chart content when data is available', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCostVelocityData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.getByTestId('cost-velocity-chart')).toBeInTheDocument();
    expect(screen.getByText('Cost Velocity')).toBeInTheDocument();
  });

  it('displays burn rate and threshold values', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCostVelocityData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.getByTestId('burn-rate-value')).toHaveTextContent('$5.20/hr');
    expect(screen.getByTestId('threshold-value')).toHaveTextContent('$4.00/hr');
  });

  it('displays velocity alert badge when velocity exceeds threshold', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCostVelocityData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.getByTestId('velocity-alert-badge')).toBeInTheDocument();
  });

  it('does not display velocity alert badge when velocity is under threshold', () => {
    const safeData: CostVelocityData = {
      ...mockCostVelocityData,
      burnRate: 2.0,
      threshold: 4.0,
      velocityAlert: false,
    };

    mockUseCachedQuery.mockReturnValue({
      data: safeData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(screen.queryByTestId('velocity-alert-badge')).not.toBeInTheDocument();
  });

  it('passes correct params to useCachedQuery', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    expect(mockUseCachedQuery).toHaveBeenCalledWith({
      endpoint: '/api/v1/metrics/cost-velocity',
      params: {
        start: mockTimeRange.timeRange.start,
        end: mockTimeRange.timeRange.end,
      },
    });
  });

  it('has aria-label describing chart type and data for screen readers', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCostVelocityData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CostVelocityChart />);

    const chart = screen.getByTestId('cost-velocity-chart');
    expect(chart).toHaveAttribute('aria-label');
    expect(chart.getAttribute('aria-label')).toContain('Cost Velocity');
    expect(chart.getAttribute('aria-label')).toContain('line chart');
  });

  it('is wrapped in PanelErrorBoundary', () => {
    // Force a render error to check error boundary catches it
    mockUseCachedQuery.mockImplementation(() => {
      throw new Error('Hook crash');
    });

    render(<CostVelocityChart />);

    // Should show error boundary fallback, not crash
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('Cost Velocity')).toBeInTheDocument();
  });
});
