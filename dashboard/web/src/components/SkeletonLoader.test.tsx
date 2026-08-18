import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonLoader } from './SkeletonLoader';

describe('SkeletonLoader', () => {
  describe('kpi-card variant', () => {
    it('should render with pulsing animation', () => {
      render(<SkeletonLoader variant="kpi-card" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('animate-pulse');
    });

    it('should have approximate 120px height', () => {
      render(<SkeletonLoader variant="kpi-card" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('h-[120px]');
    });

    it('should use panel border radius', () => {
      render(<SkeletonLoader variant="kpi-card" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('rounded-panel');
    });

    it('should have accessible loading label', () => {
      render(<SkeletonLoader variant="kpi-card" />);
      const el = screen.getByRole('status');
      expect(el.getAttribute('aria-label')).toBe('Loading KPI card');
    });
  });

  describe('chart variant', () => {
    it('should render with pulsing animation', () => {
      render(<SkeletonLoader variant="chart" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('animate-pulse');
    });

    it('should have approximate 300px height', () => {
      render(<SkeletonLoader variant="chart" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('h-[300px]');
    });

    it('should have accessible loading label', () => {
      render(<SkeletonLoader variant="chart" />);
      const el = screen.getByRole('status');
      expect(el.getAttribute('aria-label')).toBe('Loading chart');
    });
  });

  describe('table variant', () => {
    it('should render with pulsing animation', () => {
      render(<SkeletonLoader variant="table" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('animate-pulse');
    });

    it('should have approximate 250px height', () => {
      render(<SkeletonLoader variant="table" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('h-[250px]');
    });

    it('should render multiple row placeholders', () => {
      const { container } = render(<SkeletonLoader variant="table" />);
      // 5 row placeholders each in a flex container
      const rows = container.querySelectorAll('.flex.gap-4');
      // Header row + 5 data rows = at least 6 flex gap-4 containers
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });

    it('should have accessible loading label', () => {
      render(<SkeletonLoader variant="table" />);
      const el = screen.getByRole('status');
      expect(el.getAttribute('aria-label')).toBe('Loading table');
    });
  });

  describe('flow variant', () => {
    it('should render with pulsing animation', () => {
      render(<SkeletonLoader variant="flow" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('animate-pulse');
    });

    it('should have approximate 200px height', () => {
      render(<SkeletonLoader variant="flow" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('h-[200px]');
    });

    it('should render connected block placeholders', () => {
      const { container } = render(<SkeletonLoader variant="flow" />);
      // 4 stage blocks (rounded-lg) + 3 connectors (h-1)
      const blocks = container.querySelectorAll('.rounded-lg');
      expect(blocks.length).toBe(4);
    });

    it('should have accessible loading label', () => {
      render(<SkeletonLoader variant="flow" />);
      const el = screen.getByRole('status');
      expect(el.getAttribute('aria-label')).toBe('Loading flow');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(<SkeletonLoader variant="kpi-card" className="mt-4 w-full" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('mt-4');
      expect(el.className).toContain('w-full');
    });
  });

  describe('theme integration', () => {
    it('should use theme CSS custom properties for background', () => {
      render(<SkeletonLoader variant="kpi-card" />);
      const el = screen.getByRole('status');
      expect(el.className).toContain('bg-[var(--color-bg-secondary)]');
    });
  });
});
