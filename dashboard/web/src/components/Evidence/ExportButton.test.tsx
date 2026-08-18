import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportButton } from './ExportButton';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    getAuthHeaders: () => ({ 'X-Dashboard-Key': 'test-key' }),
    handleAuthError: vi.fn(),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockResponse(ok: boolean, body?: unknown, status = 200): Response {
  const blob = new Blob([JSON.stringify(body || {})], { type: 'application/json' });
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    blob: () => Promise.resolve(blob),
    text: () => Promise.resolve(JSON.stringify(body || {})),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    json: () => Promise.resolve(body),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ExportButton', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
    mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the "Export Evidence Pack" button', () => {
    render(<ExportButton correlationId="test-123" />);
    expect(screen.getByRole('button', { name: /export evidence pack/i })).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<ExportButton correlationId="test-123" />);
    expect(screen.getByLabelText('Export Evidence Pack')).toBeInTheDocument();
  });

  it('triggers download on successful export', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(true, { correlationId: 'test-123' }));

    render(<ExportButton correlationId="test-123" />);

    // Set up DOM mocks after render so React rendering isn't affected
    const mockLink = { href: '', download: '', click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(mockLink.click).toHaveBeenCalled();
    });

    expect(mockLink.download).toBe('teec-evidence-test-123.json');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/decisions/test-123/evidence/export'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('shows "Exporting…" text while fetching', async () => {
    // Never resolve the fetch — keeps in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ExportButton correlationId="test-123" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByText('Exporting…')).toBeInTheDocument();
    });
  });

  it('disables the button while exporting', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ExportButton correlationId="test-123" />);
    const button = screen.getByRole('button', { name: /export evidence pack/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it('displays error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(false, { message: 'Decision not found' }, 404),
    );

    render(<ExportButton correlationId="test-404" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    expect(screen.getByText('Decision not found')).toBeInTheDocument();
  });

  it('displays error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ExportButton correlationId="test-net" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('provides a "Retry" button on failure', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(false, { message: 'Server error' }, 500),
    );

    render(<ExportButton correlationId="test-retry" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry export/i })).toBeInTheDocument();
    });
  });

  it('retries export when "Retry" is clicked', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce(
      createMockResponse(false, { message: 'Temporary error' }, 500),
    );

    render(<ExportButton correlationId="test-retry2" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry export/i })).toBeInTheDocument();
    });

    // Second call succeeds
    const mockLink = { href: '', download: '', click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    mockFetch.mockResolvedValueOnce(createMockResponse(true, { correlationId: 'test-retry2' }));

    fireEvent.click(screen.getByRole('button', { name: /retry export/i }));

    await waitFor(() => {
      expect(mockLink.click).toHaveBeenCalled();
    });

    // Error should be cleared after successful retry
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears error state when export succeeds after failure', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(false, { message: 'Failure' }, 500),
    );

    render(<ExportButton correlationId="test-clear" />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Now retry succeeds
    const mockLink = { href: '', download: '', click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    mockFetch.mockResolvedValueOnce(createMockResponse(true, {}));

    fireEvent.click(screen.getByRole('button', { name: /retry export/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('includes auth headers in the fetch request', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(true, {}));

    render(<ExportButton correlationId="test-auth" />);

    // Set up DOM mocks after render so React rendering isn't affected
    const mockLink = { href: '', download: '', click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    fireEvent.click(screen.getByRole('button', { name: /export evidence pack/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Dashboard-Key': 'test-key' }),
        }),
      );
    });
  });
});
