import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderBar, NotificationBadge } from './HeaderBar';

// ─── Mock Hooks ──────────────────────────────────────────────────────────────

vi.mock('@/hooks/useTimeRange', () => ({
  useTimeRange: vi.fn(),
  PRESET_LABELS: {
    '1h': 'Last 1h',
    '24h': 'Last 24h',
    '7d': 'Last 7d',
    'custom': 'Custom',
  },
}));

vi.mock('@/hooks/useDataStream', () => ({
  useDataStream: vi.fn(),
}));

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: vi.fn(),
}));

vi.mock('@/components/ConnectionStatusIndicator', () => ({
  ConnectionStatusIndicator: ({ status }: { status: string }) => (
    <div data-testid="connection-status-indicator" data-status={status}>
      {status}
    </div>
  ),
}));

import { useTimeRange } from '@/hooks/useTimeRange';
import { useDataStream } from '@/hooks/useDataStream';
import { useCachedQuery } from '@/hooks/useCachedQuery';

const mockUseTimeRange = vi.mocked(useTimeRange);
const mockUseDataStream = vi.mocked(useDataStream);
const mockUseCachedQuery = vi.mocked(useCachedQuery);

// ─── Test Setup ──────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  mockUseTimeRange.mockReturnValue({
    preset: '1h',
    timeRange: { start: Date.now() - 3600000, end: Date.now() },
    setPreset: vi.fn(),
    setCustomRange: vi.fn(),
  });

  mockUseDataStream.mockReturnValue({
    status: 'connected',
    lastEvent: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  });

  // Mock useCachedQuery to return different data based on the endpoint
  mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
    if (options.endpoint === '/api/v1/agents/active') {
      return { data: { count: 5 }, isLoading: false, error: null, invalidate: vi.fn() };
    }
    if (options.endpoint === '/api/v1/alerts/counts') {
      return { data: { warning: 3, critical: 1 }, isLoading: false, error: null, invalidate: vi.fn() };
    }
    return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationBadge', () => {
  it('renders nothing when count is zero', () => {
    const { container } = render(<NotificationBadge level="warning" count={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when count is negative', () => {
    const { container } = render(<NotificationBadge level="critical" count={-1} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders warning badge with correct count', () => {
    render(<NotificationBadge level="warning" count={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '7 warning alerts'
    );
  });

  it('renders critical badge with correct count', () => {
    render(<NotificationBadge level="critical" count={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '2 critical alerts'
    );
  });

  it('renders singular label for count of 1', () => {
    render(<NotificationBadge level="critical" count={1} />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '1 critical alert'
    );
  });

  it('applies amber background for warning level', () => {
    render(<NotificationBadge level="warning" count={3} />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('bg-amber-500');
  });

  it('applies red background for critical level', () => {
    render(<NotificationBadge level="critical" count={3} />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('bg-red-500');
  });
});

describe('HeaderBar', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Title and Subtitle', () => {
    it('renders the title as a heading', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Overview');
    });

    it('composes subtitle from time range, agent count, and status', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByText('Last 1h · 5 active agents · System operational')).toBeInTheDocument();
    });

    it('uses subtitle override when provided', () => {
      render(<HeaderBar title="Overview" subtitle="Custom subtitle text" />);
      expect(screen.getByText('Custom subtitle text')).toBeInTheDocument();
    });

    it('shows singular agent text for count of 1', () => {
      mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
        if (options.endpoint === '/api/v1/agents/active') {
          return { data: { count: 1 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        if (options.endpoint === '/api/v1/alerts/counts') {
          return { data: { warning: 0, critical: 0 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText('Last 1h · 1 active agent · System operational')).toBeInTheDocument();
    });

    it('shows "Reconnecting..." status when stream is reconnecting', () => {
      mockUseDataStream.mockReturnValue({
        status: 'reconnecting',
        lastEvent: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText(/Reconnecting\.\.\./)).toBeInTheDocument();
    });

    it('shows "Disconnected" status when stream is disconnected', () => {
      mockUseDataStream.mockReturnValue({
        status: 'disconnected',
        lastEvent: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText(/Disconnected/)).toBeInTheDocument();
    });

    it('handles zero active agents gracefully', () => {
      mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
        if (options.endpoint === '/api/v1/agents/active') {
          return { data: { count: 0 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        if (options.endpoint === '/api/v1/alerts/counts') {
          return { data: { warning: 0, critical: 0 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText('Last 1h · 0 active agents · System operational')).toBeInTheDocument();
    });

    it('handles null agent data (loading state)', () => {
      mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
        if (options.endpoint === '/api/v1/agents/active') {
          return { data: null, isLoading: true, error: null, invalidate: vi.fn() };
        }
        if (options.endpoint === '/api/v1/alerts/counts') {
          return { data: null, isLoading: true, error: null, invalidate: vi.fn() };
        }
        return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
      });

      render(<HeaderBar title="Overview" />);
      // Falls back to 0 agents when data is null
      expect(screen.getByText('Last 1h · 0 active agents · System operational')).toBeInTheDocument();
    });
  });

  describe('Notification Badges', () => {
    it('renders warning badge when warning count > 0', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByLabelText('3 warning alerts')).toBeInTheDocument();
    });

    it('renders critical badge when critical count > 0', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByLabelText('1 critical alert')).toBeInTheDocument();
    });

    it('hides badges when counts are zero', () => {
      mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
        if (options.endpoint === '/api/v1/agents/active') {
          return { data: { count: 5 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        if (options.endpoint === '/api/v1/alerts/counts') {
          return { data: { warning: 0, critical: 0 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.queryByLabelText(/warning alert/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/critical alert/)).not.toBeInTheDocument();
    });

    it('hides badges when alert data is null (loading)', () => {
      mockUseCachedQuery.mockImplementation((options: { endpoint: string }) => {
        if (options.endpoint === '/api/v1/agents/active') {
          return { data: { count: 5 }, isLoading: false, error: null, invalidate: vi.fn() };
        }
        if (options.endpoint === '/api/v1/alerts/counts') {
          return { data: null, isLoading: true, error: null, invalidate: vi.fn() };
        }
        return { data: null, isLoading: false, error: null, invalidate: vi.fn() };
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.queryByLabelText(/warning alert/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/critical alert/)).not.toBeInTheDocument();
    });
  });

  describe('ConnectionStatusIndicator', () => {
    it('renders the ConnectionStatusIndicator component', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByTestId('connection-status-indicator')).toBeInTheDocument();
    });

    it('passes connection status to the indicator', () => {
      mockUseDataStream.mockReturnValue({
        status: 'reconnecting',
        lastEvent: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByTestId('connection-status-indicator')).toHaveAttribute(
        'data-status',
        'reconnecting'
      );
    });
  });

  describe('Accessibility', () => {
    it('has banner ARIA landmark role', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('has accessible label on the header', () => {
      render(<HeaderBar title="Overview" />);
      expect(screen.getByRole('banner')).toHaveAttribute('aria-label', 'Dashboard header');
    });

    it('renders title as h1 heading', () => {
      render(<HeaderBar title="Security Monitor" />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Security Monitor');
    });
  });

  describe('Time range presets', () => {
    it('displays 24h time range in subtitle', () => {
      mockUseTimeRange.mockReturnValue({
        preset: '24h',
        timeRange: { start: Date.now() - 86400000, end: Date.now() },
        setPreset: vi.fn(),
        setCustomRange: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText(/Last 24h/)).toBeInTheDocument();
    });

    it('displays 7d time range in subtitle', () => {
      mockUseTimeRange.mockReturnValue({
        preset: '7d',
        timeRange: { start: Date.now() - 604800000, end: Date.now() },
        setPreset: vi.fn(),
        setCustomRange: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText(/Last 7d/)).toBeInTheDocument();
    });

    it('displays Custom time range in subtitle', () => {
      mockUseTimeRange.mockReturnValue({
        preset: 'custom',
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        setPreset: vi.fn(),
        setCustomRange: vi.fn(),
      });

      render(<HeaderBar title="Overview" />);
      expect(screen.getByText(/Custom/)).toBeInTheDocument();
    });
  });
});
