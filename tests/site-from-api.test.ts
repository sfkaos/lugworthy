import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { loadAllBrandCatalogs, loadCatalogIndex } from "@/lib/brands/media";
import { Catalog, snapshotCatalog } from "@/lib/data";
import { apiSourceFromEnv, fetchCatalogParts } from "@/lib/catalog/from-api";
import { parseBrandQuery, queryBrands, queryWatches } from "@/lib/brands/api";

// The site built from API responses must match the site built straight from the database.
describe("lugworthy.com built from the API", async () => {
  process.env.IMAGES_PUBLIC = "all";
  const direct = snapshotCatalog(await loadCatalogIndex(), await loadAllBrandCatalogs());
  const calls: string[] = [];
  // A fetch that answers like api.lugworthy.com, using the real query code.
  const fakeFetch = (async (input: string, init?: RequestInit) => {
    calls.push(input);
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== "Bearer tok") return new Response("{}", { status: 401 });
    const url = new URL(input);
    const sp = url.searchParams;
    const body =
      url.pathname === "/brands"
        ? (() => { const r = queryBrands(direct, parseBrandQuery(sp), "lugworthy", sp.get("detail") === "full"); return { data: r.data, meta: { pages: r.pages, syncedAt: direct.syncedAt } }; })()
        : queryWatches(direct, sp);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const parts = await fetchCatalogParts({ baseUrl: "https://api.lugworthy.com", token: "tok" }, fakeFetch);
  const viaApi = new Catalog({ brands: parts.brands, source: "api", syncedAt: parts.syncedAt }, parts.models, parts.media);
  delete process.env.IMAGES_PUBLIC;

  it("pages through every brand and watch", () => {
    expect(calls.length).toBeGreaterThan(8);
    expect(viaApi.brandStats()).toEqual(direct.brandStats());
    expect(viaApi.publishedModels().length).toBeGreaterThan(600);
  });
  it("has the same brands, logos and collections", () => {
    for (const b of direct.publishedBrands()) {
      const a = viaApi.getBrand(b.slug)!;
      expect(a, b.slug).toBeTruthy();
      expect({ ...a, sources: [], facts: null }).toEqual({ ...b, founded: b.founded ?? null, sources: [], facts: null, ownership: undefined, lugworthyFit: undefined, siteCheck: undefined, enPuntoExhibitor: false });
      expect(viaApi.modelsForBrand(b.slug).map((m) => m.slug)).toEqual(direct.modelsForBrand(b.slug).map((m) => m.slug));
    }
    const dryden = direct.getBrand("dryden")!;
    process.env.IMAGES_PUBLIC = "all";
    expect(viaApi.logoFor(viaApi.getBrand("dryden")!)).toBe(direct.logoFor(dryden));
    delete process.env.IMAGES_PUBLIC;
  });
  it("has every watch detail: variants, specs, photos, stock history, options", () => {
    for (const m of direct.publishedModels()) {
      const a = viaApi.getModel(m.brandSlug, m.slug)!;
      expect(a, `${m.brandSlug}/${m.slug}`).toBeTruthy();
      expect(a).toEqual({ ...m, published: true, images: m.images ?? [], imageCredit: m.imageCredit ?? null, availabilityHistory: m.availabilityHistory ?? [], description: m.description ?? null, options: m.options ?? [], specsRaw: m.specsRaw ?? {}, soldOut: m.soldOut ?? !m.variants.some((v) => v.available), availabilityCheckedAt: m.availabilityCheckedAt ?? null });
    }
  });
  it("gives the same compare, similar-watch and outbound-link results", () => {
    const m = direct.publishedModels().find((x) => x.origin === "site")!;
    expect(viaApi.similarModels(viaApi.getModel(m.brandSlug, m.slug)!).map((x) => x.slug)).toEqual(direct.similarModels(m).map((x) => x.slug));
    const v = m.variants[0];
    expect(viaApi.findVariant(v.id)?.variant).toEqual(v);
  });
  it("needs both the URL and the token", () => {
    expect(apiSourceFromEnv({ LUGWORTHY_API_URL: "https://api.lugworthy.com/" })).toBeNull();
    expect(apiSourceFromEnv({ LUGWORTHY_API_URL: "https://api.lugworthy.com/", BRANDS_API_TOKEN: "t" })).toEqual({ baseUrl: "https://api.lugworthy.com", token: "t" });
  });
  it("fails loudly on a bad token so the site falls back to the database", async () => {
    await expect(fetchCatalogParts({ baseUrl: "https://api.lugworthy.com", token: "nope" }, fakeFetch)).rejects.toThrow(/401/);
  });
  it("GET /watches pages past the site's 24-per-page limit", () => {
    const r = queryWatches(direct, new URLSearchParams("limit=200"));
    expect(r.data.length).toBe(200);
    const p2 = queryWatches(direct, new URLSearchParams("limit=200&page=2"));
    expect(p2.data[0].id).not.toBe(r.data[0].id);
  });
});
void NextRequest;

describe("API catalog size guard", () => {
  it("refuses to pull a huge catalog through the API, so the site reads the database", async () => {
    const f = (async (u: string) => {
      const big = u.includes("/watches");
      return new Response(JSON.stringify({ data: [], meta: { pages: big ? 120 : 1, total: big ? 23_500 : 1 } }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(fetchCatalogParts({ baseUrl: "https://api.lugworthy.com", token: "t" }, f)).rejects.toThrow(/more than the 3000/);
  });
});
