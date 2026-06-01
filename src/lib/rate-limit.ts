import "server-only";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

declare global {
  var __vcharastudioRateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

const buckets = globalThis.__vcharastudioRateLimitBuckets ?? new Map<string, RateLimitBucket>();
globalThis.__vcharastudioRateLimitBuckets = buckets;

let lastPrunedAt = 0;

function pruneExpiredBuckets(now: number) {
  if (now - lastPrunedAt < 60_000) return;
  lastPrunedAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function normalizeIp(value?: string | null) {
  const ip = value?.split(",")[0]?.trim();
  return ip || "unknown";
}

export function getClientIp(request: Request) {
  return normalizeIp(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip"),
  );
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const bucket = buckets.get(options.key);
  const activeBucket = bucket && bucket.resetAt > now
    ? bucket
    : { count: 0, resetAt: now + options.windowMs };

  activeBucket.count += 1;
  buckets.set(options.key, activeBucket);

  const remaining = Math.max(0, options.limit - activeBucket.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((activeBucket.resetAt - now) / 1000));

  return {
    allowed: activeBucket.count <= options.limit,
    limit: options.limit,
    remaining,
    retryAfterSeconds,
    resetAt: new Date(activeBucket.resetAt),
  };
}

export function checkRequestRateLimit(
  request: Request,
  namespace: string,
  options: Omit<RateLimitOptions, "key">,
) {
  return checkRateLimit({
    ...options,
    key: `${namespace}:ip:${getClientIp(request)}`,
  });
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    {
      message: "Too many requests. Please wait and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
      },
    },
  );
}
