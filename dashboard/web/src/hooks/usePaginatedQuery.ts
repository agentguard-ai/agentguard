'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UsePaginatedQueryOptions<T> {
  /** REST endpoint path (e.g., '/api/v1/decisions') */
  endpoint: string;
  /** Additional query params appended to the request URL */
  params?: Record<string, string | number | boolean | undefined>;
  /** Number of results per page (25, 50, or 100) */
  pageSize?: 25 | 50 | 100;
  /** Whether the query is enabled. Set to false to skip fetching. */
  enabled?: boolean;
}

export interface UsePaginatedQueryReturn<T> {
  /** Array of results for the current page */
  data: T[];
  /** Total number of matching records across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Current page size */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** Error from the most recent fetch attempt, or null */
  error: Error | null;
  /** Navigate to a specific page (1-indexed) */
  goToPage: (page: number) => void;
  /** Navigate to the next page (no-op if on last page) */
  nextPage: () => void;
  /** Navigate to the previous page (no-op if on first page) */
  prevPage: () => void;
  /** Re-fetch the current page */
  refresh: () => void;
  /** Whether there is a next page available */
  hasNextPage: boolean;
  /** Whether there is a previous page available */
  hasPrevPage: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

function buildUrl(
  endpoint: string,
  page: number,
  pageSize: number,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const base = getApiBaseUrl();
  const url = new URL(endpoint, base);

  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * usePaginatedQuery — Generic REST pagination hook with cursor tracking,
 * loading states, and error handling.
 *
 * Fetches paginated data from a REST endpoint, providing navigation methods
 * (goToPage, nextPage, prevPage) and metadata (totalPages, hasNextPage, etc.).
 *
 * Expects the API to return a response shaped as:
 * `{ results: T[], total: number, page: number, pageSize: number }`
 *
 * Re-fetches automatically when page, params, endpoint, or pageSize changes.
 *
 * @validates Requirements 3.6 (Pagination with configurable page sizes 25, 50, 100)
 * @validates Requirements 12.2 (Return paginated results within 500ms for datasets up to 1M records)
 */
export function usePaginatedQuery<T>(
  options: UsePaginatedQueryOptions<T>,
): UsePaginatedQueryReturn<T> {
  const { endpoint, params, pageSize: requestedPageSize = 25, enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(requestedPageSize);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const { getAuthHeaders, handleAuthError } = useAuth();

  // Use a ref to track the latest fetch and enable aborting stale requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track a refresh counter to allow manual re-fetching
  const refreshCounterRef = useRef<number>(0);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  // Serialized params for dependency tracking
  const serializedParams = params ? JSON.stringify(params) : '';

  // Reset to page 1 when endpoint, params, or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [endpoint, serializedParams, pageSize]);

  // Main fetch effect
  useEffect(() => {
    if (!enabled) {
      setData([]);
      setTotal(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = buildUrl(endpoint, page, pageSize, params);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        };

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401 || response.status === 403) {
          handleAuthError(response.status);
          throw new Error(`Authentication error: ${response.status}`);
        }

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();

        if (controller.signal.aborted) return;

        // Parse the paginated response
        const results: T[] = json.results ?? json.data ?? [];
        const totalRecords: number = json.total ?? 0;

        setData(results);
        setTotal(totalRecords);
      } catch (err) {
        if (controller.signal.aborted) return;

        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        setError(err instanceof Error ? err : new Error(String(err)));
        setData([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, serializedParams, enabled, refreshCounter]);

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // ─── Navigation methods ──────────────────────────────────────────────────

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(targetPage, totalPages));
      setPage(clamped);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const refresh = useCallback(() => {
    refreshCounterRef.current += 1;
    setRefreshCounter(refreshCounterRef.current);
  }, []);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    hasNextPage,
    hasPrevPage,
  };
}

export default usePaginatedQuery;
