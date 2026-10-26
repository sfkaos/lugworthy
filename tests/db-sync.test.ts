// Sheet -> database -> catalog, on an in-memory Postgres (PGlite) with the real migrations.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { findBrand, queryBrands, parseBrandQuery, apiWatches } from "@/lib/brands/api";
import { snapshotRows } from "@/lib/brands/source";
import { Catalog, snapshotCatalog } from "@/lib/data";
import type { Db } from "@/lib/db/client";
import { readBrandCatalog, readCatalog } from "@/lib/db/read";
import { importCatalogDir } from "@/lib/sync/catalog";
import { recordSync, syncBrandsFromRows } from "@/lib/sync/sheet";

let db: Db;
const rows = snapshotRows();

async function catalogFromDb() {
  const snap = await readCatalog(db);
  return new Catalog({ brands: snap.brands, source: "database", syncedAt: snap.syncedAt }, undefined, snap.index);
}

beforeAll(async () => {
  const pg = new PGlite();
  db = drizzle(pg, { schema: s }) as unknown as Db;
  await migrate(drizzle(pg), { migrationsFolder: "db/migrations" });
}, 60_000);

describe("sheet sync", () => {
  it("loads every brand and matches the snapshot catalog", async () => {
    const r = await recordSync(db, "sheet", () => syncBrandsFromRows(db, rows));
    expect(r).toEqual({ brands: 1437, published: 1274, removed: 0 });
    const fromDb = await catalogFromDb();
    const fromSnap = snapshotCatalog();
    expect(fromDb.publishedBrands().map((b) => b.slug)).toEqual(fromSnap.publishedBrands().map((b) => b.slug));
    expect(fromDb.syncedAt).not.toBeNull();
    const a = fromDb.getBrand("lorier")!, b = fromSnap.getBrand("lorier")!;
    expect(a).toEqual(b);
  }, 60_000);

  it("is repeatable, follows renames and hides removed rows", async () => {
    const changed = rows.rows
      .filter((r) => r[0] !== "BRD-0001")
      .map((r) => (r[0] === "BRD-0348" ? [r[0], "Lorier NYC", ...r.slice(2)] : r));
    const r = await syncBrandsFromRows(db, { ...rows, rows: changed });
    expect(r.removed).toBe(1);
    const c = await catalogFromDb();
    expect(c.brandById("BRD-0348")!.slug).toBe("lorier-nyc");
    expect(c.modelsForBrand("lorier-nyc").length).toBeGreaterThan(0);
    expect(c.brandById("BRD-0001")!.status).toBe("hidden");
    // Put things back for the next tests.
    await syncBrandsFromRows(db, rows);
    expect((await catalogFromDb()).brandById("BRD-0001")!.status).toBe("published");
  }, 60_000);

  it("keeps fields managed outside the sheet", async () => {
    await db.update(s.brands).set({ imageLicenseStatus: "granted" }).where(eq(s.brands.brandCode, "BRD-0348"));
    await syncBrandsFromRows(db, rows);
    expect((await catalogFromDb()).brandById("BRD-0348")!.imageLicenseStatus).toBe("granted");
    await db.update(s.brands).set({ imageLicenseStatus: "none" }).where(eq(s.brands.brandCode, "BRD-0348"));
  }, 60_000);

  it("refuses a nearly empty sheet", async () => {
    await expect(syncBrandsFromRows(db, { ...rows, rows: rows.rows.slice(0, 5) })).rejects.toThrow(/refusing/);
  });

  it("stores no private columns", async () => {
    const all = JSON.stringify(await db.select().from(s.brands));
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

describe("catalog import", () => {
  it("imports the crawler's files and serves them through the API", async () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    const crawledAt = "2026-10-26T12:00:00.000Z";
    writeFileSync(join(dir, "index.json"), JSON.stringify({ generatedAt: crawledAt, brands: [{ brandId: "BRD-0348", status: "ok", brandImageUrl: "https://lorierwatches.com/logo.png", watchCount: 2, crawledAt }, { brandId: "BRD-9999", status: "ok", brandImageUrl: null, watchCount: 0, crawledAt }] }));
    const file = (id: string, extra: object) => writeFileSync(join(dir, `${id}.json`), JSON.stringify({ brandId: id, brandName: "x", website: "https://x", crawledAt, status: "ok", platform: "shopify", brandImage: null, attribution: null, imageRights: "unknown", watches: [], ...extra }));
    file("BRD-9999", {});
    const watch = (slug: string, n: number) => ({
      id: `BRD-0348/${slug}`, name: slug, url: `https://lorierwatches.com/products/${slug}`,
      image: { url: `https://cdn/${slug}-0.jpg`, width: 800, height: 800 },
      images: Array.from({ length: n }, (_, i) => ({ url: `https://cdn/${slug}-${i}.jpg`, width: 800, height: 800 })),
      priceMinor: 59900, currency: "USD", available: slug !== "hydra", specs: { caseDiameterMm: 39 }, hash: "h",
      availability: slug === "hydra" ? "sold_out" : "in_stock", soldOut: slug === "hydra", availabilityCheckedAt: crawledAt,
      availabilityHistory: slug === "hydra" ? [{ at: "2026-10-01T00:00:00.000Z", availability: "in_stock" }, { at: crawledAt, availability: "sold_out" }] : [],
      description: "A dive watch.", productType: "Watch", tags: ["dive"], options: [{ name: "Strap", values: ["Steel", "Rubber"] }],
      variants: [{ title: "Steel", sku: "F-1", priceMinor: 59900, compareAtMinor: null, available: true, options: ["Steel"] }],
      specsRaw: { "Water resistance": "200m" },
    });
    file("BRD-0348", {
      brandName: "Lorier", website: "https://lorierwatches.com", attribution: "Images © Lorier, from lorierwatches.com",
      brandImage: { url: "https://lorierwatches.com/logo.png", kind: "logo", sourcePage: "https://lorierwatches.com/", width: 400, height: 100 },
      watches: [watch("falcon", 3), watch("hydra", 1)],
    });

    const r = await importCatalogDir(db, dir);
    expect(r).toEqual({ brands: 1, watches: 2, images: 4, skipped: ["BRD-9999"] });
    // A second import replaces, not duplicates.
    expect((await importCatalogDir(db, dir)).images).toBe(4);

    const c = await catalogFromDb();
    expect(c.mediaFor("BRD-0348")?.watchCount).toBe(2);
    const detail = await readBrandCatalog(db, "BRD-0348");
    expect(detail?.watches.map((w) => w.images.length)).toEqual([3, 1]);
    expect(detail?.watches[0].image?.url).toBe("https://cdn/falcon-0.jpg");

    const internal = findBrand(c, "BRD-0348", "all", detail)!;
    expect(internal.image?.url).toBe("https://lorierwatches.com/logo.png");
    expect(internal.watchCount).toBe(2);
    const lorier = c.brandById("BRD-0348")!;
    expect(apiWatches(lorier, detail, "all").data[0].images).toHaveLength(3);
    expect(apiWatches(lorier, detail, "lugworthy").data[0].images).toHaveLength(0);
    expect(queryBrands(c, parseBrandQuery(new URLSearchParams("hasImages=true")), "all").total).toBe(1);

    // Detail fields and sold-out tracking.
    const falcon = detail!.watches[0], hydra = detail!.watches[1];
    expect(falcon.specsRaw).toEqual({ "Water resistance": "200m" });
    expect(falcon.options?.[0].values).toEqual(["Steel", "Rubber"]);
    expect(falcon.variants?.[0].sku).toBe("F-1");
    expect(hydra.soldOut).toBe(true);
    expect(hydra.availabilityHistory?.map((e) => e.availability)).toEqual(["in_stock", "sold_out"]);
    expect(c.mediaFor("BRD-0348")?.soldOutCount).toBe(1);
    expect(apiWatches(lorier, detail, "all", true).data.map((w) => w.name)).toEqual(["hydra"]);
  }, 60_000);

  it("keeps availability history when watches are replaced", async () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    const crawledAt = "2026-11-02T12:00:00.000Z";
    writeFileSync(join(dir, "index.json"), JSON.stringify({ generatedAt: crawledAt, brands: [{ brandId: "BRD-0348", status: "ok", brandImageUrl: null, watchCount: 1, crawledAt }] }));
    writeFileSync(join(dir, "BRD-0348.json"), JSON.stringify({
      brandId: "BRD-0348", brandName: "Lorier", website: "https://lorierwatches.com", crawledAt, status: "ok", platform: "shopify",
      brandImage: null, attribution: null, imageRights: "unknown",
      watches: [{ id: "BRD-0348/hydra", name: "hydra", url: "https://x/hydra", image: null, images: [], priceMinor: null, currency: null, available: true, specs: {},
        availability: "in_stock", soldOut: false, availabilityCheckedAt: crawledAt, availabilityHistory: [{ at: crawledAt, availability: "in_stock" }] }],
    }));
    await importCatalogDir(db, dir);
    const detail = await readBrandCatalog(db, "BRD-0348");
    expect(detail!.watches[0].availabilityHistory?.map((e) => e.availability)).toEqual(["in_stock", "sold_out", "in_stock"]);
  }, 60_000);
});
