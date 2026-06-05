// In-memory token bucket rate limiter, keyed by an arbitrary string (usually userId).
// Lives in the Node process — fine for single-instance deploys; for serverless
// you'd swap this for a Redis/Upstash-backed implementation.

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

interface LimiterConfig {
  capacity: number; // max tokens
  refillPerSecond: number; // tokens added per second
}

function getBucket(key: string, cfg: LimiterConfig): Bucket {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing) {
    const b = { tokens: cfg.capacity, lastRefill: now };
    buckets.set(key, b);
    return b;
  }
  const elapsedSec = (now - existing.lastRefill) / 1000;
  const refill = elapsedSec * cfg.refillPerSecond;
  existing.tokens = Math.min(cfg.capacity, existing.tokens + refill);
  existing.lastRefill = now;
  return existing;
}

export interface LimiterResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function consume(
  key: string,
  cfg: LimiterConfig
): LimiterResult {
  const b = getBucket(key, cfg);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
  }
  const need = 1 - b.tokens;
  const retryAfterSec = Math.ceil(need / cfg.refillPerSecond);
  return { ok: false, remaining: 0, retryAfterSec };
}

// Sensible defaults for the coach endpoints.
// 10-token burst, refilling 1 token every 6 seconds (10/min).
export const COACH_LIMIT: LimiterConfig = {
  capacity: 10,
  refillPerSecond: 1 / 6,
};

// Heavier rate for the weekly check-in (more expensive Claude call).
// 3-token burst, 1 token per 60 seconds (1/min, ~60/hr).
export const WEEKLY_CHECKIN_LIMIT: LimiterConfig = {
  capacity: 3,
  refillPerSecond: 1 / 60,
};

// Password reset request — generous burst of 5, then 1 every 12 minutes
// (i.e. 5 per hour sustained). Applied separately by IP and by email so
// neither key can be used to enumerate the other.
export const PASSWORD_RESET_REQUEST_LIMIT: LimiterConfig = {
  capacity: 5,
  refillPerSecond: 1 / 720,
};

// Password reset complete — 10-token burst, 1 every 6 min (10/hour). Higher
// than request because a user with a valid token may legitimately retry on
// typos.
export const PASSWORD_RESET_COMPLETE_LIMIT: LimiterConfig = {
  capacity: 10,
  refillPerSecond: 1 / 360,
};
