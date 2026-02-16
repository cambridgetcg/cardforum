/**
 * In-memory cache for order book aggregation queries.
 * TTL-based with automatic eviction. Invalidated on listing mutations via event bus.
 *
 * This prevents expensive groupBy queries on every pageview.
 * At scale, replace with Redis.
 */

const CACHE_TTL_MS = 10_000; // 10 seconds
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  // Evict oldest entries if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidatePattern(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function invalidateAll(): void {
  cache.clear();
}
