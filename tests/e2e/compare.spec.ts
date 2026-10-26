import { expect, test } from "@playwright/test";

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

  await page.getByRole("switch").click();
  await expect(page).toHaveURL(/diff=1/);
  const diff = await page.locator("tbody tr").count();
  expect(diff).toBeLessThan(all);
  expect(diff).toBeGreaterThan(0);
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
