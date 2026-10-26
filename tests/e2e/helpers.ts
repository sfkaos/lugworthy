import { expect, type Page } from "@playwright/test";

export const BASE_URL = process.env.BASE_URL ?? "https://lugworthy.com";

/** Records uncaught page errors, console errors and failed same-site requests while a test runs. */
export function watchForErrors(page: Page) {
  const errors: string[] = [];
  const host = new URL(BASE_URL).host;
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.host === host && r.status() >= 400) errors.push(`${r.status()} ${u.pathname}${u.search}`);
  });
  return { errors, expectNone: () => expect(errors, errors.join("\n")).toEqual([]) };
}

/** The result count line on /watches ("1,234 watches"). */
export const resultCount = (page: Page) => page.locator("main h1 + p");

/** Parses "1,234 watches" into 1234. */
export const toNumber = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** Path of the first watch card on a page, e.g. /brands/acme/diver-40. */
export async function firstWatchHref(page: Page, from = "/watches") {
  await page.goto(from);
  const href = await page.locator("main article h3 a").first().getAttribute("href");
  expect(href, `no watch cards on ${from}`).toMatch(/^\/brands\/[^/]+\/[^/]+/);
  return href!;
}

/** Path of the first brand that lists watches, from the brands index. */
export async function firstBrandWithWatches(page: Page) {
  await page.goto("/brands?specs=1");
  const href = await page.locator("main article h3 a").first().getAttribute("href");
  expect(href).toMatch(/^\/brands\/[^/]+$/);
  return href!;
}

/** Scrolls through the page so lazy images start loading, then waits for them to finish. */
export async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 }).catch(() => {});
}

/** Every <img> on the page and whether it actually rendered. */
export function imageReport(page: Page) {
  return page.evaluate(() =>
    [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, ok: i.complete && i.naturalWidth > 0 })),
  );
}
