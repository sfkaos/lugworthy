// Polite HTTP for the brand-site crawler: identifying User-Agent, robots.txt
// respected (longest-match Allow/Disallow), one request at a time per host with
// a minimum gap, back-off on 429/503, and a hard timeout.

export const UA = `LugworthyBot/0.2 (+https://lugworthy.com/for-brands; ${process.env.INGEST_CONTACT_EMAIL ?? "hello@lugworthy.com"})`;

const MIN_GAP_MS = Number(process.env.CRAWL_GAP_MS ?? 1500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shared image CDNs serve thousands of shops; a short gap is polite enough there.
const CDN_HOST = /(^|\.)(cdn\.shopify\.com|shopifycdn\.net|squarespace-cdn\.com|static1\.squarespace\.com|wixstatic\.com|shoplineimg\.com|img\.shoplineapp\.com|cloudfront\.net|imgix\.net|bigcommerce\.com|ctfassets\.net|cloudinary\.com|cdn-files-a\.com|s123-cdn-static-d\.com)$/i;

const nextSlot = new Map<string, number>();
async function waitTurn(host: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + (CDN_HOST.test(host) ? 150 : MIN_GAP_MS));
  if (at > now) await sleep(at - now);
}

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string; // final URL after redirects
  contentType: string;
  text: string;
  bytes: Buffer;
  /** The site answered with a bot challenge (captcha / JS check). We never try to get past these. */
  challenged?: boolean;
}

export async function politeGet(url: string, accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", attempt = 0): Promise<FetchResult> {
  const host = new URL(url).host;
  await waitTurn(host);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept, "accept-language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const retry = Number(res.headers.get("retry-after")) || 2 ** (attempt + 2);
      await sleep(Math.min(retry, 60) * 1000);
      return politeGet(url, accept, attempt + 1);
    }
    const contentType = res.headers.get("content-type") ?? "";
    // Images are capped at 25 MB and everything else at 5 MB, checked while reading,
    // so a video or a giant file can't use up the crawler's memory.
    const isImage = /^image\//i.test(contentType);
    const cap = isImage ? 25_000_000 : 5_000_000;
    const buf = await readCapped(res, cap);
    if (process.env.CRAWL_DEBUG) console.error(`[get] ${res.status} ${buf ? buf.byteLength : "too-large"} ${contentType.split(";")[0]} ${url}`);
    if (!buf) return { ok: false, status: 413, url, contentType, text: "too large", bytes: Buffer.alloc(0) };
    const text = isImage && !/svg/i.test(contentType) ? "" : buf.toString("utf8");
    const challenged = !!res.headers.get("sg-captcha") || res.headers.get("cf-mitigated") === "challenge"
      || (res.status === 202 && text.length < 2000 && /captcha|challenge/i.test(text))
      || (res.status === 403 && /cf-chl|challenge-platform|captcha/i.test(text.slice(0, 5000)));
    return { ok: res.ok && !challenged, status: res.status, url: res.url || url, contentType, text, bytes: buf, challenged };
  } catch (e) {
    return { ok: false, status: 0, url, contentType: "", text: String((e as Error).message ?? e), bytes: Buffer.alloc(0) };
  }
}

/** Reads a response body, giving up (null) once it passes `cap` bytes. */
async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > cap) { await res.body?.cancel().catch(() => {}); return null; }
  if (!res.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks, size);
}

// ---------- robots.txt ----------

interface Rule { allow: boolean; pattern: string }
export interface Robots { rules: Rule[]; sitemaps: string[]; crawlDelayS: number | null }

const robotsCache = new Map<string, Promise<Robots>>();

export function parseRobots(txt: string, agent = "lugworthybot"): Robots {
  const groups: { agents: string[]; rules: Rule[]; delay: number | null }[] = [];
  const sitemaps: string[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === "sitemap") { if (v) sitemaps.push(v); continue; }
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === "allow" || k === "disallow") {
      if (k === "disallow" && !v) continue; // empty Disallow = allow all
      cur.rules.push({ allow: k === "allow", pattern: v });
    } else if (k === "crawl-delay") {
      const n = Number(v);
      if (Number.isFinite(n)) cur.delay = n;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a.replace(/\/.*$/, ""))));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return {
    rules: chosen.flatMap((g) => g.rules),
    sitemaps,
    crawlDelayS: chosen.map((g) => g.delay).find((d) => d != null) ?? null,
  };
}

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith("$");
  const body = (anchored ? p.slice(0, -1) : p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

export function robotsAllowsPath(robots: Robots, pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of robots.rules) {
    if (!patternToRegex(r.pattern).test(pathAndQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

export function getRobots(origin: string): Promise<Robots> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = politeGet(`${origin}/robots.txt`, "text/plain").then((r) => {
      const robots = r.ok && !/<html/i.test(r.text.slice(0, 500)) ? parseRobots(r.text) : { rules: [], sitemaps: [], crawlDelayS: null };
      // Honour a Crawl-delay above our default gap (capped so one site can't stall the run).
      if (robots.crawlDelayS && robots.crawlDelayS * 1000 > MIN_GAP_MS) {
        const host = new URL(origin).host;
        const extra = Math.min(robots.crawlDelayS, 10) * 1000 - MIN_GAP_MS;
        nextSlot.set(host, (nextSlot.get(host) ?? 0) + extra);
        hostGapOverride.set(host, Math.min(robots.crawlDelayS, 10) * 1000);
      }
      return robots;
    });
    robotsCache.set(origin, p);
  }
  return p;
}

const hostGapOverride = new Map<string, number>();

/** Fetch only if robots.txt allows it. Returns null when disallowed. */
export async function allowedGet(url: string, accept?: string): Promise<FetchResult | null> {
  const u = new URL(url);
  const robots = await getRobots(u.origin);
  if (!robotsAllowsPath(robots, u.pathname + u.search)) return null;
  const gap = hostGapOverride.get(u.host);
  if (gap && gap > MIN_GAP_MS) {
    const at = Math.max(Date.now(), nextSlot.get(u.host) ?? 0);
    nextSlot.set(u.host, at + (gap - MIN_GAP_MS));
  }
  return politeGet(url, accept);
}
