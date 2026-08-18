/**
 * Property 13: Widget Error Isolation
 *
 * For any single widget API failure on the Overview page, all other widgets
 * SHALL continue to render independently — the failure of one endpoint SHALL NOT
 * cause other widgets to enter error state or trigger a full page reload.
 *
 * **Validates: Requirements 12.8, 12.9**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock useCachedQuery ─────────────────────────────────────────────────────

/**
 * We mock the useCachedQuery hook at the module level.
 * A configurable factory lets us control which endpoint returns an error
 * vs. success data per test scenario.
 */

let failingEndpoint: string | null = null;
const mockInvalidate = vi.fn();

// Mock data keyed by endpoint
const mockSuccessData: Record<string, unknown> = {
  '/api/v1/pipeline/flow': {
    stages: [
      { name: 'Pattern Scan', tokenRange: { min: 1, max: 100 }, metrics: { shortCircuitRate: 72.3 } },
      { name: 'Structural Analysis', tokenRange: { min: 100, max: 500 }, metrics: { shortCircuitRate: 15.1 } },
      { name: 'Classifier', tokenRange: { min: 500, max: 2000 }, metrics: { shortCircuitRate: 12.6 } },
    ],
    connections: [
      { from: 'Pattern Scan', to: 'Structural Analysis' },
      { from: 'Structural Analysis', to: 'Classifier' },
    ],
  },
  '/api/v1/canary/events': [
    {
      id: 'evt-1',
      timestamp: Date.now(),
      agentId: 'agent-coding-01',
      agentName: 'Coding Agent 01',
      type: 'drift',
      severity: 'warning',
      message: 'Token usage exceeded baseline by 45%',
      metric: 'token_usage',
      observed: 145,
      baseline: 100,
    },
  ],
  '/api/v1/agents/matrix': {
    agents: [
      {
        id: 'agent-1',
        name: 'Research Agent',
        status: 'active',
        requestsLastHour: 120,
        deniedLastHour: 3,
        avgLatencyMs: 250,
        provider: 'OpenAI',
        model: 'gpt-4',
      },
    ],
    totalActive: 1,
    totalIdle: 0,
    totalFrozen: 0,
  },
  '/api/v1/costs/savings': {
    totalMonthlySavings: 1240.5,
    optimizations: [
      { description: 'Switch coding-agent to gpt-3.5-turbo for simple tasks', savings: 520.0 },
      { description: 'Enable response caching for repeated queries', savings: 720.5 },
    ],
  },
  '/api/v1/routing/entries': [
    { sourceModel: 'gpt-4', targetModel: 'gpt-3.5-turbo', perRequestSavings: 0.0082 },
    { sourceModel: 'claude-3-opus', targetModel: 'claude-3-haiku', perRequestSavings: 0.0145 },
  ],
  '/api/v1/governance/protocols': [
    {
      id: 'proto-1',
      name: 'AG-UI Protocol',
      description: 'Agent-to-UI communication governance',
      mode: 'ENFORCE',
      evaluationsToday: 1500,
      denials: 12,
      status: 'active',
    },
    {
      id: 'proto-2',
      name: 'A2UI Protocol',
      description: 'Agent-to-Agent UI governance',
      mode: 'MONITOR',
      evaluationsToday: 800,
      denials: 0,
      status: 'active',
    },
  ],
};

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (options: { endpoint: string }) => {
    const { endpoint } = options;

    if (endpoint === failingEndpoint) {
      return {
        data: null,
        isLoading: false,
        error: new Error(`Request failed: 500 Internal Server Error`),
        invalidate: mockInvalidate,
      };
    }

    return {
      data: mockSuccessData[endpoint] ?? null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    };
  },
  default: vi.fn(),
}));

// Mock useAuth so panels don't need real auth context
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    authMode: 'none',
    isAuthenticated: true,
    getAuthHeaders: () => ({}),
    getWebSocketParams: () => ({}),
    login: vi.fn(),
    logout: vi.fn(),
    handleAuthError: vi.fn(),
  }),
  default: () => ({
    authMode: 'none',
    isAuthenticated: true,
    getAuthHeaders: () => ({}),
    getWebSocketParams: () => ({}),
    login: vi.fn(),
    logout: vi.fn(),
    handleAuthError: vi.fn(),
  }),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { MidDetailRow } from '@/components/MidDetailRow';
