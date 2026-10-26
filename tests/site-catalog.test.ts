import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { loadAllBrandCatalogs, loadCatalogIndex } from "@/lib/brands/media";
import { queryWatches } from "@/lib/brands/api";
import { snapshotCatalog } from "@/lib/data";
import { middleware } from "@/middleware";

describe("watches crawled from brand sites", async () => {
  const site = await loadAllBrandCatalogs();
  const index = await loadCatalogIndex();
  const hidden = snapshotCatalog(index, site);
  process.env.IMAGES_PUBLIC = "all";
  const shown = snapshotCatalog(index, site);
  delete process.env.IMAGES_PUBLIC;

  it("turns crawled watches into site models and drops straps, pens and clocks", () => {
    const models = shown.models.filter((m) => m.origin === "site");
    expect(models.length).toBeGreaterThan(500);
    expect(models.some((m) => /pouch|dial set|klokke/i.test(m.name))).toBe(false);
    expect(models.every((m) => m.variants.length > 0 && m.variants.every((v) => v.priceUsd > 0))).toBe(true);
  });
  it("shows photos only when allowed", () => {
    expect(shown.models.filter((m) => m.origin === "site").every((m) => m.images!.length > 0)).toBe(true);
    expect(hidden.models.some((m) => m.images?.length)).toBe(false);
    const dryden = shown.publishedBrands().find((b) => b.slug === "dryden")!;
    process.env.IMAGES_PUBLIC = "all";
    expect(shown.logoFor(dryden)).toMatch(/^https:/);
    delete process.env.IMAGES_PUBLIC;
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
    delete process.env.IMAGES_PUBLIC;
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
