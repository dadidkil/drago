import { Redis } from "ioredis";
import { createLogger } from "./logger";

const log = createLogger("rate-limit");

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") log.warn("REDIS_URL не задан — rate limiting работает в памяти процесса");
    redis = null;
    return redis;
  }
  redis = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  redis.on("error", (err) => log.warn("redis error", { err: err.message }));
  return redis;
}

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  if (memory.size > 50_000) {
    for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
  }
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  entry.count += 1;
  const ok = entry.count <= limit;
  return { ok, remaining: Math.max(0, limit - entry.count), retryAfterSec: ok ? 0 : Math.ceil((entry.resetAt - now) / 1000) };
}

/**
 * Фиксированное окно: не более `limit` событий за `windowSec` на ключ.
 * Redis — общий лимит для всех инстансов; при недоступности Redis — лимит в памяти (fail-safe, а не fail-open).
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`;
  const client = getRedis();
  if (client && client.status === "ready") {
    try {
      const res = await client.multi().incr(fullKey).expire(fullKey, windowSec, "NX").ttl(fullKey).exec();
      const count = Number(res?.[0]?.[1] ?? 0);
      const ttl = Number(res?.[2]?.[1] ?? windowSec);
      const ok = count <= limit;
      return { ok, remaining: Math.max(0, limit - count), retryAfterSec: ok ? 0 : Math.max(1, ttl) };
    } catch (err) {
      log.warn("redis rate limit failed, fallback to memory", { err: (err as Error).message });
    }
  }
  return memoryHit(fullKey, limit, windowSec);
}

export async function resetRateLimit(key: string): Promise<void> {
  const fullKey = `rl:${key}`;
  memory.delete(fullKey);
  const client = getRedis();
  if (client && client.status === "ready") await client.del(fullKey).catch(() => undefined);
}