import { BottomDetailRow } from '@/components/BottomDetailRow';

// ─── Setup/Teardown ──────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  failingEndpoint = null;
  mockInvalidate.mockClear();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

// ─── Test Scenarios ──────────────────────────────────────────────────────────

describe('Property 13: Widget Error Isolation', () => {
  describe('MidDetailRow — CanaryAlertsPanel fails', () => {
    it('DefensePipelineFlow and AgentMatrixPanel still render while CanaryAlertsPanel shows error', () => {
      failingEndpoint = '/api/v1/canary/events';

      const { container } = render(<MidDetailRow />);

      // CanaryAlertsPanel should show error state
      const canaryError = screen.getByTestId('canary-alerts-error');
      expect(canaryError).toBeInTheDocument();
      expect(canaryError).toHaveTextContent('Failed to load canary alerts');

      // CanaryAlertsPanel should have a retry button
      const retryButton = screen.getByRole('button', { name: /retry loading canary alerts/i });
      expect(retryButton).toBeInTheDocument();

      // DefensePipelineFlow should render its success content
      const pipelineChart = screen.getByTestId('pipeline-flow-chart');
      expect(pipelineChart).toBeInTheDocument();

      // AgentMatrixPanel should render its success content
      const agentMatrix = screen.getByTestId('agent-matrix-panel');
      expect(agentMatrix).toBeInTheDocument();

      // Page should not have reloaded — the MidDetailRow section remains mounted
      const section = screen.getByTestId('mid-detail-row');
      expect(section).toBeInTheDocument();
      expect(container.ownerDocument.defaultView).toBeTruthy();
    });
  });

  describe('MidDetailRow — DefensePipelineFlow fails', () => {
    it('CanaryAlertsPanel and AgentMatrixPanel still render while DefensePipelineFlow shows error', () => {
      failingEndpoint = '/api/v1/pipeline/flow';

      render(<MidDetailRow />);

      // DefensePipelineFlow should show error state
      const pipelineError = screen.getByTestId('pipeline-flow-error');
      expect(pipelineError).toBeInTheDocument();
      expect(pipelineError).toHaveTextContent('Failed to load pipeline flow data');

      // CanaryAlertsPanel should render its success content
      const canaryPanel = screen.getByTestId('canary-alerts-panel');
      expect(canaryPanel).toBeInTheDocument();

      // AgentMatrixPanel should render its success content
      const agentMatrix = screen.getByTestId('agent-matrix-panel');
      expect(agentMatrix).toBeInTheDocument();
    });
  });

  describe('MidDetailRow — AgentMatrixPanel fails', () => {
    it('DefensePipelineFlow and CanaryAlertsPanel still render while AgentMatrixPanel shows error', () => {
      failingEndpoint = '/api/v1/agents/matrix';

      render(<MidDetailRow />);

      // AgentMatrixPanel should show error state
      const matrixError = screen.getByTestId('agent-matrix-error');
      expect(matrixError).toBeInTheDocument();
      expect(matrixError).toHaveTextContent('Failed to load agent matrix data');

      // DefensePipelineFlow should render its success content
      const pipelineChart = screen.getByTestId('pipeline-flow-chart');
      expect(pipelineChart).toBeInTheDocument();

      // CanaryAlertsPanel should render its success content
      const canaryPanel = screen.getByTestId('canary-alerts-panel');
      expect(canaryPanel).toBeInTheDocument();
    });
  });

  describe('BottomDetailRow — CostSavingsPanel fails', () => {
    it('ModelRoutingPanel and ProtocolGovernancePanel still render while CostSavingsPanel shows error', () => {
      failingEndpoint = '/api/v1/costs/savings';

      render(<BottomDetailRow />);

      // CostSavingsPanel should show error state
      const costError = screen.getByTestId('cost-savings-error');
      expect(costError).toBeInTheDocument();
      expect(costError).toHaveTextContent('Failed to load cost savings data');

      // ModelRoutingPanel should render its success content
      const routingPanel = screen.getByTestId('model-routing-panel');
      expect(routingPanel).toBeInTheDocument();

      // ProtocolGovernancePanel should render its success content
      const governancePanel = screen.getByTestId('protocol-governance-panel');
      expect(governancePanel).toBeInTheDocument();

      // BottomDetailRow section remains mounted (no page reload)
      const section = screen.getByTestId('bottom-detail-row');
      expect(section).toBeInTheDocument();
    });
  });

  describe('BottomDetailRow — ModelRoutingPanel fails', () => {
    it('CostSavingsPanel and ProtocolGovernancePanel still render while ModelRoutingPanel shows error', () => {
      failingEndpoint = '/api/v1/routing/entries';

      render(<BottomDetailRow />);

      // ModelRoutingPanel should show error state
      const routingError = screen.getByTestId('model-routing-error');
      expect(routingError).toBeInTheDocument();

      // CostSavingsPanel should render its success content
      const costPanel = screen.getByTestId('cost-savings-panel');
      expect(costPanel).toBeInTheDocument();

      // ProtocolGovernancePanel should render its success content
      const governancePanel = screen.getByTestId('protocol-governance-panel');
      expect(governancePanel).toBeInTheDocument();
    });
  });

  describe('BottomDetailRow — ProtocolGovernancePanel fails', () => {
    it('CostSavingsPanel and ModelRoutingPanel still render while ProtocolGovernancePanel shows error', () => {
      failingEndpoint = '/api/v1/governance/protocols';

      render(<BottomDetailRow />);

      // ProtocolGovernancePanel should show error state
      const govError = screen.getByTestId('protocol-governance-error');
      expect(govError).toBeInTheDocument();

      // CostSavingsPanel should render its success content
      const costPanel = screen.getByTestId('cost-savings-panel');
      expect(costPanel).toBeInTheDocument();

      // ModelRoutingPanel should render its success content
      const routingPanel = screen.getByTestId('model-routing-panel');
      expect(routingPanel).toBeInTheDocument();
    });
  });

  describe('No full page reload on widget error', () => {
    it('the page section elements remain mounted when one widget fails', () => {
      failingEndpoint = '/api/v1/canary/events';

      const { container } = render(
        <div data-testid="overview-page">
          <MidDetailRow />
          <BottomDetailRow />
        </div>
      );

      // The overview page wrapper is still in the DOM
      const pageWrapper = screen.getByTestId('overview-page');
      expect(pageWrapper).toBeInTheDocument();

      // Both row sections remain mounted
      expect(screen.getByTestId('mid-detail-row')).toBeInTheDocument();
      expect(screen.getByTestId('bottom-detail-row')).toBeInTheDocument();

      // The errored widget is contained within its panel, not at page level
      const canaryError = screen.getByTestId('canary-alerts-error');
      expect(pageWrapper.contains(canaryError)).toBe(true);

      // Non-errored widgets in both rows render normally
      expect(screen.getByTestId('pipeline-flow-chart')).toBeInTheDocument();
      expect(screen.getByTestId('agent-matrix-panel')).toBeInTheDocument();
      expect(screen.getByTestId('cost-savings-panel')).toBeInTheDocument();
      expect(screen.getByTestId('model-routing-panel')).toBeInTheDocument();
      expect(screen.getByTestId('protocol-governance-panel')).toBeInTheDocument();
    });
  });

  describe('Retry mechanism triggers re-fetch for only the failed widget', () => {
    it('clicking retry on CanaryAlertsPanel calls invalidate() for that widget only', () => {
      failingEndpoint = '/api/v1/canary/events';

      render(<MidDetailRow />);

      // Find the retry button in the canary alerts error state
      const retryButton = screen.getByRole('button', { name: /retry loading canary alerts/i });
      expect(retryButton).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryButton);

      // The mock invalidate function should have been called
      expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });

    it('clicking retry on AgentMatrixPanel calls invalidate() for that widget only', () => {
      failingEndpoint = '/api/v1/agents/matrix';

      render(<MidDetailRow />);

      // Find the retry button in the agent matrix error state
      const retryButton = screen.getByRole('button', { name: /retry loading agent matrix/i });
      expect(retryButton).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryButton);

      // The mock invalidate function should have been called
      expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });
  });
});
