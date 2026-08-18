'use client';

import { useEffect } from 'react';
import type { StreamEvent } from '../../../../shared/types';
import { invalidateCacheByPrefix } from './useCachedQuery';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CacheInvalidationMap {
  /** WebSocket event type → array of cache key prefixes to invalidate */
  [eventType: string]: string[];
}

/**
 * Default mapping from WebSocket event types to cache key prefixes.
 *
 * - `pipeline_result` → invalidate pipeline status cache
 * - `freeze_change` → invalidate freeze state cache
 * - `module_state` → invalidate module health cache
 */
export const DEFAULT_INVALIDATION_MAP: CacheInvalidationMap = {
  pipeline_result: ['/api/v1/pipeline/status'],
  freeze_change: ['/api/v1/freeze/state'],
  module_state: ['/api/v1/modules/health'],
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useCacheInvalidation — Wires WebSocket events to cache invalidation.
 *
 * Listens to incoming DataStream events and invalidates the appropriate cache
 * entries based on the configured event-type-to-prefix mapping. This ensures
 * that cached data (module list, pipeline config, freeze state) is refreshed
 * when the server pushes relevant updates.
 *
 * @param lastEvent - The most recent StreamEvent from useDataStream
 * @param invalidationMap - Optional custom mapping (defaults to DEFAULT_INVALIDATION_MAP)
 *
 * @validates Requirements 12.6 (Invalidate cache on relevant WebSocket events)
 */
export function useCacheInvalidation(
  lastEvent: StreamEvent | null,
  invalidationMap: CacheInvalidationMap = DEFAULT_INVALIDATION_MAP,
): void {
  useEffect(() => {
    if (!lastEvent) return;

    const prefixes = invalidationMap[lastEvent.type];
    if (prefixes && prefixes.length > 0) {
      for (const prefix of prefixes) {
        invalidateCacheByPrefix(prefix);
      }
    }
  }, [lastEvent, invalidationMap]);
}

export default useCacheInvalidation;
