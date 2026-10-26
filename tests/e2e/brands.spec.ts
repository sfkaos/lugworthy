import { expect, test } from "@playwright/test";
import { BASE_URL, firstBrandWithWatches, firstWatchHref, toNumber } from "./helpers";

test("brands index lists 60 brands a page and says how many there are", async ({ page }) => {
  await page.goto("/brands");
  expect(toNumber(await page.locator("main h1 + p").innerText())).toBeGreaterThan(1000);
  expect(await page.locator("main article").count()).toBe(60);
});

test("A–Z letter filter only shows that letter", async ({ page }) => {
  await page.goto("/brands");
  await page.getByRole("navigation", { name: "A–Z" }).getByRole("link", { name: "M", exact: true }).click();
  await expect(page).toHaveURL(/letter=M/);
  const names = await page.locator("main article h3").allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n.normalize("NFKD").trim()[0].toUpperCase(), n).toBe("M");
});

test("country filter only shows brands from that country", async ({ page }) => {
  await page.goto("/brands?country=DE");
  const places = await page.locator("main article p.text-sm.text-muted").first().innerText();
  expect(places).toMatch(/Germany/);
  expect(await page.locator("main article").count()).toBeGreaterThan(0);
});

test("brands index pagination", async ({ page }) => {
  await page.goto("/brands");
  const first = await page.locator("main article h3").first().innerText();
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link").last().click();
  await expect(page).toHaveURL(/page=2/);
  expect(await page.locator("main article h3").first().innerText()).not.toBe(first);
});

test("brand card opens the brand page, and its watches link to watch pages", async ({ page }) => {
  const href = await firstBrandWithWatches(page);
  await page.goto(href);
  const watch = page.locator("main article h3 a").first();
  const watchHref = await watch.getAttribute("href");
  expect(watchHref?.startsWith(`${href}/`)).toBeTruthy();
  await watch.click();
  await expect(page).toHaveURL(new RegExp(`${watchHref}$`));
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link").last().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("watch page variant picker changes the URL without reloading", async ({ page }) => {
  // Find a watch with more than one variant among the first few.
  await page.goto("/watches?sort=price_desc");
  const hrefs = (await page.locator("main article h3 a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).slice(0, 12);
  for (const href of hrefs) {
    await page.goto(href!);
    if ((await page.getByRole("radio").count()) < 2) continue;
    await page.evaluate(() => ((window as unknown as { __m: number }).__m = 1));
    await page.getByRole("radio").nth(1).check();
    await expect(page).toHaveURL(/[?&]v=1/);
    expect(await page.evaluate(() => (window as unknown as { __m?: number }).__m)).toBe(1);
    return;
  }
  test.skip(true, "none of the first 12 watches has variants");
});

test("outbound buy link redirects to the brand with UTM tags", async ({ page, request }) => {
  await page.goto(await firstWatchHref(page));
  const out = await page.locator('a[href^="/out/"]').first().getAttribute("href");
  const res = await request.get(out!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const loc = res.headers()["location"] ?? "";
  expect(loc).toMatch(/^https?:\/\//);
  expect(new URL(loc).host, "buy link fell back to a Lugworthy page").not.toBe(new URL(BASE_URL).host);
  expect(loc).toContain("utm_source=lugworthy");
});
