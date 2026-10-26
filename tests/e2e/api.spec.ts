import { expect, test } from "@playwright/test";
import { BASE_URL } from "./helpers";

// The brands API (read-only). Signed-in tests need BRANDS_API_TOKEN in the environment.
const API = process.env.API_URL ?? `${BASE_URL}/api/v1`;
const API_HOST = process.env.API_HOST_URL ?? "https://api.lugworthy.com";
const TOKEN = process.env.BRANDS_API_TOKEN;
const auth = { Authorization: `Bearer ${TOKEN}` };
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

test("index describes the API without a token", async ({ request }) => {
  const res = await request.get(API);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.version).toBe(1);
  expect(Object.keys(body.endpoints)).toContain("GET /brands");
});

for (const path of ["/brands", "/brands/BRD-0001", "/watches", "/brands/BRD-0001/watches", "/brands/BRD-0001/collections"]) {
  test(`${path} refuses requests without a token`, async ({ request }) => {
    expect((await request.get(`${API}${path}`)).status()).toBe(401);
    expect((await request.get(`${API}${path}`, { headers: { Authorization: "Bearer wrong-token" } })).status()).toBe(401);
  });
}

test("CORS preflight is allowed", async ({ request }) => {
  const res = await request.fetch(`${API}/brands`, { method: "OPTIONS" });
  expect(res.status()).toBe(204);
  expect(res.headers()["access-control-allow-origin"]).toBe("*");
});

test("api.lugworthy.com answers", async ({ request }) => {
  const res = await request.get(API_HOST, { timeout: 15_000 }).catch((e: Error) => e);
  expect(res instanceof Error ? `${API_HOST} unreachable: ${res.message.split("\n")[0]}` : res.status()).toBe(200);
});

test.describe("signed in", () => {
  test.skip(!TOKEN, "set BRANDS_API_TOKEN to run the signed-in API tests");

  test("lists brands with paging", async ({ request }) => {
    const res = await request.get(`${API}/brands?limit=5`, { headers: auth });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("private");
    const { data, meta } = await res.json();
    expect(data).toHaveLength(5);
    expect(meta.total).toBeGreaterThan(1000);
    for (const b of data) {
      expect(b.id).toMatch(/^BRD-\d{4}$/);
      expect(b.name).toBeTruthy();
      expect(b.url).toMatch(/^https:\/\/.*\/brands\//);
    }
    const p2 = await (await request.get(`${API}/brands?limit=5&page=2`, { headers: auth })).json();
    expect(p2.data[0].id).not.toBe(data[0].id);
  });

  test("caps limit at 200", async ({ request }) => {
    const { data, meta } = await (await request.get(`${API}/brands?limit=999`, { headers: auth })).json();
    expect(meta.limit).toBe(200);
    expect(data.length).toBeLessThanOrEqual(200);
  });

  test("filters brands by country and search", async ({ request }) => {
    const { data } = await (await request.get(`${API}/brands?country=DE&limit=50`, { headers: auth })).json();
    expect(data.length).toBeGreaterThan(0);
    for (const b of data) expect(b.country).toBe("DE");
    const named = await (await request.get(`${API}/brands?q=${encodeURIComponent(data[0].name)}`, { headers: auth })).json();
    expect(named.data[0].id).toBe(data[0].id);
  });

  test("one brand by ID and by slug, its watches and collections", async ({ request }) => {
    const { data } = await (await request.get(`${API}/brands?hasModels=true&limit=1`, { headers: auth })).json();
    const b = data[0];
    for (const key of [b.id, b.slug]) {
      const one = await request.get(`${API}/brands/${key}`, { headers: auth });
      expect(one.status()).toBe(200);
      expect(JSON.stringify(await one.json())).toContain(b.id);
    }
    const w = await request.get(`${API}/brands/${b.id}/watches`, { headers: auth });
    expect(w.status()).toBe(200);
    expect((await request.get(`${API}/brands/${b.id}/collections`, { headers: auth })).status()).toBe(200);
    expect((await request.get(`${API}/brands/BRD-9999`, { headers: auth })).status()).toBe(404);
  });

  test("watches match the site's filters", async ({ request, page }) => {
    const { data, meta } = await (await request.get(`${API}/watches?dia=36-40&mov=automatic&limit=50`, { headers: auth })).json();
    expect(data.length).toBeGreaterThan(0);
    for (const w of data) {
      expect(w.specs.caseDiameterMm).toBeGreaterThanOrEqual(36);
      expect(w.specs.caseDiameterMm).toBeLessThanOrEqual(40);
    }
    await page.goto("/watches?dia=36-40&mov=automatic");
    const siteCount = Number((await page.locator("main h1 + p").innerText()).replace(/[^\d]/g, ""));
    expect(meta.total).toBe(siteCount);
  });

  test("watch photos from the API load", async ({ request }) => {
    const { data } = await (await request.get(`${API}/watches?limit=20`, { headers: auth })).json();
    const urls = data.map((w: { image?: { url: string } | null }) => w.image?.url).filter(Boolean);
    expect(urls.length, "no watch has a photo in the API").toBeGreaterThan(0);
    for (const u of urls) {
      const r = await request.get(u);
      expect(r.status(), u).toBe(200);
      expect(r.headers()["content-type"], u).toMatch(/^image\//);
    }
  });

  test("never returns emails or private outreach fields", async ({ request }) => {
    const text = await (await request.get(`${API}/brands?limit=200`, { headers: auth })).text();
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(/outreach|founderEmail|contactEmail/i);
  });
});
