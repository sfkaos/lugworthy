import { expect, test } from "@playwright/test";
import { firstWatchHref, resultCount, toNumber } from "./helpers";

// Runs in the "mobile" project (Pixel 7 size) because of the @mobile tag.
for (const path of ["/", "/watches", "/brands", "/compare", "/about", "WATCH"]) {
  test(`@mobile no sideways scrolling: ${path === "WATCH" ? "watch page" : path}`, async ({ page }) => {
    await page.goto(path === "WATCH" ? await firstWatchHref(page) : path);
    const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(scroll, `page is ${scroll}px wide on a ${width}px screen`).toBeLessThanOrEqual(width + 1);
  });
}

test("@mobile main nav and search are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.locator("#site-search").fill("diver");
  await page.locator("#site-search").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=diver/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("@mobile filters open in a sheet and apply", async ({ page }) => {
  await page.goto("/watches");
  const before = toNumber(await resultCount(page).innerText());
  await page.getByRole("button", { name: "Filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("checkbox", { name: /Automatic/ }).first().click();
  await page.waitForURL(/mov=automatic/);
  await sheet.getByRole("button", { name: /^Show \d/ }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(async () => toNumber(await resultCount(page).innerText())).toBeLessThan(before);
});

test("@mobile tap targets on watch cards are big enough", async ({ page }) => {
  await page.goto("/watches");
  const box = await page.locator("main article").getByRole("button", { name: "Compare", exact: true }).first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
});
