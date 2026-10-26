import "server-only";
import { ApiError } from "@/lib/api";
import { getRedis } from "@/lib/queue";

const memory = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window rate limit per user+bucket. Uses Redis when available so limits hold
 * across serverless instances; falls back to process memory in development.
 */
export async function rateLimit(userId: string, bucket: string, limit: number, windowSec: number): Promise<void> {
  const key = `rl:${bucket}:${userId}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  let count: number;
  try {
    const r = getRedis();
    count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSec);
  } catch {
    const now = Date.now();
    const cur = memory.get(key);
    if (!cur || cur.resetAt < now) memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    else cur.count++;
    count = memory.get(key)!.count;
  }
  if (count > limit) throw new ApiError(429, "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.", "rate_limited");
}
