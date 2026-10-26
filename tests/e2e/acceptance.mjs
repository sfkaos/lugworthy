// End-to-end acceptance checks (doc 15). Run against a live server:
//   BASE_URL=http://localhost:3000 node tests/e2e/acceptance.mjs
import { createRequire } from "node:module";
// Uses the project dependency if installed, else a globally available Playwright.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); }
};
const assert = (c, msg) => { if (!c) throw new Error(msg); };

const browser = await chromium.launch();
const page = await browser.newPage();

await check("AC-1 filter 36–40 mm + automatic + 200 m+, shareable URL", async () => {
  await page.goto(`${BASE}/watches?dia=36-40&mov=automatic&wr=200`);
  const count = await page.locator("main h1 + p").innerText();
  const facts = await page.locator("article p.tabular").allInnerTexts();
  assert(facts.length > 0, "no results");
  for (const f of facts) {
    const d = Number(f.match(/([\d.]+)\s*mm/)?.[1]);
    const wr = Number(f.match(/(\d+)\s*m(?!m)/)?.[1]);
    assert(d >= 36 && d <= 40, `diameter out of range: ${f}`);
    assert(wr >= 200, `water resistance too low: ${f}`);
  }
  await page.reload();
  assert((await page.locator("main h1 + p").innerText()) === count, "reload changed result count");
  const checked = await page.getByRole("checkbox", { name: /Automatic/ }).first().isChecked();
  assert(checked, "Automatic not checked after reload");
});

await check("AC-1 clicking a facet updates URL and counts", async () => {
  await page.goto(`${BASE}/watches`);
  const before = await page.locator("main h1 + p").innerText();
  await page.getByRole("checkbox", { name: /Quartz/ }).first().click();
  await page.waitForURL(/mov=quartz/);
  await page.waitForFunction((b) => document.querySelector("main h1 + p")?.textContent !== b, before);
});

await check("AC-2 variant change updates price and URL without reload", async () => {
  await page.goto(`${BASE}/brands/vaer/c5-postmaster-usps-collab-40mm-usa`);
  await page.evaluate(() => (window.__marker = 1));
  const price0 = await page.locator("span.text-3xl").innerText();
  await page.getByRole("radio").nth(1).check();
  await page.waitForURL(/\?v=1/);
  const price1 = await page.locator("span.text-3xl").innerText();
  assert(price0 !== price1, `price did not change (${price0})`);
  assert(await page.evaluate(() => window.__marker === 1), "page reloaded");
});

// Run with IMAGES_PUBLIC=all when the server shows brand-site photos (the image policy setting).
if (process.env.IMAGES_PUBLIC === "all") await check("Brand-site photos show with credit, outlines where missing", async () => {
  await page.goto(`${BASE}/brands/dryden`);
  assert((await page.locator("article img").count()) > 0, "no watch photos on /brands/dryden");
  const href = await page.locator('article a[href^="/brands/dryden/"]').first().getAttribute("href");
  await page.goto(`${BASE}${href}`);
  assert(await page.getByText(/Images © Dryden/).count(), "no image credit on the watch page");
  await page.goto(`${BASE}/brands/zelos-watches/helmsman-ss-carbon`);
  assert((await page.locator("figure svg").count()) > 0, "no outline for a watch without photos");
});
else await check("AC-3 unlicensed brand pages show no brand images", async () => {
  for (const url of ["/brands/zelos-watches", "/brands/zelos-watches/helmsman-ss-carbon", "/"]) {
    await page.goto(`${BASE}${url}`);
    const imgs = await page.locator("img").count();
    assert(imgs === 0, `${url} has ${imgs} <img>`);
    const og = await page.locator('meta[property="og:image"]').count();
    assert(og === 0, `${url} has og:image`);
  }
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert(!sm.includes("image:image"), "sitemap has image tags");
});

await check("AC-8 compare 4 models, differences-only hides equal rows", async () => {
  const ids = "lorier~falcon,lorier~astra,zelos-watches~helmsman-ss-carbon,raven~mctp-42mm-diver";
  await page.goto(`${BASE}/compare?ids=${ids}`);
  const all = await page.locator("tbody tr").count();
  await page.goto(`${BASE}/compare?ids=${ids}&diff=1`);
  const diff = await page.locator("tbody tr").count();
  assert(await page.locator("thead th").count() === 5, "expected 4 model columns");
  assert(diff < all, `diff rows ${diff} not fewer than ${all}`);
});

await check("FR-10 compare tray persists in localStorage", async () => {
  await page.goto(`${BASE}/watches`);
  await page.evaluate(() => localStorage.removeItem("lw.compare"));
  await page.reload();
  await page.getByRole("button", { name: "Compare", exact: true }).nth(0).click();
  await page.getByRole("button", { name: "Compare", exact: true }).nth(0).click();
  await page.reload();
  const tray = page.getByRole("region", { name: "Compare" });
  await tray.waitFor({ timeout: 5000 });
  assert((await tray.innerText()).includes("2 watches"), "tray should hold 2 watches after reload");
});

await check("AC-9 outbound click redirects with UTM", async () => {
  const res = await fetch(`${BASE}/out/${encodeURIComponent("lorier--falcon--0")}?from=test`, { redirect: "manual" });
  assert(res.status === 302, `status ${res.status}`);
  const loc = res.headers.get("location") ?? "";
  assert(loc.startsWith("https://lorierwatches.com/products/") && loc.includes("utm_source=lugworthy"), loc);
});

await check("AC-10 Product JSON-LD present", async () => {
  await page.goto(`${BASE}/brands/zelos-watches/helmsman-ss-carbon`);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(ld);
  assert(data[0]["@type"] === "Product" && data[0].offers.priceCurrency === "USD", "bad Product JSON-LD");
});

await check("AC-12 no checkout or payment UI", async () => {
  for (const url of ["/", "/watches", "/brands/lorier/falcon"]) {
    await page.goto(`${BASE}${url}`);
    const txt = (await page.locator("body").innerText()).toLowerCase();
    assert(!/add to cart|checkout|pay now/.test(txt), `${url} mentions checkout`);
  }
});

await check("Drafts and hidden brands are not public", async () => {
  const r1 = await fetch(`${BASE}/brands/citizen`);
  const r2 = await fetch(`${BASE}/brands/quasar`);
  assert(r1.status === 404 && r2.status === 404, `${r1.status} ${r2.status}`);
});

await browser.close();
for (const r of results) console.log(r.join("  "));
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
