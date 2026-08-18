import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  describe('width calculation', () => {
    it('calculates width as Math.round((consumed / limit) * 100)', () => {
      render(<ProgressBar consumed={75} limit={100} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '75%' });
    });

    it('rounds to nearest integer', () => {
      // 33 / 100 = 33.33... → rounds to 33
      render(<ProgressBar consumed={33} limit={100} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '33%' });
    });

    it('handles rounding up correctly', () => {
      // 2 / 3 = 66.67 → rounds to 67
      render(<ProgressBar consumed={2} limit={3} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '67%' });
    });

    it('handles 0% consumption', () => {
      render(<ProgressBar consumed={0} limit={100} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
    });

    it('handles 100% consumption', () => {
      render(<ProgressBar consumed={100} limit={100} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });

    it('handles zero limit gracefully', () => {
      render(<ProgressBar consumed={50} limit={0} />);
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
    });
  });

  describe('accessibility', () => {
    it('has role="progressbar"', () => {
      render(<ProgressBar consumed={50} limit={100} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('has aria-valuenow with the calculated percentage', () => {
      render(<ProgressBar consumed={60} limit={200} />);
      // 60/200 = 30
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
    });

    it('has aria-valuemin=0', () => {
      render(<ProgressBar consumed={10} limit={100} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0');
    });

    it('has aria-valuemax=100', () => {
      render(<ProgressBar consumed={10} limit={100} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
    });

    it('has descriptive aria-label', () => {
      render(<ProgressBar consumed={45} limit={100} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-label',
        'Budget consumption: 45%'
      );
    });
  });

  describe('visible percentage label', () => {
    it('displays percentage text', () => {
      render(<ProgressBar consumed={80} limit={100} />);
      expect(screen.getByTestId('progress-bar-label')).toHaveTextContent('80% consumed');
    });

    it('displays 0% for no consumption', () => {
      render(<ProgressBar consumed={0} limit={500} />);
      expect(screen.getByTestId('progress-bar-label')).toHaveTextContent('0% consumed');
    });
  });
});
