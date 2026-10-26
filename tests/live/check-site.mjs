// Full-site check against a running Lugworthy site. Read-only: only GET requests.
//
//   node tests/live/check-site.mjs                         # https://lugworthy.com, every page
//   node tests/live/check-site.mjs --limit 500             # first 500 pages only
//   BASE_URL=http://localhost:3000 node tests/live/check-site.mjs
//
// What it does:
// 1. Opens every page in the sitemap, and every internal page linked from those pages.
// 2. Checks every internal link (incl. filter links with a query string) answers without an error,
//    and every /out/ buy link redirects to a brand site.
// 3. Checks every image on those pages loads (status 200 and an image content type).
// 4. Times every page and flags the slow ones.
// It writes test-results/site-check.json and test-results/site-check.md, and exits 1 on any
// broken page, link or image, or a page slower than --slow-ms.

import { mkdir, writeFile } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] == null ? "true" : all[i + 1]]] : acc), []),
);
const BASE = new URL(process.env.BASE_URL ?? args.base ?? "https://lugworthy.com");
const LIMIT = Number(args.limit ?? Infinity);
const CONCURRENCY = Number(args.concurrency ?? 4);
const SLOW_MS = Number(args["slow-ms"] ?? 3000);
const TIMEOUT_MS = Number(args["timeout-ms"] ?? 30000);
const OUT = args.out ?? "test-results";
const CHECK_IMAGES = args.images !== "false";

const pages = new Map(); // path -> { status, ms, bytes, error }
const links = new Map(); // url (path+query) -> { status, error, foundOn:Set }
const images = new Map(); // absolute url -> { status, type, error, foundOn:Set }
const queue = [];
const seen = new Set();

const norm = (href, from) => {
  try {
    const u = new URL(href, new URL(from, BASE));
    u.hash = "";
    return u;
  } catch {
    return null;
  }
};

/** Fetches and reads the whole body (or stops reading with skipBody) under one timeout; ms covers both. */
async function timedFetch(url, opts = {}, { skipBody = false } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", ...opts, signal: ctl.signal, headers: { "user-agent": "lugworthy-site-check/1.0", ...(opts.headers ?? {}) } });
    let body = "";
    if (skipBody) await res.body?.cancel().catch(() => {});
    else body = await res.text();
    return { res, body, ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}

function enqueue(path) {
  if (seen.has(path) || seen.size >= LIMIT) return;
  seen.add(path);
  queue.push(path);
}

function extract(html, path) {
  // Links
  for (const m of html.matchAll(/<a\b[^>]*?\bhref="([^"]+)"/g)) {
    const href = m[1].replaceAll("&amp;", "&");
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) continue;
    const u = norm(href, path);
    if (!u || u.host !== BASE.host) continue;
    const key = u.pathname + u.search;
    if (!links.has(key)) links.set(key, { foundOn: new Set() });
    const l = links.get(key);
    if (l.foundOn.size < 3) l.foundOn.add(path);
    if (!u.search && !u.pathname.startsWith("/out/") && !u.pathname.startsWith("/api/")) enqueue(u.pathname);
  }
  // Images (src and srcset)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const srcs = [tag.match(/\bsrc="([^"]+)"/)?.[1], ...(tag.match(/\bsrcset="([^"]+)"/)?.[1]?.split(",").map((s) => s.trim().split(/\s+/)[0]) ?? [])].filter(Boolean);
    for (const s of srcs) {
      if (s.startsWith("data:")) continue;
      const u = norm(s.replaceAll("&amp;", "&"), path);
      if (!u) continue;
      if (!images.has(u.href)) images.set(u.href, { foundOn: new Set() });
      const i = images.get(u.href);
      if (i.foundOn.size < 3) i.foundOn.add(path);
    }
  }
}

async function checkPage(path) {
  const entry = {};
  pages.set(path, entry);
  try {
    let { res, body, ms } = await timedFetch(new URL(path, BASE));
    // Follow a same-site redirect once (e.g. trailing slash).
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const to = norm(res.headers.get("location"), path);
      entry.redirect = to?.href;
      if (to && to.host === BASE.host) ({ res, body, ms } = await timedFetch(to));
    }
    entry.status = res.status;
    entry.ms = ms;
    entry.cache = res.headers.get("x-vercel-cache") ?? undefined;
    const html = body;
    entry.bytes = html.length;
    if (res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) extract(html, path);
  } catch (e) {
    entry.error = e.name === "AbortError" ? `timeout after ${TIMEOUT_MS} ms` : e.cause?.code ?? e.message;
  }
}

