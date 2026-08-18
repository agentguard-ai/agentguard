import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaginatedQuery } from './usePaginatedQuery';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock useAuth to return no-auth mode headers
vi.mock('./useAuth', () => ({
  useAuth: () => ({
    authMode: 'none' as const,
    isAuthenticated: true,
    getAuthHeaders: () => ({}),
    getWebSocketParams: () => ({}),
    login: () => {},
    logout: () => {},
    handleAuthError: () => {},
  }),
}));

// Mock environment variable
vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');

// ─── Test helpers ────────────────────────────────────────────────────────────

function createMockResponse<T>(results: T[], total: number, page: number, pageSize: number) {
  return {
    results,
    total,
    page,
    pageSize,
  };
}

function mockFetchSuccess<T>(results: T[], total: number, page = 1, pageSize = 25) {
  const response = createMockResponse(results, total, page, pageSize);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(response),
  });
}

function mockFetchError(status: number, statusText: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePaginatedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch data on mount and return paginated results', async () => {
    const items = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    mockFetchSuccess(items, 50);

    const { result } = renderHook(() =>
      usePaginatedQuery<{ id: string; name: string }>({
        endpoint: '/api/v1/decisions',
      }),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(items);
    expect(result.current.total).toBe(50);
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should construct URL with page, pageSize, and additional params', async () => {
    mockFetchSuccess([], 0);

    renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
        params: { action: 'blocked', agentId: 'agent-1' },
        pageSize: 50,
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const url = new URL(calledUrl);

    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('50');
    expect(url.searchParams.get('action')).toBe('blocked');
    expect(url.searchParams.get('agentId')).toBe('agent-1');
  });

  it('should skip undefined params', async () => {
    mockFetchSuccess([], 0);

    renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
        params: { action: 'allowed', empty: undefined },
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const url = new URL(calledUrl);

    expect(url.searchParams.get('action')).toBe('allowed');
    expect(url.searchParams.has('empty')).toBe(false);
  });

  it('should not fetch when enabled is false', async () => {
    global.fetch = vi.fn();

    const { result } = renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
        enabled: false,
      }),
    );

    // Wait a tick to ensure useEffect has run
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('should handle HTTP errors', async () => {
    mockFetchError(500, 'Internal Server Error');

    const { result } = renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toContain('500');
    expect(result.current.data).toEqual([]);
  });

  it('should navigate to next page', async () => {
    mockFetchSuccess([{ id: '1' }], 75);

    const { result } = renderHook(() =>
      usePaginatedQuery<{ id: string }>({
        endpoint: '/api/v1/decisions',
        pageSize: 25,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(2);
  });

  it('should navigate to previous page', async () => {
    mockFetchSuccess([{ id: '1' }], 75);

    const { result } = renderHook(() =>
      usePaginatedQuery<{ id: string }>({
        endpoint: '/api/v1/decisions',
        pageSize: 25,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Go to page 2 first
    act(() => {
      result.current.goToPage(2);
    });

    expect(result.current.page).toBe(2);
    expect(result.current.hasPrevPage).toBe(true);

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.page).toBe(1);
  });

  it('should not go below page 1 on prevPage', async () => {
    mockFetchSuccess([], 10);

    const { result } = renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.page).toBe(1);
  });

  it('should not exceed total pages on nextPage', async () => {
    mockFetchSuccess([{ id: '1' }], 25);

    const { result } = renderHook(() =>
      usePaginatedQuery<{ id: string }>({
        endpoint: '/api/v1/decisions',
        pageSize: 25,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // totalPages = 1, so nextPage should be a no-op
    expect(result.current.hasNextPage).toBe(false);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(1);
  });

  it('should clamp goToPage within valid range', async () => {
    mockFetchSuccess([], 100);

    const { result } = renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
        pageSize: 25,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // totalPages = 4
    act(() => {
      result.current.goToPage(10);
    });

    expect(result.current.page).toBe(4);

    act(() => {
      result.current.goToPage(0);
    });

    expect(result.current.page).toBe(1);

    act(() => {
      result.current.goToPage(-5);
    });

    expect(result.current.page).toBe(1);
  });

  it('should trigger a refresh when refresh() is called', async () => {
    mockFetchSuccess([{ id: '1' }], 10);

    const { result } = renderHook(() =>
      usePaginatedQuery<{ id: string }>({
        endpoint: '/api/v1/decisions',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const fetchCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(fetchCallCount);
    });
  });

  it('should reset to page 1 when endpoint changes', async () => {
    mockFetchSuccess([], 100);

    const { result, rerender } = renderHook(
      (props: { endpoint: string }) =>
        usePaginatedQuery({
          endpoint: props.endpoint,
          pageSize: 25,
        }),
      { initialProps: { endpoint: '/api/v1/decisions' } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Go to page 3
    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.page).toBe(3);

    // Change endpoint
    rerender({ endpoint: '/api/v1/audit/events' });

    expect(result.current.page).toBe(1);
  });

  it('should compute totalPages correctly for various totals', async () => {
    // 0 records → 1 page minimum
    mockFetchSuccess([], 0);

    const { result, rerender } = renderHook(
      (props: { endpoint: string }) =>
        usePaginatedQuery({
          endpoint: props.endpoint,
          pageSize: 25,
        }),
      { initialProps: { endpoint: '/api/v1/test' } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalPages).toBe(1);
  });

  it('should support all valid page sizes', async () => {
    for (const size of [25, 50, 100] as const) {
      mockFetchSuccess([], 200);

      const { result } = renderHook(() =>
        usePaginatedQuery({
          endpoint: '/api/v1/decisions',
          pageSize: size,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pageSize).toBe(size);
      expect(result.current.totalPages).toBe(Math.ceil(200 / size));
    }
  });

  it('should use default pageSize of 25 when not specified', async () => {
    mockFetchSuccess([], 50);

    const { result } = renderHook(() =>
      usePaginatedQuery({
        endpoint: '/api/v1/decisions',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pageSize).toBe(25);
  });
});
