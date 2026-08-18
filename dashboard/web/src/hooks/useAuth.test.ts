/**
 * Unit tests for the useAuth hook.
 *
 * Validates authentication modes: none, api-key, and oauth2.
 * Tests header injection, token refresh behavior, and 401/403 redirect handling.
 *
 * Requirements: 1.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Store original env
const originalEnv = process.env;

// Mock window.location
const mockLocationHref = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  // Reset env
  vi.resetModules();
  process.env = { ...originalEnv };

  // Clear localStorage
  localStorage.clear();

  // Mock window.location (for OAuth2 redirect testing)
  const locationMock = {
    ...originalLocation,
    origin: 'http://localhost:3000',
  };
  Object.defineProperty(locationMock, 'href', {
    get() {
      return 'http://localhost:3000/dashboard';
    },
    set(url: string) {
      mockLocationHref(url);
    },
    configurable: true,
  });
  Object.defineProperty(window, 'location', {
    value: locationMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = originalEnv;
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('useAuth', () => {
  describe('mode: none (no-auth passthrough)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_MODE = 'none';
    });

    it('returns authMode as none', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.authMode).toBe('none');
    });

    it('is always authenticated in no-auth mode', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('getAuthHeaders returns empty object (no credentials injected)', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.getAuthHeaders()).toEqual({});
    });

    it('getWebSocketParams returns empty object', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.getWebSocketParams()).toEqual({});
    });

    it('handleAuthError does nothing for 401/403 in no-auth mode', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.handleAuthError(401);
      });
      // Should remain authenticated
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('login is a no-op and remains authenticated', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.login();
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('logout is a no-op in no-auth mode', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.logout();
      });
      // In no-auth mode logout doesn't change auth state
      expect(result.current.authMode).toBe('none');
    });
  });

  describe('mode: api-key', () => {
    const TEST_API_KEY = 'my-secret-dashboard-key-456';

    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_MODE = 'api-key';
    });

    it('returns authMode as api-key', () => {
      process.env.NEXT_PUBLIC_DASHBOARD_API_KEY = TEST_API_KEY;
      const { result } = renderHook(() => useAuth());
      expect(result.current.authMode).toBe('api-key');
    });

    it('is authenticated when API key is available from env', () => {
      process.env.NEXT_PUBLIC_DASHBOARD_API_KEY = TEST_API_KEY;
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('is authenticated when API key is stored in localStorage', () => {
      localStorage.setItem('tealtiger_dashboard_api_key', TEST_API_KEY);
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('is not authenticated when no API key is available', () => {
      // No env key, no localStorage key
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('getAuthHeaders injects X-Dashboard-Key header with the API key', () => {
      process.env.NEXT_PUBLIC_DASHBOARD_API_KEY = TEST_API_KEY;
      const { result } = renderHook(() => useAuth());
      expect(result.current.getAuthHeaders()).toEqual({
        'X-Dashboard-Key': TEST_API_KEY,
      });
    });

    it('getAuthHeaders returns empty object when no key is stored', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.getAuthHeaders()).toEqual({});
    });

    it('getWebSocketParams returns X-Dashboard-Key for WebSocket auth', () => {
      process.env.NEXT_PUBLIC_DASHBOARD_API_KEY = TEST_API_KEY;
      const { result } = renderHook(() => useAuth());
      expect(result.current.getWebSocketParams()).toEqual({
        'X-Dashboard-Key': TEST_API_KEY,
      });
    });

    it('handleAuthError on 401 clears API key and marks unauthenticated', () => {
      localStorage.setItem('tealtiger_dashboard_api_key', TEST_API_KEY);
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.handleAuthError(401);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_api_key')).toBeNull();
    });

    it('handleAuthError on 403 clears API key and marks unauthenticated', () => {
      localStorage.setItem('tealtiger_dashboard_api_key', TEST_API_KEY);
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.handleAuthError(403);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_api_key')).toBeNull();
    });

    it('handleAuthError ignores non-401/403 status codes', () => {
      localStorage.setItem('tealtiger_dashboard_api_key', TEST_API_KEY);
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.handleAuthError(500);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem('tealtiger_dashboard_api_key')).toBe(TEST_API_KEY);
    });

    it('logout clears API key from localStorage', () => {
      localStorage.setItem('tealtiger_dashboard_api_key', TEST_API_KEY);
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_api_key')).toBeNull();
    });
  });

  describe('mode: oauth2', () => {
    const OAUTH2_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
    const REFRESH_TOKEN = 'refresh-token-xyz';
    const ISSUER = 'https://auth.example.com';
    const CLIENT_ID = 'dashboard-client-id';

    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_MODE = 'oauth2';
      process.env.NEXT_PUBLIC_OAUTH2_ISSUER = ISSUER;
      process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID = CLIENT_ID;
    });

    it('returns authMode as oauth2', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.authMode).toBe('oauth2');
    });

    it('is authenticated when valid token is stored and not expired', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      // Set expiry 1 hour from now
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('is not authenticated when no token is stored', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('is not authenticated when token is expired', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      // Expired 1 hour ago
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() - 3600_000),
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('getAuthHeaders returns Bearer token header', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.getAuthHeaders()).toEqual({
        Authorization: `Bearer ${OAUTH2_TOKEN}`,
      });
    });

    it('getAuthHeaders returns empty object when no token is stored', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.getAuthHeaders()).toEqual({});
    });

    it('getWebSocketParams returns Authorization header for WebSocket', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.getWebSocketParams()).toEqual({
        Authorization: `Bearer ${OAUTH2_TOKEN}`,
      });
    });

    it('handleAuthError on 401 clears tokens and marks unauthenticated', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.handleAuthError(401);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBeNull();
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_refresh_token')).toBeNull();
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_expiry')).toBeNull();
    });

    it('handleAuthError on 403 clears tokens and redirects to login', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.handleAuthError(403);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBeNull();
      // Verify redirect was attempted (OAuth2 redirects to login on 401/403)
      expect(mockLocationHref).toHaveBeenCalled();
      const redirectUrl = mockLocationHref.mock.calls[0][0];
      expect(redirectUrl).toContain(ISSUER);
      expect(redirectUrl).toContain('client_id=' + CLIENT_ID);
    });

    it('handleAuthError ignores non-401/403 status codes', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.handleAuthError(500);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBe(OAUTH2_TOKEN);
    });

    it('login redirects to OAuth2 authorization endpoint', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.login();
      });

      expect(mockLocationHref).toHaveBeenCalled();
      const redirectUrl = mockLocationHref.mock.calls[0][0];
      expect(redirectUrl).toContain(`${ISSUER}/authorize`);
      expect(redirectUrl).toContain(`client_id=${CLIENT_ID}`);
      expect(redirectUrl).toContain('response_type=code');
      expect(redirectUrl).toContain('redirect_uri=');
    });

    it('logout clears all OAuth2 tokens from localStorage', () => {
      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 3600_000),
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBeNull();
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_refresh_token')).toBeNull();
      expect(localStorage.getItem('tealtiger_dashboard_oauth2_expiry')).toBeNull();
    });

    it('token refresh is triggered when token is near expiry', async () => {
      // Mock fetch for token refresh
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });
      global.fetch = mockFetch;

      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      // Token expires in 30 seconds (within the 60-second "near expiry" window)
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() + 30_000),
      );

      renderHook(() => useAuth());

      // Wait for the useEffect to run the token refresh
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${ISSUER}/token`,
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );
      });

      // Verify new token was stored
      await vi.waitFor(() => {
        expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBe('new-access-token');
      });
    });

    it('redirects to login when token refresh fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });
      global.fetch = mockFetch;

      localStorage.setItem('tealtiger_dashboard_oauth2_token', OAUTH2_TOKEN);
      localStorage.setItem('tealtiger_dashboard_oauth2_refresh_token', REFRESH_TOKEN);
      // Token expired (triggers refresh)
      localStorage.setItem(
        'tealtiger_dashboard_oauth2_expiry',
        String(Date.now() - 1000),
      );

      const { result } = renderHook(() => useAuth());

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // After failed refresh, tokens are cleared and redirect happens
      await vi.waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(localStorage.getItem('tealtiger_dashboard_oauth2_token')).toBeNull();
      expect(mockLocationHref).toHaveBeenCalled();
    });
  });

  describe('defaults', () => {
    it('defaults to none mode when NEXT_PUBLIC_AUTH_MODE is not set', () => {
      delete process.env.NEXT_PUBLIC_AUTH_MODE;
      const { result } = renderHook(() => useAuth());
      expect(result.current.authMode).toBe('none');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('defaults to none mode when NEXT_PUBLIC_AUTH_MODE has invalid value', () => {
      process.env.NEXT_PUBLIC_AUTH_MODE = 'invalid-mode';
      const { result } = renderHook(() => useAuth());
      expect(result.current.authMode).toBe('none');
    });
  });
});
