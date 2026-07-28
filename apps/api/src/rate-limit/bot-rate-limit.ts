const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkBotRateLimit(
  key: string,
  limitPerMin = 60,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limitPerMin) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true };
}

export function clientIp(request: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return request.ip ?? 'unknown';
}
