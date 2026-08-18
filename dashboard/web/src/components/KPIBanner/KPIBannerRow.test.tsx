import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  KPIBannerRow,
  TrendIndicator,
  ProgressBar,
  transformKPIData,
} from './KPIBannerRow';
import type { KPIResponse } from './KPIBannerRow';

// ─── Mock Hooks ──────────────────────────────────────────────────────────────

const mockTimeRange = { start: 1700000000000, end: 1700003600000 };

vi.mock('@/hooks/useTimeRange', () => ({
  useTimeRange: () => ({
    timeRange: { start: 1700000000000, end: 1700003600000 },
    preset: '1h' as const,
    setPreset: vi.fn(),
    setCustomRange: vi.fn(),
  }),
}));

let mockCachedQueryReturn = {
  data: null as KPIResponse | null,
  isLoading: false,
  error: null as Error | null,
  invalidate: vi.fn(),
};

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (options: any) => mockCachedQueryReturn,
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const sampleKPIResponse: KPIResponse = {
  totalRequests: { value: 12500, trend: 8.3 },
  totalCost: { value: 1234.56, trend: -3.2 },
  governanceDenials: {
    total: 42,
    byCategory: { 'PII Detection': 18, 'Cost Limit': 14, 'Prompt Injection': 10 },
  },
  monthlyBudget: { remaining: 3000, consumed: 7000, limit: 10000 },
};

// ─── transformKPIData Tests ──────────────────────────────────────────────────

describe('transformKPIData', () => {
  it('transforms API response into 4 KPI cards', () => {
    const cards = transformKPIData(sampleKPIResponse);
    expect(cards).toHaveLength(4);
  });

  it('creates Total Requests card with formatted count and up trend', () => {
    const cards = transformKPIData(sampleKPIResponse);
    const requestsCard = cards.find((c) => c.id === 'total-requests');
    expect(requestsCard).toBeDefined();
    expect(requestsCard!.title).toBe('Total Requests');
    expect(requestsCard!.value).toBe('12,500');
    expect(requestsCard!.trend).toEqual({ direction: 'up', percentage: 8.3 });
  });

  it('creates Total Cost card with dollar formatting and down trend', () => {
    const cards = transformKPIData(sampleKPIResponse);
    const costCard = cards.find((c) => c.id === 'total-cost');
    expect(costCard).toBeDefined();
    expect(costCard!.title).toBe('Total Cost');
    expect(costCard!.value).toBe('$1,234.56');
    expect(costCard!.trend).toEqual({ direction: 'down', percentage: 3.2 });
  });

  it('creates Governance Denials card with total and category breakdown subtitle', () => {
    const cards = transformKPIData(sampleKPIResponse);
    const denialsCard = cards.find((c) => c.id === 'governance-denials');
    expect(denialsCard).toBeDefined();
    expect(denialsCard!.title).toBe('Governance Denials');
    expect(denialsCard!.value).toBe('42');
    expect(denialsCard!.subtitle).toContain('PII Detection: 18');
    expect(denialsCard!.subtitle).toContain('Cost Limit: 14');
    expect(denialsCard!.subtitle).toContain('Prompt Injection: 10');
  });

  it('creates Monthly Budget card with remaining, subtitle, and progress', () => {
    const cards = transformKPIData(sampleKPIResponse);
    const budgetCard = cards.find((c) => c.id === 'monthly-budget');
    expect(budgetCard).toBeDefined();
    expect(budgetCard!.title).toBe('Monthly Budget');
    expect(budgetCard!.value).toBe('$3,000.00');
    expect(budgetCard!.subtitle).toBe('of $10,000.00 limit');
    expect(budgetCard!.progress).toEqual({ current: 7000, total: 10000 });
  });

  it('returns undefined trend when trend value is 0', () => {
    const data: KPIResponse = {
      ...sampleKPIResponse,
      totalRequests: { value: 100, trend: 0 },
    };
    const cards = transformKPIData(data);
    const requestsCard = cards.find((c) => c.id === 'total-requests');
    expect(requestsCard!.trend).toBeUndefined();
  });

  it('returns undefined subtitle when byCategory is empty', () => {
    const data: KPIResponse = {
      ...sampleKPIResponse,
      governanceDenials: { total: 0, byCategory: {} },
    };
    const cards = transformKPIData(data);
    const denialsCard = cards.find((c) => c.id === 'governance-denials');
    expect(denialsCard!.subtitle).toBeUndefined();
  });
});

