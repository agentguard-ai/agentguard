import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomDetailRow } from './BottomDetailRow';

// Mock the child panel components to isolate BottomDetailRow layout testing
vi.mock('@/panels/CostSavingsPanel', () => ({
  CostSavingsPanel: () => <div data-testid="cost-savings-panel">CostSavingsPanel</div>,
}));

vi.mock('@/panels/ModelRoutingPanel', () => ({
  ModelRoutingPanel: () => <div data-testid="model-routing-panel">ModelRoutingPanel</div>,
}));

vi.mock('@/panels/ProtocolGovernancePanel', () => ({
  ProtocolGovernancePanel: () => <div data-testid="protocol-governance-panel">ProtocolGovernancePanel</div>,
}));

describe('BottomDetailRow', () => {
  it('renders all three panels', () => {
    render(<BottomDetailRow />);

    expect(screen.getByTestId('cost-savings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('model-routing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('protocol-governance-panel')).toBeInTheDocument();
  });

  it('renders with correct grid CSS classes for responsive layout', () => {
    render(<BottomDetailRow />);

    const section = screen.getByTestId('bottom-detail-row');
    expect(section).toHaveClass('grid', 'grid-cols-1', 'min-[1600px]:grid-cols-3');
  });

  it('uses var(--row-gap) for grid gap spacing', () => {
    render(<BottomDetailRow />);

    const section = screen.getByTestId('bottom-detail-row');
    expect(section).toHaveStyle({ gap: 'var(--row-gap)' });
  });

  it('renders as a section element with aria-label', () => {
    render(<BottomDetailRow />);

    const section = screen.getByRole('region', { name: 'Bottom-detail panels' });
    expect(section).toBeInTheDocument();
  });

  it('renders exactly 3 child elements', () => {
    render(<BottomDetailRow />);

    const section = screen.getByTestId('bottom-detail-row');
    expect(section.children).toHaveLength(3);
  });
});
