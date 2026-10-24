// Tiny in-memory limiter for public forms (doc 14). Swap for Upstash/Redis on Vercel.
const hits = new Map<string, number[]>();
export function limited(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