async function checkLink(key, l) {
  if (pages.has(key)) {
    const p = pages.get(key);
    Object.assign(l, { status: p.status, error: p.error });
    return;
  }
  try {
    const { res } = await timedFetch(new URL(key, BASE));
    l.status = res.status;
    if (key.startsWith("/out/")) {
      const loc = res.headers.get("location") ?? "";
      const to = norm(loc, key);
      // /out/ falls back to a same-site page (e.g. /watches) when the variant has no brand URL.
      if (!(res.status >= 300 && res.status < 400 && to && /^https?:$/.test(to.protocol) && to.host !== BASE.host)) l.error = `buy link does not redirect to a brand site (location: ${loc || "none"})`;
    }
  } catch (e) {
    l.error = e.name === "AbortError" ? `timeout after ${TIMEOUT_MS} ms` : e.cause?.code ?? e.message;
  }
}

async function checkImage(url, i) {
  try {
    const { res } = await timedFetch(url, { redirect: "follow" }, { skipBody: true });
    i.status = res.status;
    i.type = res.headers.get("content-type") ?? "";
    if (res.ok && !i.type.startsWith("image/")) i.error = `not an image (${i.type})`;
  } catch (e) {
    i.error = e.name === "AbortError" ? `timeout after ${TIMEOUT_MS} ms` : e.cause?.code ?? e.message;
  }
}

async function pool(items, fn, label) {
  let done = 0;
  let active = 0;
  const total = () => (Array.isArray(items) ? items.length : 0);
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const item = items.shift();
      if (item === undefined) {
        // The page queue can grow while other workers are still running.
        if (label === "pages" && active > 0) {
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        return;
      }
      active++;
      try {
        await fn(item);
      } finally {
        active--;
      }
      if (++done % 500 === 0) console.log(`  ${label}: ${done} checked, ${total()} queued`);
    }
  });
  await Promise.all(workers);
  return done;
}

const started = new Date();
console.log(`Checking ${BASE.origin} (concurrency ${CONCURRENCY}, slow > ${SLOW_MS} ms)`);

const sm = await (await fetch(new URL("/sitemap.xml", BASE))).text();
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const u = norm(m[1], "/");
  if (u) enqueue(u.pathname || "/");
}
enqueue("/");
console.log(`Sitemap: ${seen.size} pages`);

await pool(queue, checkPage, "pages");
console.log(`Pages: ${pages.size}. Internal links found: ${links.size}. Images found: ${images.size}`);

await pool([...links.entries()], ([k, l]) => checkLink(k, l), "links");
if (CHECK_IMAGES) await pool([...images.entries()], ([u, i]) => checkImage(u, i), "images");

// Retry anything that timed out or failed with a server error, one at a time, so a passing load
// spike isn't reported as a broken link. What works on retry is reported as "intermittent".
const retryable = (x) => !!x.error && !x.error.startsWith("buy link") || x.status >= 500;
const toRetry = [...[...pages].filter(([, p]) => retryable(p)).map(([k, p]) => ["page", k, p]), ...[...links].filter(([, l]) => retryable(l)).map(([k, l]) => ["link", k, l])];
if (toRetry.length) console.log(`Retrying ${toRetry.length} failures one at a time`);
for (const [kind, key, x] of toRetry) {
  const before = x.error ?? `HTTP ${x.status}`;
  const fresh = {};
  if (kind === "page") {
    pages.delete(key);
    await checkPage(key);
    Object.assign(fresh, pages.get(key));
  } else {
    fresh.foundOn = x.foundOn;
    await checkLink(key, fresh);
  }
  if (!fresh.error && fresh.status < 400) Object.assign(x, fresh, { error: undefined, intermittent: before });
  if (kind === "page") pages.set(key, x);
}

// ---- Report
const isBad = (x) => !!x.error || !x.status || (x.status >= 400);
const brokenPages = [...pages].filter(([, p]) => isBad(p));
const intermittent = [...[...pages].filter(([, p]) => p.intermittent), ...[...links].filter(([k, l]) => l.intermittent && !pages.has(k))];
const brokenLinks = [...links].filter(([, l]) => isBad(l));
const brokenImages = CHECK_IMAGES ? [...images].filter(([, i]) => isBad(i)) : [];
const timed = [...pages].filter(([, p]) => p.ms != null).sort((a, b) => b[1].ms - a[1].ms);
const slow = timed.filter(([, p]) => p.ms > SLOW_MS);
const pct = (q) => timed.length ? [...timed].map(([, p]) => p.ms).sort((a, b) => a - b)[Math.min(timed.length - 1, Math.floor(q * timed.length))] : 0;
const byKind = (path) => (path === "/" ? "/" : path.match(/^\/brands\/[^/]+\/[^/]+/) ? "watch pages" : path.match(/^\/brands\/[^/]+/) ? "brand pages" : "/" + path.split("/")[1]);
const kinds = {};
for (const [path, p] of timed) (kinds[byKind(path)] ??= []).push(p.ms);
const kindRows = Object.entries(kinds).map(([k, v]) => {
  v.sort((a, b) => a - b);
  return { kind: k, pages: v.length, medianMs: v[Math.floor(v.length / 2)], p95Ms: v[Math.floor(v.length * 0.95)], maxMs: v[v.length - 1] };
}).sort((a, b) => b.pages - a.pages);

