'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface UseCachedQueryOptions {
  /** REST endpoint path (e.g., '/api/v1/modules/health') */
  endpoint: string;
  /** Additional query params appended to the request URL */
  params?: Record<string, string | number | boolean | undefined>;
  /** Time-to-live in milliseconds. Default: 30000 (30 seconds) */
  ttl?: number;
  /** Whether the query is enabled. Set to false to skip fetching. */
  enabled?: boolean;
}

export interface UseCachedQueryReturn<T> {
  /** Fetched data or null if not yet loaded */
  data: T | null;
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** Error from the most recent fetch attempt, or null */
  error: Error | null;
  /** Manually invalidate the cache for this key, triggering a re-fetch */
  invalidate: () => void;
}

// ─── Cache Store (module-level singleton) ────────────────────────────────────

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Build a cache key from endpoint and params.
 */
export function buildCacheKey(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (!params) return endpoint;

  const sortedEntries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  if (sortedEntries.length === 0) return endpoint;

  const paramStr = sortedEntries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${endpoint}?${paramStr}`;
}

/**
 * Check if a cache entry is still valid (within TTL).
 */
export function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < ttl;
}

/**
 * Get the current cache entry for a key.
 * Exposed for testing and external invalidation.
 */
export function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

/**
 * Set a cache entry for a key.
 */
export function setCacheEntry<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate (delete) a cache entry by key.
 */
export function invalidateCacheEntry(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 * Useful for invalidating all entries for an endpoint regardless of params.
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache. Primarily for testing.
 */
export function clearCache(): void {
  cache.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const base = getApiBaseUrl();
  const url = new URL(endpoint, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

// ─── Default TTL ─────────────────────────────────────────────────────────────

/** Default TTL: 30 seconds for stable data */
export const DEFAULT_TTL = 30_000;

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useCachedQuery — A lightweight data-fetching hook with in-memory caching and TTL.
 *
 * Caches responses keyed by endpoint + params. Returns cached data immediately if
 * within TTL, otherwise triggers a fresh fetch. Exposes an `invalidate()` function
 * for manual cache busting (e.g., on WebSocket events).
 *
 * @param options - Configuration for endpoint, params, TTL, and enabled state
 * @returns { data, isLoading, error, invalidate }
 *
 * @validates Requirements 12.6 (Cache frequently accessed data locally to reduce API calls)
 */
export function useCachedQuery<T>(
  options: UseCachedQueryOptions,
): UseCachedQueryReturn<T> {
  const { endpoint, params, ttl = DEFAULT_TTL, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [invalidationCount, setInvalidationCount] = useState<number>(0);

  const { getAuthHeaders, handleAuthError } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  const cacheKey = buildCacheKey(endpoint, params);

  // ─── Fetch function ──────────────────────────────────────────────────────

  const fetchData = useCallback(async (key: string, signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = buildUrl(endpoint, params);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      };

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal,
      });

      if (signal.aborted) return;

      if (response.status === 401 || response.status === 403) {
        handleAuthError(response.status);
        throw new Error(`Authentication error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      if (signal.aborted) return;

      // Store in cache
      setCacheEntry(key, json);
      setData(json as T);
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;

      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [endpoint, params, getAuthHeaders, handleAuthError]);

  // ─── Main effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = getCacheEntry<T>(cacheKey);
    if (isCacheValid(cached, ttl)) {
      setData(cached!.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cache miss or expired — fetch fresh data
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchData(cacheKey, controller.signal);

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ttl, enabled, invalidationCount]);

  // ─── Invalidate ──────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    invalidateCacheEntry(cacheKey);
    setInvalidationCount((c) => c + 1);
  }, [cacheKey]);

  return {
    data,
    isLoading,
    error,
    invalidate,
  };
}

export default useCachedQuery;
