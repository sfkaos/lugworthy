import { expect, test } from "@playwright/test";
import { firstBrandWithWatches, firstWatchHref, watchForErrors } from "./helpers";

// Every kind of page loads, has a heading, header and footer, and throws no errors.
const STATIC = ["/", "/watches", "/brands", "/videos", "/editorial", "/en-punto", "/for-brands", "/about", "/privacy", "/takedown", "/image-policy", "/compare", "/search", "/search?q=diver", "/styles/diver", "/styles/dress"];

for (const path of STATIC) {
  test(`page loads: ${path}`, async ({ page }) => {
    const w = watchForErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    expect(await page.title()).toMatch(/Lugworthy/);
    w.expectNone();
  });
}

test("hub pages load: a country and a caliber", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const kind of ["countries", "calibers"]) {
    const url = sitemap.match(new RegExp(`<loc>([^<]*/${kind}/[^<]+)</loc>`))?.[1];
    expect(url, `no /${kind}/ page in the sitemap`).toBeTruthy();
    const res = await page.goto(new URL(url!).pathname);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("a brand page loads with its watches", async ({ page }) => {
  const href = await firstBrandWithWatches(page);
  const w = watchForErrors(page);
  await page.goto(href);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  expect(await page.locator("main article").count()).toBeGreaterThan(0);
  w.expectNone();
});

test("a watch page loads with price, specs and a buy link", async ({ page }) => {
  const href = await firstWatchHref(page);
  const w = watchForErrors(page);
  await page.goto(href);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("#specs-h")).toBeVisible();
  await expect(page.locator("span.text-3xl").first()).toContainText(/\d/);
  await expect(page.locator('a[href^="/out/"]').first()).toBeVisible();
  w.expectNone();
});

test("watch page has Product JSON-LD", async ({ page }) => {
  await page.goto(await firstWatchHref(page));
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const items = blocks.flatMap((b) => [JSON.parse(b)].flat());
  const product = items.find((x) => x["@type"] === "Product");
  expect(product, "no Product JSON-LD").toBeTruthy();
  expect(product.name).toBeTruthy();
  expect(product.offers).toBeTruthy();
});

test("unknown pages return a 404 page", async ({ page }) => {
  for (const path of ["/no-such-page", "/brands/no-such-brand-xyz", "/brands/no-such-brand-xyz/no-such-watch"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("link", { name: "Browse watches" })).toBeVisible();
  }
});

test("draft and hidden brands are not public", async ({ request }) => {
  for (const slug of ["citizen", "quasar"]) expect((await request.get(`/brands/${slug}`)).status(), slug).toBe(404);
});

test("no checkout or payment UI anywhere", async ({ page }) => {
  for (const path of ["/", "/watches", await firstWatchHref(page)]) {
    await page.goto(path);
    expect((await page.locator("body").innerText()).toLowerCase()).not.toMatch(/add to cart|checkout|pay now/);
  }
});

test("robots.txt and sitemap.xml are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Sitemap:/i);
  const sm = await request.get("/sitemap.xml");
  expect(sm.status()).toBe(200);
  const locs = (await sm.text()).match(/<loc>/g)?.length ?? 0;
  expect(locs).toBeGreaterThan(1000);
});

test("header links go to the right pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const [name, path] of [["Watches", "/watches"], ["Brands", "/brands"]] as const) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main h1")).toBeVisible();
  }
});
