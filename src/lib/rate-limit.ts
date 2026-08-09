import "server-only";

// Best-effort in-memory rate limiter. Good enough for a single-instance
// Cloudflare Worker deployment; if this app ever runs across many
// concurrent isolates/instances, swap the Map for a shared store (e.g.
// Upstash Redis) behind this same call signature.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}