// ─── TrendIndicator Tests ────────────────────────────────────────────────────

describe('TrendIndicator', () => {
  it('renders upward arrow with percentage for positive trend', () => {
    render(<TrendIndicator trend={{ direction: 'up', percentage: 5.2 }} />);
    const indicator = screen.getByTestId('trend-up');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('5.2%');
    expect(indicator).toHaveAttribute('aria-label', 'Increase 5.2%');
  });

  it('renders downward arrow with percentage for negative trend', () => {
    render(<TrendIndicator trend={{ direction: 'down', percentage: 3.1 }} />);
    const indicator = screen.getByTestId('trend-down');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('3.1%');
    expect(indicator).toHaveAttribute('aria-label', 'Decrease 3.1%');
  });

  it('includes screen-reader-only direction label', () => {
    const { container } = render(
      <TrendIndicator trend={{ direction: 'up', percentage: 10 }} />
    );
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toHaveTextContent('Increase');
  });
});

// ─── ProgressBar Tests ───────────────────────────────────────────────────────

describe('ProgressBar', () => {
  it('calculates correct width percentage', () => {
    render(<ProgressBar current={7000} total={10000} />);
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill).toHaveStyle({ width: '70%' });
  });

  it('rounds to nearest integer', () => {
    render(<ProgressBar current={333} total={1000} />);
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill).toHaveStyle({ width: '33%' });
  });

  it('shows 0% when total is 0', () => {
    render(<ProgressBar current={0} total={0} />);
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill).toHaveStyle({ width: '0%' });
  });

  it('shows 100% when fully consumed', () => {
    render(<ProgressBar current={5000} total={5000} />);
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('has correct ARIA attributes', () => {
    render(<ProgressBar current={7000} total={10000} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '70');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-label', 'Budget consumed: 70%');
  });
});

// ─── KPIBannerRow Component Tests ────────────────────────────────────────────

