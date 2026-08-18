import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, within, cleanup } from '@testing-library/react';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { AgentMatrixPanel } from './AgentMatrixPanel';
import type { Agent, AgentMatrixResponse } from './AgentMatrixPanel';
import { formatCount, formatLatency } from '@/utils/formatters';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Generate printable strings safe for DOM text matching.
// Avoid whitespace-only, multi-space sequences, and purely numeric strings
// to prevent collisions with formatted counts/latency values.
const textArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_\-]{1,18}[A-Za-z]$/);

const agentArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: textArb,
  status: fc.constantFrom('active', 'idle', 'frozen') as fc.Arbitrary<'active' | 'idle' | 'frozen'>,
  requestsLastHour: fc.nat(10000),
  deniedLastHour: fc.nat(1000),
  avgLatencyMs: fc.float({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
  provider: textArb,
  model: textArb,
});

// ─── Setup ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('AgentMatrixPanel (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 9: Agent Matrix Row Completeness
  // **Validates: Requirements 7.1**
  it('for any valid agent, the row displays all required fields: name, provider, model, requests/hr, denied/hr, latency with "ms" suffix, and status badge with text label and icon', () => {
    fc.assert(
      fc.property(agentArb, (agent: Agent) => {
        // Clean up any previous render
        cleanup();

        const response: AgentMatrixResponse = {
          agents: [agent],
          totalActive: agent.status === 'active' ? 1 : 0,
          totalIdle: agent.status === 'idle' ? 1 : 0,
          totalFrozen: agent.status === 'frozen' ? 1 : 0,
        };

        mockUseCachedQuery.mockReturnValue({
          data: response,
          isLoading: false,
          error: null,
          invalidate: vi.fn(),
        });

        const { container } = render(<AgentMatrixPanel />);

        // Scope all queries to this render's container
        const view = within(container);

        // Find the single agent row
        const row = view.getByTestId('agent-row');

        // Agent name is displayed in the row
        expect(row).toHaveTextContent(agent.name);

        // Provider is displayed in the row
        expect(row).toHaveTextContent(agent.provider);

        // Model is displayed in the row
        expect(row).toHaveTextContent(agent.model);

        // Requests/hr formatted with comma separators
        const expectedRequests = formatCount(agent.requestsLastHour);
        expect(row).toHaveTextContent(expectedRequests);

        // Denied/hr formatted with comma separators
        const expectedDenied = formatCount(agent.deniedLastHour);
        expect(row).toHaveTextContent(expectedDenied);

        // Latency with "ms" suffix
        const expectedLatency = formatLatency(agent.avgLatencyMs);
        expect(row).toHaveTextContent(expectedLatency);
        expect(expectedLatency).toMatch(/^\d+ms$/);

        // Status badge with text label and SVG icon
        const statusBadge = within(row).getByTestId(`status-${agent.status}`);
        expect(statusBadge).toBeInTheDocument();
        expect(statusBadge).toHaveTextContent(agent.status);
        expect(statusBadge.querySelector('svg')).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
