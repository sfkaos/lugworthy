import { expect, test } from "@playwright/test";
import { firstBrandWithWatches, firstWatchHref, imageReport, loadAllImages } from "./helpers";

// Every brand and watch photo should show. Photos come from the crawler (stored in R2);
// a watch with no photo falls back to a drawn case outline, which counts as missing here.
const MIN_SHARE = Number(process.env.MIN_PHOTO_SHARE ?? 0.9);

async function cardPhotoShare(page: import("@playwright/test").Page) {
  return page.locator("main article").evaluateAll((cards) => {
    const withPhoto = cards.filter((c) => c.querySelector("img"));
    return { cards: cards.length, withPhoto: withPhoto.length };
  });
}

for (const path of ["/", "/watches", "/styles/diver", "BRAND", "WATCH"]) {
  const label = path === "BRAND" ? "a brand page" : path === "WATCH" ? "a watch page" : path;
  test(`every image on ${label} loads`, async ({ page }) => {
    const target = path === "BRAND" ? await firstBrandWithWatches(page) : path === "WATCH" ? await firstWatchHref(page) : path;
    await page.goto(target);
    await loadAllImages(page);
    const broken = (await imageReport(page)).filter((i) => !i.ok);
    expect(broken, `broken images on ${target}:\n${broken.map((b) => b.src).join("\n")}`).toEqual([]);
  });
}

test("watch cards on /watches show photos", async ({ page }) => {
  await page.goto("/watches");
  const s = await cardPhotoShare(page);
  expect(s.cards).toBeGreaterThan(0);
  expect(s.withPhoto / s.cards, `${s.withPhoto} of ${s.cards} watch cards have a photo`).toBeGreaterThanOrEqual(MIN_SHARE);
});

test("watch cards on a brand page show photos", async ({ page }) => {
  await page.goto(await firstBrandWithWatches(page));
  const s = await cardPhotoShare(page);
  expect(s.withPhoto / s.cards, `${s.withPhoto} of ${s.cards} watch cards have a photo`).toBeGreaterThanOrEqual(MIN_SHARE);
});

test("a watch page shows its photo gallery with credit", async ({ page }) => {
  await page.goto(await firstWatchHref(page));
  await expect(page.locator("main figure img").first()).toBeVisible();
  await expect(page.locator("main figure figcaption")).not.toBeEmpty();
});

test("brand pages with watches show the brand logo", async ({ page }) => {
  await page.goto("/brands?specs=1");
  const s = await page.locator("main article").evaluateAll((cards) => ({ cards: cards.length, logos: cards.filter((c) => c.querySelector("img")).length }));
  expect(s.logos / s.cards, `${s.logos} of ${s.cards} brand cards have a logo`).toBeGreaterThanOrEqual(MIN_SHARE);
});
