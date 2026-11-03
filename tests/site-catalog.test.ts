import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { loadAllBrandCatalogs, loadCatalogIndex } from "@/lib/brands/media";
import { queryWatches } from "@/lib/brands/api";
import { snapshotCatalog } from "@/lib/data";
import { middleware } from "@/middleware";

// These tests check the "keep images back until licensed" setting.
process.env.IMAGES_PUBLIC = "none";

describe("watches crawled from brand sites", async () => {
  const site = await loadAllBrandCatalogs();
  const index = await loadCatalogIndex();
  const hidden = snapshotCatalog(index, site);
  process.env.IMAGES_PUBLIC = "all";
  const shown = snapshotCatalog(index, site);
  process.env.IMAGES_PUBLIC = "none";

  it("turns crawled watches into site models and drops straps, pens and clocks", () => {
    const models = shown.models.filter((m) => m.origin === "site");
    expect(models.length).toBeGreaterThan(500);
    expect(models.some((m) => /pouch|dial set|klokke/i.test(m.name))).toBe(false);
    expect(models.every((m) => m.variants.length > 0 && m.variants.every((v) => v.priceUsd > 0))).toBe(true);
  });
  it("shows photos only when allowed", () => {
    // Every watch whose crawl found photos shows them (some shop listings have none).
    const withPhotos = new Set(site.flatMap((c) => c.watches.filter((w) => w.images.length || w.image).map((w) => w.url)));
    const crawled = shown.models.filter((m) => m.origin === "site" && withPhotos.has(m.sourceUrl!));
    expect(crawled.length).toBeGreaterThan(500);
    expect(crawled.every((m) => m.images!.length > 0)).toBe(true);
    expect(hidden.models.some((m) => m.images?.length)).toBe(false);
    const dryden = shown.publishedBrands().find((b) => b.slug === "dryden")!;
    process.env.IMAGES_PUBLIC = "all";
    expect(shown.logoFor(dryden)).toMatch(/^https:/);
    process.env.IMAGES_PUBLIC = "none";
    expect(hidden.logoFor(dryden)).toBeNull();
  });
  it("marks sold-out watches", () => {
    const sold = shown.models.filter((m) => m.origin === "site" && m.soldOut);
    expect(sold.length).toBeGreaterThan(0);
    expect(sold.every((m) => m.status === "sold_out" || m.status === "preorder")).toBe(true);
  });
  it("serves them through GET /watches with the site's filters", () => {
    process.env.IMAGES_PUBLIC = "all";
    const r = queryWatches(shown, new URLSearchParams("brand=BRD-0191&soldOut=false&limit=200"));
    process.env.IMAGES_PUBLIC = "none";
    expect(r.meta.total).toBeGreaterThan(0);
    expect(r.data.every((w) => w.brandId === "BRD-0191" && !w.soldOut)).toBe(true);
    expect(r.data[0].image?.url).toMatch(/^https:/);
  });
});

describe("api.lugworthy.com", () => {
  const call = (url: string, method = "GET") => middleware(new NextRequest(url, { method, headers: { host: new URL(url).host } }));
  it("maps the API host's root to /api/v1", () => {
    const res = call("https://api.lugworthy.com/brands/BRD-0348");
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://api.lugworthy.com/api/v1/brands/BRD-0348");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
  it("answers CORS preflight and hides the website on the API host", async () => {
    expect(call("https://api.lugworthy.com/brands", "OPTIONS").status).toBe(204);
    expect(call("https://api.lugworthy.com/../brands/lorier").status).not.toBe(500);
    expect(call("https://lugworthy.com/brands/lorier").headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("crawled watch names and URLs", async () => {
  const { decodeEntities, watchSlug } = await import("@/lib/catalog/site-models");
  it("decodes HTML entities in shop titles", () => {
    expect(decodeEntities("Worldmaster Prestige &#8220;Krzysztof&#8221; &amp; Co &#x2013; Blue")).toBe("Worldmaster Prestige “Krzysztof” & Co – Blue");
  });
  it("turns percent-encoded handles into short stable slugs", () => {
    const s = watchSlug("e4-b8-8a-e4-b8-8b-e5-9d-a1-e6-96-b9-e5-bd-a2-e6-b0-b4-e6-b3-a5-e9-8c-b6-e6-b9-96");
    expect(s).toMatch(/^watch-[0-9a-f]{8}$/);
    expect(watchSlug("e4-b8-8a-e4-b8-8b-e5-9d-a1-e6-96-b9-e5-bd-a2-e6-b0-b4-e6-b3-a5-e9-8c-b6-e6-b9-96")).toBe(s);
    expect(watchSlug("4d-horse-golden")).toBe("4d-horse-golden");
    expect(watchSlug("e3-80-90outlet-e3-80-91the-watch-stand-single-white")).toMatch(/^outlet-the-watch-stand-single-white-[0-9a-f]{8}$/);
    expect(watchSlug("d-e1-bb-a9c-eye-dial-made-to-order")).toMatch(/^d-c-eye-dial-made-to-order-[0-9a-f]{8}$/);
    expect(watchSlug("ahrens-automatic-fireball-red-cd-1061-22")).toBe("ahrens-automatic-fireball-red-cd-1061-22");
  });
  it("drops upgrade and trade-in listings", async () => {
    const { snapshotCatalog } = await import("@/lib/data");
    const c = snapshotCatalog(await loadCatalogIndex(), await loadAllBrandCatalogs());
    expect(c.models.some((m) => /回娘家/.test(m.name))).toBe(false);
    expect(c.models.some((m) => /&#\d+;|&amp;/.test(m.name))).toBe(false);
    // No percent-encoded UTF-8 left in a slug ("e3-80-90outlet", "d-e1-bb-a9c"); "red-cd-10" is fine.
    const encoded = c.models.filter((m) => m.origin === "site" && /(?<![0-9a-z])e[0-9a-f]-[89ab][0-9a-f]-[89ab][0-9a-f]/.test(m.slug));
    expect(encoded.map((m) => m.slug)).toEqual([]);
  }, 60_000); // reads every crawled watch file
});
