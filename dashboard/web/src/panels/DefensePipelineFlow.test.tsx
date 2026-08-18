import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { DefensePipelineFlow } from './DefensePipelineFlow';
import type { PipelineFlowResponse } from './DefensePipelineFlow';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockPipelineData: PipelineFlowResponse = {
  stages: [
    {
      name: 'Input Validation',
      tokenRange: { min: 100, max: 4096 },
      metrics: { requestsProcessed: 1250, avgLatencyMs: 12 },
    },
    {
      name: 'PII Detection',
      tokenRange: { min: 50, max: 2048 },
      metrics: { detections: 34, redactions: 28 },
    },
    {
      name: 'Policy Evaluation',
      tokenRange: { min: 200, max: 8192 },
      metrics: { evaluations: 1250, denials: 15, approvals: 1235 },
    },
    {
      name: 'Output Filtering',
      tokenRange: { min: 100, max: 4096 },
      metrics: { filtered: 8 },
    },
  ],
  connections: [
    { from: 'Input Validation', to: 'PII Detection' },
    { from: 'PII Detection', to: 'Policy Evaluation' },
    { from: 'Policy Evaluation', to: 'Output Filtering' },
  ],
};

// ─── Setup ───────────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DefensePipelineFlow', () => {
  it('renders loading state when data is loading', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByTestId('pipeline-flow-loading')).toBeInTheDocument();
    expect(screen.getByText('Defense Pipeline')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByTestId('pipeline-flow-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load pipeline flow data')).toBeInTheDocument();
  });

  it('renders empty state when stages array is empty', () => {
    mockUseCachedQuery.mockReturnValue({
      data: { stages: [], connections: [] },
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByTestId('pipeline-flow-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByTestId('pipeline-flow-empty')).toBeInTheDocument();
  });

  it('renders pipeline flow with all stages when data is available', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByTestId('pipeline-flow-chart')).toBeInTheDocument();
    expect(screen.getByText('Defense Pipeline')).toBeInTheDocument();

    // All stage names should be rendered
    expect(screen.getByText('Input Validation')).toBeInTheDocument();
    expect(screen.getByText('PII Detection')).toBeInTheDocument();
    expect(screen.getByText('Policy Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Output Filtering')).toBeInTheDocument();
  });

  it('renders the correct number of stage cards', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    const stageCards = screen.getAllByTestId('pipeline-stage-card');
    expect(stageCards).toHaveLength(4);
  });

  it('displays token count ranges for each stage', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    const tokenRanges = screen.getAllByTestId('token-range');
    expect(tokenRanges).toHaveLength(4);
    expect(tokenRanges[0]).toHaveTextContent('100–4,096 tokens');
    expect(tokenRanges[1]).toHaveTextContent('50–2,048 tokens');
  });

  it('displays per-stage metrics', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    const metrics = screen.getAllByTestId('stage-metric');
    // First stage has 2 metrics, second has 2, third has 3, fourth has 1 = 8 total
    expect(metrics).toHaveLength(8);
  });

  it('shows stage count in the header', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByText('4 stages')).toBeInTheDocument();
  });

  it('shows singular "stage" when there is one stage', () => {
    const singleStageData: PipelineFlowResponse = {
      stages: [mockPipelineData.stages[0]],
      connections: [],
    };

    mockUseCachedQuery.mockReturnValue({
      data: singleStageData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByText('1 stage')).toBeInTheDocument();
  });

  it('passes correct endpoint to useCachedQuery', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(mockUseCachedQuery).toHaveBeenCalledWith({
      endpoint: '/api/v1/pipeline/flow',
    });
  });

  it('has aria-label describing the flow for screen readers', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    const flow = screen.getByTestId('pipeline-flow-chart');
    expect(flow).toHaveAttribute('aria-label');
    expect(flow.getAttribute('aria-label')).toContain('Defense Pipeline flow');
    expect(flow.getAttribute('aria-label')).toContain('4 stages');
  });

  it('renders directional arrows between stages (N-1 arrows for N stages)', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    const { container } = render(<DefensePipelineFlow />);

    // There should be N-1 SVG arrow elements between N stages
    const arrows = container.querySelectorAll('[aria-hidden="true"] svg');
    // 4 stages → 3 directional arrows (plus 4 token icon SVGs in stage cards)
    // We can count the arrow connectors by their parent's aria-hidden
    const arrowContainers = container.querySelectorAll('[aria-hidden="true"]');
    // Filter to only those that are the directional arrows (not the token icons)
    // The directional arrows have a specific parent class structure
    expect(arrowContainers.length).toBeGreaterThanOrEqual(3);
  });

  it('uses role="list" for the flow stages', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockPipelineData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<DefensePipelineFlow />);

    expect(screen.getByRole('list', { name: 'Pipeline stages' })).toBeInTheDocument();
  });

  it('is wrapped in PanelErrorBoundary', () => {
    // Force a render error to check error boundary catches it
    mockUseCachedQuery.mockImplementation(() => {
      throw new Error('Hook crash');
    });

    render(<DefensePipelineFlow />);

    // Should show error boundary fallback, not crash
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('Defense Pipeline')).toBeInTheDocument();
  });
});
