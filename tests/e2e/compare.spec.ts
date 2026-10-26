import { expect, test } from "@playwright/test";
import { firstBrandWithWatches } from "./helpers";

test("compare tray: add 4 watches, it persists, and the compare page shows them side by side", async ({ page }) => {
  await page.goto("/watches");
  await page.evaluate(() => localStorage.removeItem("lw.compare"));
  await page.reload();
  const buttons = page.locator("main article").getByRole("button", { name: "Compare", exact: true });
  for (let i = 0; i < 4; i++) await buttons.first().click();
  const tray = page.getByRole("region", { name: "Compare" });
  await expect(tray).toContainText("4 watches");

  // A fifth one is refused with a message.
  await buttons.first().click();
  await expect(page.getByRole("status").first()).toBeVisible();

  await page.reload();
  await expect(tray).toContainText("4 watches");

  await tray.getByRole("link").last().click();
  await expect(page).toHaveURL(/\/compare\?ids=/);
  await expect(page.locator("thead th")).toHaveCount(5);
  const all = await page.locator("tbody tr").count();

  expect(all).toBeGreaterThan(3);
});

test("'Only differences' hides rows where every watch is the same", async ({ page }) => {
  // Watches from one brand share most specs, so some rows must disappear.
  const brand = await firstBrandWithWatches(page);
  await page.goto(brand);
  const ids = (await page.locator("main article h3 a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))).slice(0, 4).map((h) => h.split("/").slice(2, 4).join("~"));
  expect(ids.length).toBeGreaterThanOrEqual(2);
  await page.goto(`/compare?ids=${ids.join(",")}`);
  await expect(page.locator("thead th")).toHaveCount(ids.length + 1);
  const all = await page.locator("tbody tr:has(td)").count();
  await page.getByRole("switch").click();
  await expect(page).toHaveURL(/diff=1/);
  const rows = await page.locator("tbody tr:has(td)").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim())));
  expect(rows.length).toBeLessThan(all);
  for (const r of rows) expect(new Set(r).size, `row with identical values: ${r.join(" | ")}`).toBeGreaterThan(1);
});

test("removing a watch from the tray", async ({ page }) => {
  await page.goto("/watches");
  await page.evaluate(() => localStorage.removeItem("lw.compare"));
  await page.reload();
  const buttons = page.locator("main article").getByRole("button", { name: "Compare", exact: true });
  await buttons.first().click();
  await buttons.first().click();
  const tray = page.getByRole("region", { name: "Compare" });
  await expect(tray).toContainText("2 watches");
  await tray.getByRole("button", { name: /^Remove/ }).first().click();
  await expect(tray).toContainText("1 watch");
});

test("empty compare page explains what to do", async ({ page }) => {
  await page.goto("/compare");
  await page.evaluate(() => localStorage.removeItem("lw.compare"));
  await page.reload();
  await expect(page.locator("main h1")).toHaveText("Compare");
});
