import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { CanaryAlertsPanel, SeverityIndicator } from './CanaryAlertsPanel';
import type { CanaryEvent } from './CanaryAlertsPanel';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockCanaryEvents: CanaryEvent[] = [
  {
    id: 'canary-001',
    timestamp: 1700003600000,
    agentId: 'agent-coding-03',
    agentName: 'Coding Agent',
    type: 'drift',
    severity: 'warning',
    message: 'Token usage 2.3x above baseline',
    metric: 'token_count',
    observed: 4800,
    baseline: 2100,
  },
  {
    id: 'canary-002',
    timestamp: 1700000000000,
    agentId: 'agent-research-01',
    type: 'anomaly',
    severity: 'info',
    message: 'Unusual tool invocation pattern detected',
    metric: 'tool_calls',
    observed: 12,
    baseline: 4,
  },
  {
    id: 'canary-003',
    timestamp: 1700007200000,
    agentId: 'agent-ops-06',
    agentName: 'DevOps Agent',
    type: 'freeze_trigger',
    severity: 'critical',
    message: 'Cost velocity exceeded kill threshold — agent frozen',
    metric: 'cost_velocity',
    observed: 15.2,
    baseline: 3.1,
  },
];

// ─── Setup ───────────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  vi.clearAllMocks();
});

// ─── Tests: SeverityIndicator ────────────────────────────────────────────────

describe('SeverityIndicator', () => {
  it('renders red "Frozen" for critical severity', () => {
    render(<SeverityIndicator severity="critical" type="freeze_trigger" />);

    const indicator = screen.getByTestId('severity-frozen');
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText('Frozen')).toBeInTheDocument();
    expect(indicator).toHaveAttribute('aria-label', 'Severity: Frozen');
  });

  it('renders red "Frozen" for freeze_trigger type regardless of severity', () => {
    render(<SeverityIndicator severity="warning" type="freeze_trigger" />);

    expect(screen.getByTestId('severity-frozen')).toBeInTheDocument();
    expect(screen.getByText('Frozen')).toBeInTheDocument();
  });

  it('renders orange "Warning" for warning severity', () => {
    render(<SeverityIndicator severity="warning" type="drift" />);

    const indicator = screen.getByTestId('severity-warning');
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(indicator).toHaveAttribute('aria-label', 'Severity: Warning');
  });

  it('renders gray "Info" for info severity', () => {
    render(<SeverityIndicator severity="info" type="anomaly" />);

    const indicator = screen.getByTestId('severity-info');
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(indicator).toHaveAttribute('aria-label', 'Severity: Info');
  });

  it('uses red color styling for frozen indicator', () => {
    render(<SeverityIndicator severity="critical" type="freeze_trigger" />);

    const indicator = screen.getByTestId('severity-frozen');
    expect(indicator.className).toContain('red-500');
  });

  it('uses orange color styling for warning indicator', () => {
    render(<SeverityIndicator severity="warning" type="drift" />);

    const indicator = screen.getByTestId('severity-warning');
    expect(indicator.className).toContain('orange-500');
  });

  it('includes an SVG icon alongside text (non-color indicator)', () => {
    const { container } = render(<SeverityIndicator severity="critical" type="freeze_trigger" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ─── Tests: CanaryAlertsPanel ────────────────────────────────────────────────

describe('CanaryAlertsPanel', () => {
  it('renders loading state with skeleton loader', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByTestId('canary-alerts-loading')).toBeInTheDocument();
    expect(screen.getByText('Canary Alerts')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading table' })).toBeInTheDocument();
  });

  it('renders error state with retry button when fetch fails', () => {
    const mockInvalidate = vi.fn();
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: mockInvalidate,
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByTestId('canary-alerts-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load canary alerts')).toBeInTheDocument();
    expect(screen.getByText('Endpoint: /api/v1/canary/events')).toBeInTheDocument();

    // Retry button
    const retryButton = screen.getByRole('button', { name: 'Retry loading canary alerts' });
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when data is empty array', () => {
    mockUseCachedQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByTestId('canary-alerts-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No canary alerts have been triggered/)).toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByTestId('canary-alerts-empty')).toBeInTheDocument();
  });

  it('renders all canary events when data is available', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByTestId('canary-alerts-panel')).toBeInTheDocument();

    const items = screen.getAllByTestId('canary-event-item');
    expect(items).toHaveLength(3);
  });

  it('sorts events by timestamp descending (most recent first)', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const agentNames = screen.getAllByTestId('canary-event-agent');
    // canary-003 (ts: 1700007200000) > canary-001 (ts: 1700003600000) > canary-002 (ts: 1700000000000)
    expect(agentNames[0]).toHaveTextContent('DevOps Agent');
    expect(agentNames[1]).toHaveTextContent('Coding Agent');
  });

  it('limits display to 50 items', () => {
    // Generate 60 events
    const manyEvents: CanaryEvent[] = Array.from({ length: 60 }, (_, i) => ({
      id: `canary-${i}`,
      timestamp: 1700000000000 + i * 1000,
      agentId: `agent-test-${i}`,
      type: 'drift' as const,
      severity: 'warning' as const,
      message: `Test event ${i}`,
      metric: 'test_metric',
      observed: 10,
      baseline: 5,
    }));

    mockUseCachedQuery.mockReturnValue({
      data: manyEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const items = screen.getAllByTestId('canary-event-item');
    expect(items).toHaveLength(50);
  });

  it('displays agent name for each event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByText('Coding Agent')).toBeInTheDocument();
    expect(screen.getByText('DevOps Agent')).toBeInTheDocument();
  });

  it('derives agent name from agentId when agentName is not provided', () => {
    mockUseCachedQuery.mockReturnValue({
      data: [mockCanaryEvents[1]], // agent-research-01, no agentName
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    // "agent-research-01" → "Research 01"
    expect(screen.getByText('Research 01')).toBeInTheDocument();
  });

  it('displays canary type for each event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const typeElements = screen.getAllByTestId('canary-event-type');
    expect(typeElements).toHaveLength(3);
    expect(typeElements[0]).toHaveTextContent('Freeze Trigger'); // first by timestamp desc
  });

  it('displays action (message) for each event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: [mockCanaryEvents[0]],
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByText('Token usage 2.3x above baseline')).toBeInTheDocument();
  });

  it('displays deviation percentage for each event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: [mockCanaryEvents[0]], // observed: 4800, baseline: 2100
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const deviation = screen.getByTestId('canary-event-deviation');
    // (4800 - 2100) / 2100 * 100 = 128.6%
    expect(deviation).toHaveTextContent('+128.6%');
  });

  it('displays timestamp for each event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const timestamps = screen.getAllByTestId('canary-event-timestamp');
    expect(timestamps).toHaveLength(3);
  });

  it('displays correct severity indicators', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    // 1 critical/freeze_trigger → Frozen, 1 warning → Warning, 1 info → Info
    expect(screen.getByTestId('severity-frozen')).toBeInTheDocument();
    expect(screen.getByTestId('severity-warning')).toBeInTheDocument();
    expect(screen.getByTestId('severity-info')).toBeInTheDocument();
  });

  it('displays event count in header', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByText('3 events')).toBeInTheDocument();
  });

  it('uses singular "event" for single event', () => {
    mockUseCachedQuery.mockReturnValue({
      data: [mockCanaryEvents[0]],
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByText('1 event')).toBeInTheDocument();
  });

  it('passes correct endpoint to useCachedQuery', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(mockUseCachedQuery).toHaveBeenCalledWith({
      endpoint: '/api/v1/canary/events',
    });
  });

  it('has aria-label describing panel content', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    const panel = screen.getByTestId('canary-alerts-panel');
    expect(panel).toHaveAttribute('aria-label', 'Canary Alerts: 3 triggered events');
  });

  it('renders an accessible list of events', () => {
    mockUseCachedQuery.mockReturnValue({
      data: mockCanaryEvents,
      isLoading: false,
      error: null,
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByRole('list', { name: 'Canary events list' })).toBeInTheDocument();
  });

  it('error state has role="alert" for accessibility', () => {
    mockUseCachedQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      invalidate: vi.fn(),
    });

    render(<CanaryAlertsPanel />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('is wrapped in PanelErrorBoundary', () => {
    // Force a render error to check error boundary catches it
    mockUseCachedQuery.mockImplementation(() => {
      throw new Error('Hook crash');
    });

    render(<CanaryAlertsPanel />);

    // Should show error boundary fallback, not crash
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('Canary Alerts')).toBeInTheDocument();
  });
});


