import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CostEvidenceSection,
  shouldShowVarianceWarning,
  calculateVariance,
  type CostEvidenceDetail,
} from './CostEvidenceSection';

// ─── Test Data ───────────────────────────────────────────────────────────────

const fullCostEvidence: CostEvidenceDetail = {
  provider: 'openai',
  model: 'gpt-4',
  inputCostUsd: 0.003125,
  outputCostUsd: 0.006250,
  totalCostUsd: 0.009375,
  requestTokens: 1250,
  responseTokens: 500,
  totalTokens: 1750,
  estimatedCost: 0.008000,
  actualCost: 0.009375,
  variance: 0.001375,
};

// ─── Unit Tests: Helper Functions ────────────────────────────────────────────

describe('shouldShowVarianceWarning', () => {
  it('returns false when both values are null', () => {
    expect(shouldShowVarianceWarning(null, null)).toBe(false);
  });

  it('returns false when estimatedCost is null', () => {
    expect(shouldShowVarianceWarning(null, 0.01)).toBe(false);
  });

  it('returns false when actualCost is null', () => {
    expect(shouldShowVarianceWarning(0.01, null)).toBe(false);
  });

  it('returns true when actual > estimated × 1.2', () => {
    // 0.013 > 0.01 * 1.2 = 0.012 → true
    expect(shouldShowVarianceWarning(0.01, 0.013)).toBe(true);
  });

  it('returns false when actual ≤ estimated × 1.2', () => {
    // 0.012 ≤ 0.01 * 1.2 = 0.012 → false
    expect(shouldShowVarianceWarning(0.01, 0.012)).toBe(false);
  });

  it('returns true when estimatedCost ≤ 0', () => {
    expect(shouldShowVarianceWarning(0, 0.005)).toBe(true);
    expect(shouldShowVarianceWarning(-0.001, 0.005)).toBe(true);
  });
});

describe('calculateVariance', () => {
  it('returns null when estimatedCost is null', () => {
    expect(calculateVariance(null, 0.01)).toBeNull();
  });

  it('returns null when actualCost is null', () => {
    expect(calculateVariance(0.01, null)).toBeNull();
  });

  it('returns actual - estimated', () => {
    expect(calculateVariance(0.008, 0.009375)).toBeCloseTo(0.001375);
  });

  it('returns negative variance when actual < estimated', () => {
    expect(calculateVariance(0.01, 0.005)).toBeCloseTo(-0.005);
  });
});

// ─── Component Tests ─────────────────────────────────────────────────────────

describe('CostEvidenceSection', () => {
  it('displays "No cost data available" when costEvidence is null', () => {
    render(<CostEvidenceSection costEvidence={null} />);
    expect(screen.getByText('No cost data available')).toBeInTheDocument();
  });

  it('has aria-label "Cost evidence"', () => {
    render(<CostEvidenceSection costEvidence={null} />);
    expect(screen.getByLabelText('Cost evidence')).toBeInTheDocument();
  });

  it('displays the section heading', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    expect(screen.getByText('Cost Evidence')).toBeInTheDocument();
  });

  it('displays provider and model', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('displays USD costs formatted to 6 decimal places', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    expect(screen.getByText('$0.003125')).toBeInTheDocument();
    expect(screen.getByText('$0.006250')).toBeInTheDocument();
    // totalCostUsd ($0.009375) also matches actualCost — use getAllByText
    const totalCostElements = screen.getAllByText('$0.009375');
    expect(totalCostElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays token counts', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    // Token counts use locale formatting
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('1,750')).toBeInTheDocument();
  });

  it('displays estimated vs actual comparison when both present', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    expect(screen.getByText('Estimated vs Actual')).toBeInTheDocument();
    expect(screen.getByText('$0.008000')).toBeInTheDocument();
  });

  it('displays variance with sign prefix', () => {
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    // variance = 0.009375 - 0.008000 = 0.001375, positive so prefixed with +
    expect(screen.getByText('+$0.001375')).toBeInTheDocument();
  });

  it('does not show warning when within threshold', () => {
    // actual 0.009375 vs estimated 0.008 → 0.009375 / 0.008 = 1.17 < 1.2
    render(<CostEvidenceSection costEvidence={fullCostEvidence} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows warning when actual exceeds estimated by more than 20%', () => {
    const highCost: CostEvidenceDetail = {
      ...fullCostEvidence,
      estimatedCost: 0.005,
      actualCost: 0.007, // 0.007 > 0.005 * 1.2 = 0.006 → warning
    };
    render(<CostEvidenceSection costEvidence={highCost} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Cost exceeds estimate threshold')).toBeInTheDocument();
  });

  it('shows warning when estimated cost is zero', () => {
    const zeroCost: CostEvidenceDetail = {
      ...fullCostEvidence,
      estimatedCost: 0,
      actualCost: 0.005,
    };
    render(<CostEvidenceSection costEvidence={zeroCost} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows warning when estimated cost is negative', () => {
    const negativeCost: CostEvidenceDetail = {
      ...fullCostEvidence,
      estimatedCost: -0.001,
      actualCost: 0.005,
    };
    render(<CostEvidenceSection costEvidence={negativeCost} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not show estimated vs actual section when both are null', () => {
    const noCostComparison: CostEvidenceDetail = {
      ...fullCostEvidence,
      estimatedCost: null,
      actualCost: null,
      variance: null,
    };
    render(<CostEvidenceSection costEvidence={noCostComparison} />);
    expect(screen.queryByText('Estimated vs Actual')).not.toBeInTheDocument();
  });
});
