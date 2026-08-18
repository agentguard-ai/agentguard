import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the chart panel components to isolate ChartsRow layout testing
vi.mock('@/panels/CostVelocityChart', () => ({
  CostVelocityChart: () => (
    <div data-testid="cost-velocity-chart">CostVelocityChart</div>
  ),
}));

vi.mock('@/panels/BudgetForecastChart', () => ({
  BudgetForecastChart: () => (
    <div data-testid="budget-forecast-chart">BudgetForecastChart</div>
  ),
}));

import { ChartsRow } from './ChartsRow';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChartsRow', () => {
  // ─── Layout: 2-column grid on wide viewports (Requirement 4.1) ─────────────

  describe('2-column grid layout on wide viewports', () => {
    it('applies the responsive 2-column grid class for ≥1400px breakpoint', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('min-[1400px]:grid-cols-2');
    });

    it('uses CSS grid layout', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('grid');
    });

    it('applies gap-4 spacing between chart panels', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('gap-4');
    });
  });

  // ─── Layout: single-column stack on narrow viewports (Requirement 4.1) ─────

  describe('single-column stack on narrow viewports', () => {
    it('applies grid-cols-1 as the base (mobile-first) column configuration', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('grid-cols-1');
    });

    it('base grid-cols-1 ensures vertical stacking below 1400px', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      // Tailwind mobile-first: grid-cols-1 is the default, min-[1400px]:grid-cols-2 kicks in on wide
      const classes = section.className.split(' ');
      expect(classes).toContain('grid-cols-1');
      expect(classes).toContain('min-[1400px]:grid-cols-2');
    });
  });

  // ─── Renders both chart panels ─────────────────────────────────────────────

  describe('renders both chart panels', () => {
    it('renders CostVelocityChart', () => {
      render(<ChartsRow />);
      expect(screen.getByTestId('cost-velocity-chart')).toBeInTheDocument();
    });

    it('renders BudgetForecastChart', () => {
      render(<ChartsRow />);
      expect(screen.getByTestId('budget-forecast-chart')).toBeInTheDocument();
    });

    it('renders exactly 2 child panel wrappers', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.children).toHaveLength(2);
    });
  });

  // ─── Accessibility (Requirement 4.1) ───────────────────────────────────────

  describe('accessibility', () => {
    it('renders as a semantic section element', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.tagName).toBe('SECTION');
    });

    it('has aria-label="Charts" for screen reader identification', () => {
      render(<ChartsRow />);
      expect(screen.getByLabelText('Charts')).toBeInTheDocument();
    });
  });
});

// ─── Velocity Alert Badge Tests (Requirement 4.2) ────────────────────────────

describe('ChartsRow — velocity alert badge visibility', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('displays velocity alert badge when burn rate exceeds threshold', async () => {
    // Re-mock CostVelocityChart to render VelocityAlertBadge directly
    vi.doMock('@/panels/CostVelocityChart', () => ({
      CostVelocityChart: () => (
        <div data-testid="cost-velocity-chart">
          <span
            data-testid="velocity-alert-badge"
            role="status"
            aria-label="Velocity alert: burn rate $15.00/hr exceeds threshold $10.00/hr"
          >
            Velocity Alert
          </span>
        </div>
      ),
    }));

    vi.doMock('@/panels/BudgetForecastChart', () => ({
      BudgetForecastChart: () => (
        <div data-testid="budget-forecast-chart">BudgetForecastChart</div>
      ),
    }));

    const { ChartsRow: ChartsRowFresh } = await import('./ChartsRow');
    render(<ChartsRowFresh />);

    const badge = screen.getByTestId('velocity-alert-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Velocity Alert');
    expect(badge).toHaveAttribute('role', 'status');
  });

  it('does not display velocity alert badge when burn rate is below threshold', async () => {
    // Re-mock CostVelocityChart without the alert badge (normal state)
    vi.doMock('@/panels/CostVelocityChart', () => ({
      CostVelocityChart: () => (
        <div data-testid="cost-velocity-chart">
          {/* No alert badge when under threshold */}
          <span>Cost Velocity</span>
        </div>
      ),
    }));

    vi.doMock('@/panels/BudgetForecastChart', () => ({
      BudgetForecastChart: () => (
        <div data-testid="budget-forecast-chart">BudgetForecastChart</div>
      ),
    }));

    const { ChartsRow: ChartsRowFresh } = await import('./ChartsRow');
    render(<ChartsRowFresh />);

    expect(screen.queryByTestId('velocity-alert-badge')).not.toBeInTheDocument();
  });
});

