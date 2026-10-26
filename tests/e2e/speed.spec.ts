import { expect, test } from "@playwright/test";
import { firstBrandWithWatches, firstWatchHref } from "./helpers";

// Load-time limits, in milliseconds. Each page is opened once to warm the cache, then timed.
// Override with e.g. MAX_TTFB_MS=800.
const MAX = {
  ttfb: Number(process.env.MAX_TTFB_MS ?? 1000), // server response starts
  dcl: Number(process.env.MAX_DCL_MS ?? 2500), // page usable
  load: Number(process.env.MAX_LOAD_MS ?? 4000), // everything loaded
  cold: Number(process.env.MAX_COLD_MS ?? 5000), // first visit, before any cache
};

const PAGES = ["/", "/watches", "/brands", "/search?q=diver", "/styles/diver", "/compare", "/about", "BRAND", "WATCH"];

test.describe.configure({ mode: "serial" });

for (const path of PAGES) {
  const label = path === "BRAND" ? "a brand page" : path === "WATCH" ? "a watch page" : path;
  test(`${label} loads fast`, async ({ page, request }) => {
    const target = path === "BRAND" ? await firstBrandWithWatches(page) : path === "WATCH" ? await firstWatchHref(page) : path;

    // Cold-ish: a cache-busting query skips the CDN copy and shows how long a fresh render takes.
    const t0 = Date.now();
    const cold = await request.get(`${target}${target.includes("?") ? "&" : "?"}_t=${Date.now()}`);
    const coldMs = Date.now() - t0;
    expect(cold.status()).toBe(200);

    await page.goto(target); // warm
    await page.goto(target, { waitUntil: "load" });
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return { ttfb: n.responseStart - n.startTime, dcl: n.domContentLoadedEventEnd - n.startTime, load: n.loadEventEnd - n.startTime, bytes: n.transferSize };
    });
    const timings = { coldMs, ...Object.fromEntries(Object.entries(nav).map(([k, v]) => [k, Math.round(v)])) };
    test.info().annotations.push({ type: "timing", description: `${target} ${JSON.stringify(timings)}` });
    console.log(`timing ${target} ${JSON.stringify(timings)}`);

    expect.soft(coldMs, `fresh render of ${target}`).toBeLessThanOrEqual(MAX.cold);
    expect.soft(nav.ttfb, `server response on ${target}`).toBeLessThanOrEqual(MAX.ttfb);
    expect.soft(nav.dcl, `page usable on ${target}`).toBeLessThanOrEqual(MAX.dcl);
    expect.soft(nav.load, `fully loaded on ${target}`).toBeLessThanOrEqual(MAX.load);
  });
}
