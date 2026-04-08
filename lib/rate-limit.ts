/**
 * AgentLedger — Rate Limiter
 *
 * Sliding window rate limiter backed by a simple in-memory store.
 * For multi-instance deployments, swap the store for Redis (Upstash).
 *
 * Usage (ingest service):
 *   const limiter = createRateLimiter({ window: 60_000, max: 500 });
 *   const { ok, remaining } = limiter.check(apiKey);
 *   if (!ok) return res.status(429).json({ error: 'Rate limit exceeded' });
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export interface RateLimiterOptions {
  /** Time window in ms. Default: 60_000 (1 minute) */
  window?: number;
  /** Max requests per window per key. Default: 500 */
  max?: number;
  /** Max number of tracked keys before LRU eviction. Default: 10_000 */
  maxKeys?: number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}) {
  const window  = opts.window  ?? 60_000;
  const max     = opts.max     ?? 500;
  const maxKeys = opts.maxKeys ?? 10_000;

  const store = new Map<string, WindowEntry>();

  // Evict oldest entries when store gets too large
  function evict() {
    if (store.size < maxKeys) return;
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of store) {
      if (entry.resetAt < now) { store.delete(key); evicted++; }
      if (evicted >= 100) break; // Evict up to 100 at a time
    }
    // If nothing expired, evict oldest
    if (evicted === 0 && store.size >= maxKeys) {
      const first = store.keys().next().value;
      if (first) store.delete(first);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry || entry.resetAt <= now) {
        evict();
        entry = { count: 0, resetAt: now + window };
        store.set(key, entry);
      }

      entry.count++;
      const remaining = Math.max(0, max - entry.count);
      const ok = entry.count <= max;

      return {
        ok,
        remaining,
        resetAt: entry.resetAt,
        retryAfterMs: ok ? undefined : entry.resetAt - now,
      };
    },

    peek(key: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || entry.resetAt <= now) {
        return { ok: true, remaining: max, resetAt: now + window };
      }
      return {
        ok: entry.count < max,
        remaining: Math.max(0, max - entry.count),
        resetAt: entry.resetAt,
      };
    },

    reset(key: string) {
      store.delete(key);
    },

    stats() {
      return { keys: store.size, maxKeys };
    },
  };
}

// Default limiters for reuse
export const ingestLimiter = createRateLimiter({
  window: 60_000,
  max: 1_000, // 1,000 events/min per API key — covers ~16 events/sec
});

export const apiLimiter = createRateLimiter({
  window: 60_000,
  max: 120, // 2 req/sec per user for dashboard API
});