// ─── VelocityAlertBadge unit tests (Requirement 4.2) ─────────────────────────

describe('VelocityAlertBadge', () => {
  // Import VelocityAlertBadge directly using importActual to bypass the mock

  it('renders when velocityAlert is true', async () => {
    const { VelocityAlertBadge } = await vi.importActual<typeof import('@/panels/CostVelocityChart')>('@/panels/CostVelocityChart');
    render(
      <VelocityAlertBadge burnRate={15} threshold={10} velocityAlert={true} />
    );
    expect(screen.getByTestId('velocity-alert-badge')).toBeInTheDocument();
    expect(screen.getByText('Velocity Alert')).toBeInTheDocument();
  });

  it('renders when burnRate exceeds threshold even if velocityAlert is false', async () => {
    const { VelocityAlertBadge } = await vi.importActual<typeof import('@/panels/CostVelocityChart')>('@/panels/CostVelocityChart');
    render(
      <VelocityAlertBadge burnRate={12.5} threshold={10} velocityAlert={false} />
    );
    expect(screen.getByTestId('velocity-alert-badge')).toBeInTheDocument();
  });

  it('does not render when burnRate is below threshold and velocityAlert is false', async () => {
    const { VelocityAlertBadge } = await vi.importActual<typeof import('@/panels/CostVelocityChart')>('@/panels/CostVelocityChart');
    const { container } = render(
      <VelocityAlertBadge burnRate={8} threshold={10} velocityAlert={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('has accessible aria-label describing the alert state', async () => {
    const { VelocityAlertBadge } = await vi.importActual<typeof import('@/panels/CostVelocityChart')>('@/panels/CostVelocityChart');
    render(
      <VelocityAlertBadge burnRate={15} threshold={10} velocityAlert={true} />
    );
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Velocity alert: burn rate $15.00/hr exceeds threshold $10.00/hr'
    );
  });
});

// ─── Error Isolation Tests (Requirement 4.5) ─────────────────────────────────

describe('ChartsRow — independent error isolation between charts', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    // Suppress React error boundary console noise during tests
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('BudgetForecastChart still renders when CostVelocityChart throws', async () => {
    // Mock CostVelocityChart to throw an error
    vi.doMock('@/panels/CostVelocityChart', () => ({
      CostVelocityChart: () => {
        throw new Error('CostVelocityChart crashed');
      },
    }));

    vi.doMock('@/panels/BudgetForecastChart', () => ({
      BudgetForecastChart: () => (
        <div data-testid="budget-forecast-chart">BudgetForecastChart content</div>
      ),
    }));

    const { ChartsRow: ChartsRowFresh } = await import('./ChartsRow');
    render(<ChartsRowFresh />);

    // BudgetForecastChart should still render independently
    expect(screen.getByTestId('budget-forecast-chart')).toBeInTheDocument();
    expect(screen.getByText('BudgetForecastChart content')).toBeInTheDocument();

    // Error boundary should show fallback for the broken chart
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
  });

  it('CostVelocityChart still renders when BudgetForecastChart throws', async () => {
    vi.doMock('@/panels/CostVelocityChart', () => ({
      CostVelocityChart: () => (
        <div data-testid="cost-velocity-chart">CostVelocityChart content</div>
      ),
    }));

    // Mock BudgetForecastChart to throw an error
    vi.doMock('@/panels/BudgetForecastChart', () => ({
      BudgetForecastChart: () => {
        throw new Error('BudgetForecastChart crashed');
      },
    }));

    const { ChartsRow: ChartsRowFresh } = await import('./ChartsRow');
    render(<ChartsRowFresh />);

    // CostVelocityChart should still render independently
    expect(screen.getByTestId('cost-velocity-chart')).toBeInTheDocument();
    expect(screen.getByText('CostVelocityChart content')).toBeInTheDocument();

    // Error boundary should show fallback for the broken chart
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
  });

  it('error in one panel does not cause full section to unmount', async () => {
    vi.doMock('@/panels/CostVelocityChart', () => ({
      CostVelocityChart: () => {
        throw new Error('Chart error');
      },
    }));

    vi.doMock('@/panels/BudgetForecastChart', () => ({
      BudgetForecastChart: () => (
        <div data-testid="budget-forecast-chart">BudgetForecastChart</div>
      ),
    }));

    const { ChartsRow: ChartsRowFresh } = await import('./ChartsRow');
    render(<ChartsRowFresh />);

    // The section element should still be in the DOM
    const section = screen.getByTestId('charts-row');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
    // Should still have 2 children (one error boundary fallback + one working panel)
    expect(section.children).toHaveLength(2);
  });
});
