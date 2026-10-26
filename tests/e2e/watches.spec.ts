import { expect, test } from "@playwright/test";
import { resultCount, toNumber, watchForErrors } from "./helpers";

test("filters 36–40 mm + automatic + 200 m, and the URL is shareable", async ({ page }) => {
  await page.goto("/watches?dia=36-40&mov=automatic&wr=200");
  const count = await resultCount(page).innerText();
  const facts = await page.locator("main article p.tabular").allInnerTexts();
  expect(facts.length, "no results").toBeGreaterThan(0);
  for (const f of facts) {
    const d = Number(f.match(/([\d.]+)\s*mm/)?.[1]);
    const wr = Number(f.match(/(\d+)\s*m(?!m)/)?.[1]);
    expect(d, f).toBeGreaterThanOrEqual(36);
    expect(d, f).toBeLessThanOrEqual(40);
    expect(wr, f).toBeGreaterThanOrEqual(200);
  }
  await page.reload();
  expect(await resultCount(page).innerText()).toBe(count);
  await expect(page.getByRole("checkbox", { name: /Automatic/ }).first()).toBeChecked();
});

test("clicking a facet updates the URL and the count", async ({ page }) => {
  const w = watchForErrors(page);
  await page.goto("/watches");
  const before = toNumber(await resultCount(page).innerText());
  await page.getByRole("checkbox", { name: /Quartz/ }).first().click();
  await page.waitForURL(/mov=quartz/);
  await expect.poll(async () => toNumber(await resultCount(page).innerText())).toBeLessThan(before);
  w.expectNone();
});

test("an active filter chip removes its filter", async ({ page }) => {
  await page.goto("/watches?mov=automatic");
  const filtered = toNumber(await resultCount(page).innerText());
  await page.getByRole("list", { name: "Active filters" }).getByRole("link").first().click();
  await expect(page).not.toHaveURL(/mov=automatic/);
  await expect.poll(async () => toNumber(await resultCount(page).innerText())).toBeGreaterThan(filtered);
});

test("text search narrows results and shows a chip", async ({ page }) => {
  await page.goto("/watches");
  const all = toNumber(await resultCount(page).innerText());
  await page.locator("#browse-q").fill("diver");
  await page.locator("#browse-q").press("Enter");
  await page.waitForURL(/q=diver/);
  const n = toNumber(await resultCount(page).innerText());
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(all);
  await expect(page.getByRole("list", { name: "Active filters" })).toContainText("diver");
});

test("search tolerates a typo", async ({ page }) => {
  await page.goto("/watches?q=chronogrph");
  expect(toNumber(await resultCount(page).innerText())).toBeGreaterThan(0);
});

test("no matches shows a helpful empty state", async ({ page }) => {
  await page.goto("/watches?q=zzqqxxnotawatch");
  expect(toNumber(await resultCount(page).innerText())).toBe(0);
  await expect(page.locator("main .card h2")).toBeVisible();
});

test("sorting by price orders the prices", async ({ page }) => {
  await page.goto("/watches?sort=price_asc");
  const prices = (await page.locator("main article span.tabular.font-semibold").allInnerTexts()).map(toNumber).filter((n) => n > 0);
  expect(prices.length).toBeGreaterThan(3);
  expect([...prices].sort((a, b) => a - b)).toEqual(prices);
});

test("pagination moves to page 2 and back", async ({ page }) => {
  await page.goto("/watches");
  const first = await page.locator("main article h3 a").first().getAttribute("href");
  const pager = page.getByRole("navigation", { name: "Pagination" });
  await pager.getByRole("link").last().click();
  await expect(page).toHaveURL(/page=2/);
  expect(await page.locator("main article h3 a").first().getAttribute("href")).not.toBe(first);
  await pager.getByRole("link").first().click();
  await expect(page).not.toHaveURL(/page=2/);
});

test("a watch card opens its watch page", async ({ page }) => {
  await page.goto("/watches");
  const link = page.locator("main article h3 a").first();
  const name = (await link.innerText()).trim();
  await link.click();
  await expect(page.locator("main h1")).toHaveText(name);
});
