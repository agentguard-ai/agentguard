'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthMode = 'none' | 'api-key' | 'oauth2';

export interface AuthState {
  /** Current authentication mode read from NEXT_PUBLIC_AUTH_MODE */
  authMode: AuthMode;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Returns headers object to attach to fetch requests */
  getAuthHeaders: () => Record<string, string>;
  /** Returns auth params/headers for WebSocket connections */
  getWebSocketParams: () => Record<string, string>;
  /** Initiate login flow (oauth2 mode) */
  login: () => void;
  /** Logout and clear credentials */
  logout: () => void;
  /** Handle 401/403 responses — redirects to login in oauth2 mode */
  handleAuthError: (status: number) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_KEY_HEADER = 'X-Dashboard-Key';
const API_KEY_STORAGE_KEY = 'tealtiger_dashboard_api_key';
const OAUTH2_TOKEN_STORAGE_KEY = 'tealtiger_dashboard_oauth2_token';
const OAUTH2_REFRESH_TOKEN_KEY = 'tealtiger_dashboard_oauth2_refresh_token';
const OAUTH2_TOKEN_EXPIRY_KEY = 'tealtiger_dashboard_oauth2_expiry';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthModeFromEnv(): AuthMode {
  const envValue = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (envValue === 'api-key' || envValue === 'oauth2' || envValue === 'none') {
    return envValue;
  }
  // Default to 'none' for local development
  return 'none';
}

function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  // Check env first, then localStorage
  const envKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY;
  if (envKey) return envKey;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

function getStoredOAuth2Token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(OAUTH2_TOKEN_STORAGE_KEY);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(OAUTH2_REFRESH_TOKEN_KEY);
}

function getTokenExpiry(): number {
  if (typeof window === 'undefined') return 0;
  const expiry = localStorage.getItem(OAUTH2_TOKEN_EXPIRY_KEY);
  return expiry ? parseInt(expiry, 10) : 0;
}

function isTokenExpired(): boolean {
  const expiry = getTokenExpiry();
  if (expiry === 0) return true;
  // Consider expired if within 60 seconds of expiry
  return Date.now() >= expiry - 60_000;
}

function clearOAuth2Tokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OAUTH2_TOKEN_STORAGE_KEY);
  localStorage.removeItem(OAUTH2_REFRESH_TOKEN_KEY);
  localStorage.removeItem(OAUTH2_TOKEN_EXPIRY_KEY);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAuth — Configurable authentication hook for the Governance Dashboard.
 *
 * Reads `NEXT_PUBLIC_AUTH_MODE` to determine the auth flow:
 * - `none` — passthrough, no credentials (local dev)
 * - `api-key` — injects X-Dashboard-Key header on all requests
 * - `oauth2` — JWT bearer token with refresh flow, redirect on 401/403
 */