const summary = {
  base: BASE.origin,
  started: started.toISOString(),
  finished: new Date().toISOString(),
  pages: pages.size,
  links: links.size,
  images: images.size,
  imagesChecked: CHECK_IMAGES,
  brokenPages: brokenPages.length,
  brokenLinks: brokenLinks.length,
  brokenImages: brokenImages.length,
  slowPages: slow.length,
  intermittent: intermittent.length,
  timing: { medianMs: pct(0.5), p95Ms: pct(0.95), maxMs: timed[0]?.[1].ms ?? 0, slowThresholdMs: SLOW_MS },
};
const fmtSet = (s) => [...s].join(", ");
const md = [
  `# Site check: ${BASE.origin}`,
  ``,
  `${summary.started} to ${summary.finished}`,
  ``,
  `| | |`,
  `|---|---|`,
  `| Pages opened | ${summary.pages} |`,
  `| Internal links checked | ${summary.links} |`,
  `| Images checked | ${CHECK_IMAGES ? summary.images : "skipped"} |`,
  `| Broken pages | ${summary.brokenPages} |`,
  `| Broken links | ${summary.brokenLinks} |`,
  `| Broken images | ${summary.brokenImages} |`,
  `| Pages slower than ${SLOW_MS} ms | ${summary.slowPages} |`,
  `| Failed once, worked on retry | ${summary.intermittent} |`,
  `| Response time median / p95 / max | ${summary.timing.medianMs} / ${summary.timing.p95Ms} / ${summary.timing.maxMs} ms |`,
  ``,
  `## Response time by page type`,
  ``,
  `| Page type | Pages | Median | p95 | Max |`,
  `|---|---|---|---|---|`,
  ...kindRows.map((r) => `| ${r.kind} | ${r.pages} | ${r.medianMs} ms | ${r.p95Ms} ms | ${r.maxMs} ms |`),
  ``,
  `## Broken pages`,
  ...(brokenPages.length ? brokenPages.slice(0, 200).map(([k, p]) => `- ${k}: ${p.error ?? p.status}`) : ["None."]),
  ``,
  `## Broken links`,
  ...(brokenLinks.length ? brokenLinks.slice(0, 200).map(([k, l]) => `- ${k}: ${l.error ?? l.status} (on ${fmtSet(l.foundOn)})`) : ["None."]),
  ``,
  `## Failed once, worked on retry`,
  ...(intermittent.length ? intermittent.slice(0, 200).map(([k, x]) => `- ${k}: first try ${x.intermittent}`) : ["None."]),
  ``,
  `## Broken images`,
  ...(brokenImages.length ? brokenImages.slice(0, 200).map(([u, i]) => `- ${u}: ${i.error ?? i.status} (on ${fmtSet(i.foundOn)})`) : ["None."]),
  ``,
  `## Slowest pages`,
  ...timed.slice(0, 25).map(([k, p]) => `- ${k}: ${p.ms} ms${p.cache ? ` (cache ${p.cache})` : ""}`),
  ``,
].join("\n");

await mkdir(OUT, { recursive: true });
const ser = (m) => Object.fromEntries([...m].map(([k, v]) => [k, { ...v, foundOn: v.foundOn ? [...v.foundOn] : undefined }]));
await writeFile(`${OUT}/site-check.json`, JSON.stringify({ summary, byType: kindRows, pages: ser(pages), brokenLinks: ser(new Map(brokenLinks)), brokenImages: ser(new Map(brokenImages)) }, null, 1));
await writeFile(`${OUT}/site-check.md`, md);
console.log(md.split("## Broken pages")[0]);
console.log(`Report: ${OUT}/site-check.md`);
process.exit(summary.brokenPages || summary.brokenLinks || summary.brokenImages || summary.slowPages || summary.intermittent ? 1 : 0);
