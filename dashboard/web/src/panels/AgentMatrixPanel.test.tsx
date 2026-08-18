import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { AgentMatrixPanel } from './AgentMatrixPanel';
import type { AgentMatrixResponse } from './AgentMatrixPanel';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockAgentData: AgentMatrixResponse = {
  agents: [
    {
      id: 'agent-001',
      name: 'Content Analyzer',
      status: 'active',
      requestsLastHour: 1250,
      deniedLastHour: 12,
      avgLatencyMs: 145.7,
      provider: 'OpenAI',
      model: 'gpt-4o',
    },
    {
      id: 'agent-002',
      name: 'Security Scanner',
      status: 'frozen',
      requestsLastHour: 0,
      deniedLastHour: 45,
      avgLatencyMs: 230.2,
      provider: 'Anthropic',
      model: 'claude-3-opus',
    },
    {
      id: 'agent-003',
      name: 'Summarizer Bot',
      status: 'idle',
      requestsLastHour: 3,
      deniedLastHour: 0,
      avgLatencyMs: 89.4,
      provider: 'Google',
      model: 'gemini-pro',
    },
    {
      id: 'agent-004',
      name: 'Classifier Agent',
      status: 'active',
      requestsLastHour: 890,
      deniedLastHour: 5,
      avgLatencyMs: 112.0,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    },
  ],
  totalActive: 2,
  totalIdle: 1,
  totalFrozen: 1,
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

describe('AgentMatrixPanel', () => {
  // ─── Loading State (Requirement 7.7) ─────────────────────────────────────

  it('renders loading state with skeleton when data is loading', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByTestId('agent-matrix-loading')).toBeInTheDocument();
    expect(screen.getByText('Agent Matrix')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading table')).toBeInTheDocument();
  });

  // ─── Error State (Requirement 7.6) ──────────────────────────────────────

  it('renders error state when fetch fails', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByTestId('agent-matrix-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load agent matrix data')).toBeInTheDocument();
    expect(screen.getByText('Endpoint: /api/v1/agents/matrix')).toBeInTheDocument();
  });

  it('renders retry button in error state', () => {
    const mockInvalidate = vi.fn();
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: mockInvalidate,
    });

    render(<AgentMatrixPanel />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    retryButton.click();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  // ─── Empty State (Requirement 7.8) ──────────────────────────────────────

  it('renders empty state when no agents returned', () => {
    mockUseCachedQuery.mockReturnValue({
      data: { agents: [], totalActive: 0, totalIdle: 0, totalFrozen: 0 },
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByTestId('agent-matrix-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(
      screen.getByText('No agent data available for the selected time range'),
    ).toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByTestId('agent-matrix-empty')).toBeInTheDocument();
  });

  // ─── Table Rendering (Requirement 7.1) ──────────────────────────────────

  it('renders table with correct columns', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByText('Agent Name')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Requests/hr')).toBeInTheDocument();
    expect(screen.getByText('Denied/hr')).toBeInTheDocument();
    expect(screen.getByText('Avg Latency (ms)')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all agent rows from data', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    const rows = screen.getAllByTestId('agent-row');
    expect(rows).toHaveLength(4);
  });

  it('displays agent names correctly', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByText('Content Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Security Scanner')).toBeInTheDocument();
    expect(screen.getByText('Summarizer Bot')).toBeInTheDocument();
    expect(screen.getByText('Classifier Agent')).toBeInTheDocument();
  });

  it('displays provider and model correctly', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument();
    expect(screen.getByText('gemini-pro')).toBeInTheDocument();
  });

  it('formats requests and denied counts with comma separators', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('890')).toBeInTheDocument();
  });

  it('formats latency as rounded integer with ms suffix', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByText('146ms')).toBeInTheDocument(); // 145.7 → 146
    expect(screen.getByText('230ms')).toBeInTheDocument(); // 230.2 → 230
    expect(screen.getByText('89ms')).toBeInTheDocument();  // 89.4 → 89
    expect(screen.getByText('112ms')).toBeInTheDocument(); // 112.0 → 112
  });

  // ─── Status Badges (Requirements 7.2, 7.3, 7.4) ─────────────────────────

  it('renders active status with green badge, checkmark icon, and text', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    const activeIndicators = screen.getAllByTestId('status-active');
    expect(activeIndicators).toHaveLength(2); // Content Analyzer + Classifier Agent
    expect(activeIndicators[0]).toHaveTextContent('active');
    expect(activeIndicators[0].querySelector('svg')).not.toBeNull();
  });

  it('renders frozen status with red badge, snowflake icon, and text', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    const frozenIndicator = screen.getByTestId('status-frozen');
    expect(frozenIndicator).toBeInTheDocument();
    expect(frozenIndicator).toHaveTextContent('frozen');
    expect(frozenIndicator.querySelector('svg')).not.toBeNull();
    expect(frozenIndicator.className).toContain('red');
  });

  it('renders idle status with gray badge, pause icon, and text', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    const idleIndicator = screen.getByTestId('status-idle');
    expect(idleIndicator).toBeInTheDocument();
    expect(idleIndicator).toHaveTextContent('idle');
    expect(idleIndicator.querySelector('svg')).not.toBeNull();
    expect(idleIndicator.className).toContain('gray');
  });

  it('all status badges include text labels and icons (not color-only)', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    const activeIndicators = screen.getAllByTestId('status-active');
    const frozenIndicator = screen.getByTestId('status-frozen');
    const idleIndicator = screen.getByTestId('status-idle');

    // Verify text is present in each
    activeIndicators.forEach((el) => expect(el.querySelector('span')).not.toBeNull());
    expect(frozenIndicator.querySelector('span')).not.toBeNull();
    expect(idleIndicator.querySelector('span')).not.toBeNull();

    // Verify icon (SVG) is present in each
    activeIndicators.forEach((el) => expect(el.querySelector('svg')).not.toBeNull());
    expect(frozenIndicator.querySelector('svg')).not.toBeNull();
    expect(idleIndicator.querySelector('svg')).not.toBeNull();
  });

  // ─── API Integration (Requirement 7.5, 12.3) ────────────────────────────

  it('calls useCachedQuery with correct endpoint /api/v1/agents/matrix', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(mockUseCachedQuery).toHaveBeenCalledWith({
      endpoint: '/api/v1/agents/matrix',
    });
  });

  // ─── Accessibility ───────────────────────────────────────────────────────

  it('has accessible table with aria-label', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockAgentData,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByRole('table', { name: 'Agent Matrix table' })).toBeInTheDocument();
  });

  it('error state has role="alert" for screen readers', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    });

    render(<AgentMatrixPanel />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