describe('KPIBannerRow', () => {
  beforeEach(() => {
    mockCachedQueryReturn = {
      data: null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };
  });

  it('renders 4 skeleton cards while loading', () => {
    mockCachedQueryReturn = {
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    expect(screen.getByTestId('kpi-banner-loading')).toBeInTheDocument();
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(4);
  });

  it('renders error state when fetch fails', () => {
    mockCachedQueryReturn = {
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    expect(screen.getByTestId('kpi-banner-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load KPI metrics')).toBeInTheDocument();
  });

  it('renders retry button in error state and calls invalidate on click', () => {
    const mockInvalidate = vi.fn();
    mockCachedQueryReturn = {
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: mockInvalidate,
    };

    render(<KPIBannerRow />);
    const retryButton = screen.getByTestId('kpi-banner-retry');
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toHaveAttribute('aria-label', 'Retry loading KPI metrics');

    fireEvent.click(retryButton);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('renders 4 metric cards when data is available', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    expect(screen.getByTestId('kpi-banner-row')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-total-requests')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-total-cost')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-governance-denials')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-monthly-budget')).toBeInTheDocument();
  });

  it('displays Total Requests card with correct value and trend', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const card = screen.getByTestId('kpi-card-total-requests');
    expect(card).toHaveTextContent('Total Requests');
    expect(card).toHaveTextContent('12,500');
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });

  it('displays Total Cost card with dollar amount and down trend', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const card = screen.getByTestId('kpi-card-total-cost');
    expect(card).toHaveTextContent('Total Cost');
    expect(card).toHaveTextContent('$1,234.56');
    expect(screen.getByTestId('trend-down')).toBeInTheDocument();
  });

  it('displays Governance Denials card with count and category breakdown', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const card = screen.getByTestId('kpi-card-governance-denials');
    expect(card).toHaveTextContent('Governance Denials');
    expect(card).toHaveTextContent('42');
    expect(card).toHaveTextContent('PII Detection: 18');
  });

  it('displays Monthly Budget card with remaining amount, progress bar, and limit', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const card = screen.getByTestId('kpi-card-monthly-budget');
    expect(card).toHaveTextContent('Monthly Budget');
    expect(card).toHaveTextContent('$3,000.00');
    expect(card).toHaveTextContent('of $10,000.00 limit');
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
  });

  it('renders responsive grid with correct CSS classes', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const section = screen.getByTestId('kpi-banner-row');
    expect(section.className).toContain('grid-cols-2');
    expect(section.className).toContain('min-[1600px]:grid-cols-4');
  });

  it('has correct ARIA label on the section', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    expect(screen.getByLabelText('Key performance indicators')).toBeInTheDocument();
  });

  it('returns null when no data and no loading/error state', () => {
    mockCachedQueryReturn = {
      data: null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    const { container } = render(<KPIBannerRow />);
    expect(container.innerHTML).toBe('');
  });

  it('applies aria-label attributes on KPI cards with metric descriptions', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);

    // Total Requests card — positive category → "Healthy metric: 12,500"
    const requestsCard = screen.getByTestId('kpi-card-total-requests');
    expect(requestsCard).toHaveAttribute('aria-label', 'Healthy metric: 12,500');

    // Total Cost card — neutral category → "Metric: $1,234.56"
    const costCard = screen.getByTestId('kpi-card-total-cost');
    expect(costCard).toHaveAttribute('aria-label', 'Metric: $1,234.56');

    // Governance Denials card — danger category → "Critical metric: 42"
    const denialsCard = screen.getByTestId('kpi-card-governance-denials');
    expect(denialsCard).toHaveAttribute('aria-label', 'Critical metric: 42');

    // Monthly Budget card — warning category → "Warning metric: $3,000.00"
    const budgetCard = screen.getByTestId('kpi-card-monthly-budget');
    expect(budgetCard).toHaveAttribute('aria-label', 'Warning metric: $3,000.00');
  });

  it('renders status labels (Healthy, Critical, Warning) alongside color indicators', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);

    // Total Requests has "Healthy" status label
    const requestsStatus = screen.getByTestId('kpi-status-total-requests');
    expect(requestsStatus).toHaveTextContent('Healthy');

    // Governance Denials has "Critical" status label
    const denialsStatus = screen.getByTestId('kpi-status-governance-denials');
    expect(denialsStatus).toHaveTextContent('Critical');

    // Monthly Budget has "Warning" status label
    const budgetStatus = screen.getByTestId('kpi-status-monthly-budget');
    expect(budgetStatus).toHaveTextContent('Warning');
  });

  it('does not render status label for neutral category', () => {
    mockCachedQueryReturn = {
      data: sampleKPIResponse,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);

    // Total Cost is neutral — no status label rendered
    expect(screen.queryByTestId('kpi-status-total-cost')).not.toBeInTheDocument();
  });

  it('loading state section has correct responsive grid classes', () => {
    mockCachedQueryReturn = {
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    };

    render(<KPIBannerRow />);
    const loadingSection = screen.getByTestId('kpi-banner-loading');
    expect(loadingSection.className).toContain('grid');
    expect(loadingSection.className).toContain('grid-cols-2');
    expect(loadingSection.className).toContain('min-[1600px]:grid-cols-4');
    expect(loadingSection.className).toContain('gap-4');
  });
});
