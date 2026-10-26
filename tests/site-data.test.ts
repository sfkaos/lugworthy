// The per-page database queries (lib/site-data.ts) against the in-memory catalog code they replace
// (lib/filters.ts browse(), textScore(), Catalog), on the same snapshot data.
import { beforeAll, describe, expect, it } from "vitest";
import { loadAllBrandCatalogs, loadCatalogIndex } from "@/lib/brands/media";
import { snapshotCatalog, type Catalog } from "@/lib/data";
import { browse, parseFilters, textScore, typoVariants, type Filters } from "@/lib/filters";
import { minPriceUsd, modelId } from "@/lib/model-utils";
import { brandDirectory, brandPage, browseWatches, modelPage, searchSite, siteDb, siteStats } from "@/lib/site-data";

let old: Catalog;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  old = snapshotCatalog(await loadCatalogIndex(), await loadAllBrandCatalogs());
  await siteDb();
}, 120_000);

const CASES: Record<string, string>[] = [
  {},
  { mov: "automatic" },
  { mov: "automatic,quartz", wr: "100" },
  { style: "diver", dia: "38-42" },
  { price: "-500", sort: "price_asc" },
  { price: "300-1200", l2l: "-48", sort: "diameter_desc" },
  { thk: "-12", sort: "thinnest" },
  { dial: "blue,green", strap: "bracelet" },
  { cal: "miyota_9015", avail: "in_stock" },
  { country: "US,DE", crystal: "sapphire" },
  { q: "gmt" },
  { q: "dive watch automatic" },
  { q: "seiko nh35", sort: "price_desc" },
  { q: "chronogrph" }, // one typo
  { q: "lorier" },
  { mov: "automatic", page: "3" },
];

describe("browseWatches matches browse()", () => {
  for (const c of CASES) {
    it(JSON.stringify(c), async () => {
      const f: Filters = parseFilters(c);
      const a = browse(old.publishedModels(), f);
      const b = await browseWatches(f);
      expect(b.total).toBe(a.total);
      expect(b.pages).toBe(a.pages);
      expect(b.page).toBe(a.page);
      expect(b.counts).toEqual(a.counts);
      expect(b.wrCounts).toEqual(a.wrCounts);
      expect(b.items.length).toBe(a.items.length);
      // Ties may come in a different order; the sort key of each slot must agree.
      const sort = f.sort ?? (f.q ? "relevance" : "newest");
      const key = (m: (typeof a.items)[number]) =>
        sort === "relevance" ? textScore(m, f.q!)
        : sort.startsWith("price") ? minPriceUsd(m)
        : sort.startsWith("diameter") ? m.specs.caseDiameterMm
        : sort === "thinnest" ? m.specs.thicknessMm ?? m.specs.thicknessInclCrystalMm
        : null;
      if (sort !== "newest") expect(b.items.map(key)).toEqual(a.items.map(key));
      if (!f.q && !f.page && a.total <= 24) expect(new Set(b.items.map(modelId))).toEqual(new Set(a.items.map(modelId)));
    });
  }

  it("finds every match a full scan finds", async () => {
    for (const q of ["blue", "titanium", "38mm", "nh35", "skeleton"]) {
      const want = old.publishedModels().filter((m) => textScore(m, q) > 0).length;
      expect((await browseWatches({ q })).total, q).toBe(want);
    }
  });
});

describe("other pages", () => {
  it("stats", async () => {
    expect(await siteStats()).toEqual(old.brandStats());
  });

  it("brand page has the same brand and watches", async () => {
    for (const slug of ["lorier", "oak-and-oscar", "dryden", "22-design-studio", "11i11-saat"]) {
      const want = old.getBrand(slug);
      const got = await brandPage(slug);
      if (!want) {
        expect(got).toBeNull();
        continue;
      }
      // The database keeps missing facts and founding year as null.
      expect(got!.brand).toEqual({ ...want, facts: want.facts ?? null, founded: want.founded ?? null });
      expect(got!.models.map(modelId)).toEqual(old.modelsForBrand(slug).map(modelId));
    }
  });

  it("watch page has the full model and four similar watches", async () => {
    const m = old.modelsForBrand("lorier")[0];
    const got = await modelPage("lorier", m.slug);
    expect(got!.model).toEqual(m);
    expect(got!.more.length).toBe(Math.min(4, old.modelsForBrand("lorier").length - 1));
    expect(got!.similar).toHaveLength(4);
    expect(got!.similar.every((x) => x.brandSlug !== "lorier")).toBe(true);
  });

  it("brand directory filters and pages", async () => {
    const all = old.publishedBrands();
    const d = await brandDirectory({ country: "US" }, 60);
    expect(d.total).toBe(all.filter((b) => b.country === "US").length);
    expect(d.shown).toHaveLength(Math.min(60, d.total));
    const p2 = await brandDirectory({ page: "2" }, 60);
    expect(p2.page).toBe(2);
    expect(p2.total).toBe(all.length);
  });

  it("search finds brands by prefix and with one typo", async () => {
    expect((await searchSite("lori")).brands.map((b) => b.brand.slug)).toContain("lorier");
    expect((await searchSite("dryden")).brands[0].brand.slug).toBe("dryden");
    const typo = await searchSite("chronogrph");
    expect(typo.models.length).toBeGreaterThan(0);
  });

  it("typo variants cover one edit", () => {
    const v = new Set(typoVariants("diver"));
    for (const w of ["diver", "dive", "divers", "dvier", "diwer", "idver"]) expect(v.has(w), w).toBe(true);
    expect(v.has("dvr")).toBe(false);
  });
});
