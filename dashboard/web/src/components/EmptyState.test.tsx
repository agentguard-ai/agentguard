import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import type { EmptyStateProps } from '@/config/navigation';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  const panelTypes: EmptyStateProps['panelType'][] = ['chart', 'table', 'flow', 'alerts', 'kpi'];

  it('renders with data-testid attribute', () => {
    render(<EmptyState panelType="chart" message="No chart data available" />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('displays the provided message', () => {
    render(<EmptyState panelType="table" message="No records for the selected time range" />);
    expect(screen.getByText('No records for the selected time range')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    render(<EmptyState panelType="alerts" message="No alerts triggered" />);
    expect(screen.getByLabelText('Empty state: No alerts triggered')).toBeInTheDocument();
  });

  it.each(panelTypes)('renders an SVG icon for panelType "%s"', (panelType) => {
    const { container } = render(
      <EmptyState panelType={panelType} message={`No ${panelType} data`} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses dashed border styling (distinct from SkeletonLoader pulsing and error boundary danger color)', () => {
    const { container } = render(
      <EmptyState panelType="flow" message="No pipeline data" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('border-dashed');
    // Should NOT contain pulse animation (that's SkeletonLoader)
    expect(wrapper.className).not.toContain('animate-pulse');
    // Should NOT contain danger/error colors
    expect(wrapper.className).not.toContain('danger');
  });

  it('centers content vertically and horizontally', () => {
    const { container } = render(
      <EmptyState panelType="kpi" message="No metrics available" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });
});
