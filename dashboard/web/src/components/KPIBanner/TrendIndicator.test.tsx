import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendIndicator } from './TrendIndicator';

describe('TrendIndicator', () => {
  describe('positive trends', () => {
    it('renders with data-direction="up" for positive value', () => {
      render(<TrendIndicator value={12} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('data-direction', 'up');
    });

    it('renders an SVG arrow icon', () => {
      const { container } = render(<TrendIndicator value={12} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('displays the percentage value', () => {
      render(<TrendIndicator value={25} />);
      expect(screen.getByTestId('trend-indicator')).toHaveTextContent('25%');
    });

    it('includes "increase" text label for accessibility (non-color alternative)', () => {
      render(<TrendIndicator value={8} />);
      expect(screen.getByTestId('trend-indicator')).toHaveTextContent('increase');
    });

    it('uses green trend-up color', () => {
      render(<TrendIndicator value={5} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveStyle({ color: 'var(--kpi-trend-up)' });
    });

    it('has aria-label describing the trend', () => {
      render(<TrendIndicator value={14} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('aria-label', 'increase 14%');
    });
  });

  describe('negative trends', () => {
    it('renders with data-direction="down" for negative value', () => {
      render(<TrendIndicator value={-7} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('data-direction', 'down');
    });

    it('displays the absolute percentage value (no negative sign)', () => {
      render(<TrendIndicator value={-15} />);
      const text = screen.getByTestId('trend-indicator').textContent;
      expect(text).toContain('15%');
      expect(text).not.toContain('-15%');
    });

    it('includes "decrease" text label for accessibility (non-color alternative)', () => {
      render(<TrendIndicator value={-3} />);
      expect(screen.getByTestId('trend-indicator')).toHaveTextContent('decrease');
    });

    it('uses red trend-down color', () => {
      render(<TrendIndicator value={-10} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveStyle({ color: 'var(--kpi-trend-down)' });
    });

    it('has aria-label describing the trend', () => {
      render(<TrendIndicator value={-22} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('aria-label', 'decrease 22%');
    });
  });

  describe('zero/no change', () => {
    it('renders "No change" text for zero value', () => {
      render(<TrendIndicator value={0} />);
      expect(screen.getByTestId('trend-indicator')).toHaveTextContent('No change');
    });

    it('has neutral direction data attribute', () => {
      render(<TrendIndicator value={0} />);
      expect(screen.getByTestId('trend-indicator')).toHaveAttribute('data-direction', 'neutral');
    });

    it('does not render an SVG arrow', () => {
      const { container } = render(<TrendIndicator value={0} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });
});
