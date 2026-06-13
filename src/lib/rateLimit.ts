// ════════════════════════════════════════════════════════════════════════════
//  rateLimit — lightweight in-memory rate limiter (SERVER)
//  Best-effort: serverless instances don't share memory, so this caps bursts on
//  a warm instance but is NOT a globally-enforced limit. It's defense-in-depth on
//  top of auth. For hard limits, put Upstash Redis or Vercel WAF in front.
//  Returns true if the call is allowed, false if the limit is exceeded.
// ════════════════════════════════════════════════════════════════════════════
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