export function useAuth(): AuthState {
  const authMode = useMemo(() => getAuthModeFromEnv(), []);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (authMode === 'none') return true;
    if (authMode === 'api-key') return getStoredApiKey() !== null;
    if (authMode === 'oauth2') return getStoredOAuth2Token() !== null && !isTokenExpired();
    return false;
  });

  // ─── OAuth2 Token Refresh ────────────────────────────────────────────────

  useEffect(() => {
    if (authMode !== 'oauth2') return;

    const checkAndRefreshToken = async () => {
      const token = getStoredOAuth2Token();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      if (isTokenExpired()) {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          try {
            await refreshOAuth2Token(refreshToken);
            setIsAuthenticated(true);
          } catch {
            clearOAuth2Tokens();
            setIsAuthenticated(false);
            redirectToLogin();
          }
        } else {
          clearOAuth2Tokens();
          setIsAuthenticated(false);
          redirectToLogin();
        }
      }
    };

    // Check token validity on mount
    checkAndRefreshToken();

    // Set up periodic refresh check (every 30 seconds)
    const interval = setInterval(checkAndRefreshToken, 30_000);
    return () => clearInterval(interval);
  }, [authMode]);

  // ─── getAuthHeaders ──────────────────────────────────────────────────────

  const getAuthHeaders = useCallback((): Record<string, string> => {
    switch (authMode) {
      case 'none':
        return {};

      case 'api-key': {
        const key = getStoredApiKey();
        if (!key) return {};
        return { [API_KEY_HEADER]: key };
      }

      case 'oauth2': {
        const token = getStoredOAuth2Token();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      }

      default:
        return {};
    }
  }, [authMode]);

  // ─── getWebSocketParams ──────────────────────────────────────────────────

  const getWebSocketParams = useCallback((): Record<string, string> => {
    switch (authMode) {
      case 'none':
        return {};

      case 'api-key': {
        const key = getStoredApiKey();
        if (!key) return {};
        return { [API_KEY_HEADER]: key };
      }

      case 'oauth2': {
        const token = getStoredOAuth2Token();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      }

      default:
        return {};
    }
  }, [authMode]);

  // ─── login ───────────────────────────────────────────────────────────────

  const login = useCallback(() => {
    switch (authMode) {
      case 'none':
        // No-op in no-auth mode
        setIsAuthenticated(true);
        break;

      case 'api-key': {
        // In API key mode, key should already be set via env or localStorage.
        // This is a no-op signal to confirm authentication.
        const key = getStoredApiKey();
        setIsAuthenticated(key !== null);
        break;
      }

      case 'oauth2':
        // Redirect to OAuth2 authorization endpoint
        redirectToLogin();
        break;
    }
  }, [authMode]);

  // ─── logout ──────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    switch (authMode) {
      case 'none':
        // No-op in no-auth mode
        break;

      case 'api-key':
        if (typeof window !== 'undefined') {
          localStorage.removeItem(API_KEY_STORAGE_KEY);
        }
        setIsAuthenticated(false);
        break;

      case 'oauth2':
        clearOAuth2Tokens();
        setIsAuthenticated(false);
        break;
    }
  }, [authMode]);

  // ─── handleAuthError ─────────────────────────────────────────────────────

  const handleAuthError = useCallback(
    (status: number) => {
      if (status !== 401 && status !== 403) return;

      switch (authMode) {
        case 'none':
          // Should never happen in no-auth mode
          break;

        case 'api-key':
          // Clear invalid key and mark as unauthenticated
          if (typeof window !== 'undefined') {
            localStorage.removeItem(API_KEY_STORAGE_KEY);
          }
          setIsAuthenticated(false);
          break;

        case 'oauth2':
          // Clear tokens and redirect to login
          clearOAuth2Tokens();
          setIsAuthenticated(false);
          redirectToLogin();
          break;
      }
    },
    [authMode],
  );

  return {
    authMode,
    isAuthenticated,
    getAuthHeaders,
    getWebSocketParams,
    login,
    logout,
    handleAuthError,
  };
}

// ─── OAuth2 Helpers ──────────────────────────────────────────────────────────

/**
 * Redirect to OAuth2 authorization endpoint.
 * Uses NEXT_PUBLIC_OAUTH2_ISSUER and NEXT_PUBLIC_OAUTH2_CLIENT_ID env vars.
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;

  const issuer = process.env.NEXT_PUBLIC_OAUTH2_ISSUER;
  const clientId = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID;
  const scopes = process.env.NEXT_PUBLIC_OAUTH2_SCOPES || 'openid profile';

  if (!issuer || !clientId) {
    console.error('[useAuth] OAuth2 mode requires NEXT_PUBLIC_OAUTH2_ISSUER and NEXT_PUBLIC_OAUTH2_CLIENT_ID');
    return;
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const authUrl = new URL(`${issuer}/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);

  window.location.href = authUrl.toString();
}

/**
 * Refresh the OAuth2 access token using the refresh token.
 * Stores the new tokens in localStorage on success.
 */
async function refreshOAuth2Token(refreshToken: string): Promise<void> {
  const issuer = process.env.NEXT_PUBLIC_OAUTH2_ISSUER;
  const clientId = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID;

  if (!issuer || !clientId) {
    throw new Error('OAuth2 configuration missing');
  }

  const response = await fetch(`${issuer}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();

  if (typeof window !== 'undefined') {
    localStorage.setItem(OAUTH2_TOKEN_STORAGE_KEY, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(OAUTH2_REFRESH_TOKEN_KEY, data.refresh_token);
    }
    // Store expiry as unix timestamp (ms)
    const expiresIn = data.expires_in || 3600; // default 1 hour
    localStorage.setItem(OAUTH2_TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
  }
}

export default useAuth;
