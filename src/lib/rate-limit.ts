/**
 * Sliding-window rate limiter with pluggable backends.
 *
 * Backends:
 *   - "memory" (default): In-memory Map. Fine for single-instance / dev.
 *   - "redis": Upstash Redis via @upstash/redis. Shared across instances.
 *
 * Selection: Set RATE_LIMIT_PROVIDER=redis in env (requires UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN).
 */

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// ─── Backend Interface ──────────────────────────────────

interface RateLimitBackend {
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
}

// ─── In-Memory Backend ──────────────────────────────────

interface RateLimitEntry {
  timestamps: number[];
}

class MemoryBackend implements RateLimitBackend {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private static CLEANUP_INTERVAL = 5 * 60 * 1000;

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    this.cleanup(config.windowMs);

    const now = Date.now();
    const cutoff = now - config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= config.maxRequests) {
      const oldest = entry.timestamps[0];
      const retryAfterMs = oldest + config.windowMs - now;
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: config.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  private cleanup(windowMs: number) {
    const now = Date.now();
    if (now - this.lastCleanup < MemoryBackend.CLEANUP_INTERVAL) return;
    this.lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) this.store.delete(key);
    }
  }
}

// ─── Redis Backend (Upstash) ────────────────────────────

class RedisBackend implements RateLimitBackend {
  private redis: { eval: (script: string, keys: string[], args: string[]) => Promise<unknown> } | null = null;

  private async getRedis() {
    if (this.redis) return this.redis;

    // Dynamic import to avoid bundling @upstash/redis when not needed
    try {
      // @ts-expect-error — optional dependency, not installed by default
      const { Redis } = await import("@upstash/redis");
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      return this.redis;
    } catch {
      console.warn("[rate-limit] @upstash/redis not available, falling back to memory backend");
      return null;
    }
  }

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redis = await this.getRedis();
    if (!redis) {
      // Fallback to memory if Redis unavailable
      return memoryBackend.check(key, config);
    }

    const redisKey = `rl:${key}`;
    const now = Date.now();
    const windowMs = config.windowMs;
    const cutoff = now - windowMs;

    // Atomic Lua script: clean old entries, count, conditionally add
    const script = `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      local count = redis.call('ZCARD', KEYS[1])
      if count < tonumber(ARGV[2]) then
        redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
        redis.call('PEXPIRE', KEYS[1], ARGV[4])
        return {1, tonumber(ARGV[2]) - count - 1, 0}
      else
        local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        local retryAfter = 0
        if #oldest >= 2 then
          retryAfter = tonumber(oldest[2]) + tonumber(ARGV[4]) - tonumber(ARGV[3])
        end
        return {0, 0, retryAfter}
      end
    `;

    try {
      const result = await redis.eval(
        script,
        [redisKey],
        [String(cutoff), String(config.maxRequests), String(now), String(windowMs)],
      ) as [number, number, number];

      return {
        allowed: result[0] === 1,
        remaining: Math.max(result[1], 0),
        retryAfterMs: Math.max(result[2], result[0] === 0 ? 1000 : 0),
      };
    } catch (err) {
      console.error("[rate-limit] Redis error, falling back to memory:", err);
      return memoryBackend.check(key, config);
    }
  }
}

// ─── Backend Selection ──────────────────────────────────

const memoryBackend = new MemoryBackend();

function getBackend(): RateLimitBackend {
  if (process.env.RATE_LIMIT_PROVIDER === "redis") {
    return redisBackend;
  }
  return memoryBackend;
}

const redisBackend = new RedisBackend();

// ─── Public API ─────────────────────────────────────────

/**
 * Check and consume a rate limit slot for the given key.
 * Supports both sync (memory) and async (Redis) backends.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  return getBackend().check(key, config);
}

/**
 * Synchronous rate limit check (memory backend only).
 * Use this in middleware where async is inconvenient.
 * Falls back to memory even if Redis is configured.
 */
export function checkRateLimitSync(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  // Direct memory check (no cleanup overhead for hot path)
  const store = (memoryBackend as unknown as { store: Map<string, RateLimitEntry> }).store;
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

// ─── Preset Configs ────────────────────────────────────

/** Auth endpoints: 5 attempts per 15 minutes */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
};

/** Registration: 3 attempts per 15 minutes */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 15 * 60 * 1000,
};

/** Password reset: 3 attempts per 15 minutes */
export const RESET_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 15 * 60 * 1000,
};
