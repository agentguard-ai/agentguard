import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ConfidenceSection,
  classifyConfidence,
  formatConfidencePercent,
  sortFindingsByConfidence,
} from './ConfidenceSection';
import type { FindingDetail } from './ConfidenceSection';

// ─── Unit Tests: Helper Functions ────────────────────────────────────────────

describe('classifyConfidence', () => {
  it('returns "low" for values below 0.4', () => {
    expect(classifyConfidence(0)).toBe('low');
    expect(classifyConfidence(0.1)).toBe('low');
    expect(classifyConfidence(0.39)).toBe('low');
  });

  it('returns "medium" for values between 0.4 and 0.7 inclusive', () => {
    expect(classifyConfidence(0.4)).toBe('medium');
    expect(classifyConfidence(0.55)).toBe('medium');
    expect(classifyConfidence(0.7)).toBe('medium');
  });

  it('returns "high" for values above 0.7', () => {
    expect(classifyConfidence(0.71)).toBe('high');
    expect(classifyConfidence(0.85)).toBe('high');
    expect(classifyConfidence(1.0)).toBe('high');
  });
});

describe('formatConfidencePercent', () => {
  it('formats 0 as "0%"', () => {
    expect(formatConfidencePercent(0)).toBe('0%');
  });

  it('formats 1 as "100%"', () => {
    expect(formatConfidencePercent(1)).toBe('100%');
  });

  it('rounds to nearest integer percent', () => {
    expect(formatConfidencePercent(0.456)).toBe('46%');
    expect(formatConfidencePercent(0.854)).toBe('85%');
  });
});

describe('sortFindingsByConfidence', () => {
  it('returns empty array for empty input', () => {
    expect(sortFindingsByConfidence([])).toEqual([]);
  });

  it('sorts findings by confidence descending', () => {
    const findings: FindingDetail[] = [
      { type: 'a', category: 'cat', confidence: 0.3, severity: 'low' },
      { type: 'b', category: 'cat', confidence: 0.9, severity: 'high' },
      { type: 'c', category: 'cat', confidence: 0.6, severity: 'medium' },
    ];
    const sorted = sortFindingsByConfidence(findings);
    expect(sorted[0].confidence).toBe(0.9);
    expect(sorted[1].confidence).toBe(0.6);
    expect(sorted[2].confidence).toBe(0.3);
  });

  it('does not mutate the original array', () => {
    const findings: FindingDetail[] = [
      { type: 'a', category: 'cat', confidence: 0.2, severity: 'low' },
      { type: 'b', category: 'cat', confidence: 0.8, severity: 'high' },
    ];
    const original = [...findings];
    sortFindingsByConfidence(findings);
    expect(findings).toEqual(original);
  });
});

// ─── Unit Tests: ConfidenceSection Component ─────────────────────────────────

describe('ConfidenceSection', () => {
  it('renders empty state when no findings provided', () => {
    render(<ConfidenceSection findings={[]} />);
    expect(screen.getByText('No findings available')).toBeInTheDocument();
  });

  it('renders section heading', () => {
    const findings: FindingDetail[] = [
      { type: 'PII', category: 'detection', confidence: 0.85, severity: 'high' },
    ];
    render(<ConfidenceSection findings={findings} />);
    expect(screen.getByText('Confidence Scores')).toBeInTheDocument();
  });

  it('displays finding type, category, confidence percentage, and severity', () => {
    const findings: FindingDetail[] = [
      { type: 'PII_DETECTED', category: 'privacy', confidence: 0.92, severity: 'critical' },
    ];
    render(<ConfidenceSection findings={findings} />);
    expect(screen.getByText('PII_DETECTED')).toBeInTheDocument();
    expect(screen.getByText('privacy')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders confidence level badge with correct classification', () => {
    const findings: FindingDetail[] = [
      { type: 'low_conf', category: 'test', confidence: 0.2, severity: 'low' },
      { type: 'med_conf', category: 'test', confidence: 0.5, severity: 'medium' },
      { type: 'high_conf', category: 'test', confidence: 0.9, severity: 'high' },
    ];
    render(<ConfidenceSection findings={findings} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('sorts findings by confidence descending in rendered output', () => {
    const findings: FindingDetail[] = [
      { type: 'first', category: 'cat', confidence: 0.3, severity: 'low' },
      { type: 'second', category: 'cat', confidence: 0.9, severity: 'high' },
      { type: 'third', category: 'cat', confidence: 0.6, severity: 'medium' },
    ];
    const { container } = render(<ConfidenceSection findings={findings} />);
    const rows = container.querySelectorAll('[role="row"]');
    // First data row (index 1, as index 0 is the header)
    expect(rows[1].textContent).toContain('second');
    expect(rows[2].textContent).toContain('third');
    expect(rows[3].textContent).toContain('first');
  });

  it('renders confidence bar with correct aria attributes', () => {
    const findings: FindingDetail[] = [
      { type: 'test', category: 'cat', confidence: 0.75, severity: 'high' },
    ];
    render(<ConfidenceSection findings={findings} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('has accessible section label', () => {
    const findings: FindingDetail[] = [
      { type: 'test', category: 'cat', confidence: 0.5, severity: 'medium' },
    ];
    render(<ConfidenceSection findings={findings} />);
    expect(screen.getByLabelText('Confidence scores')).toBeInTheDocument();
  });
});