// ─── Property-Based Tests: Sorting and Bounding ─────────────────────────────

// Feature: dashboard-overview-redesign, Property 7: Canary Events Sorted and Bounded
// **Validates: Requirements 6.1**

const canaryEventArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  timestamp: fc.nat(2000000000000),
  agentId: fc.string({ minLength: 1, maxLength: 20 }),
  agentName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  type: fc.constantFrom('drift' as const, 'anomaly' as const, 'freeze_trigger' as const),
  severity: fc.constantFrom('info' as const, 'warning' as const, 'critical' as const),
  message: fc.string({ minLength: 1, maxLength: 50 }),
  metric: fc.string({ minLength: 1, maxLength: 20 }),
  observed: fc.float({ min: 0, max: 1000, noNaN: true }),
  baseline: fc.float({ min: Math.fround(0.1), max: 1000, noNaN: true }),
});

/**
 * This tests the same sorting/slicing logic used in CanaryAlertsPanelContent:
 *   [...data].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
 */
function sortAndBoundCanaryEvents(events: CanaryEvent[]): CanaryEvent[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
}

describe('CanaryAlertsPanel (property-based)', () => {
  it('events are always sorted by timestamp descending (most recent first)', () => {
    fc.assert(
      fc.property(
        fc.array(canaryEventArb, { minLength: 0, maxLength: 100 }),
        (events) => {
          const result = sortAndBoundCanaryEvents(events);

          // Verify sorted descending: each timestamp >= next
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i + 1].timestamp);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is bounded to at most 50 items', () => {
    fc.assert(
      fc.property(
        fc.array(canaryEventArb, { minLength: 0, maxLength: 100 }),
        (events) => {
          const result = sortAndBoundCanaryEvents(events);
          expect(result.length).toBeLessThanOrEqual(50);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result length is min(input.length, 50)', () => {
    fc.assert(
      fc.property(
        fc.array(canaryEventArb, { minLength: 0, maxLength: 100 }),
        (events) => {
          const result = sortAndBoundCanaryEvents(events);
          expect(result.length).toBe(Math.min(events.length, 50));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all returned events exist in the original input', () => {
    fc.assert(
      fc.property(
        fc.array(canaryEventArb, { minLength: 0, maxLength: 100 }),
        (events) => {
          const result = sortAndBoundCanaryEvents(events);
          for (const event of result) {
            expect(events).toContainEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
