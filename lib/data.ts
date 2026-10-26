// Read-side repository. Brands come from the database, which the sync job fills from the master
// sheet (lib/sync). Models come from the imported catalog (data/seed/models.json). Pages and the
// /api/v1 routes both read through getCatalog(), so the site and the API always agree.
// Without DATABASE_URL (local dev, tests) the checked-in snapshot and data/catalog files are used.

import { cache } from "react";
import modelsJson from "@/data/seed/models.json";
import { bandFor, buildBrands } from "./brands/build";
import { imagesVisible, loadAllBrandCatalogs, loadBrandCatalog, loadCatalogIndex, type BrandCatalog, type CatalogIndex, type CatalogIndexRow } from "./brands/media";
import { siteModelsFor } from "./catalog/site-models";
import { snapshotRows } from "./brands/source";
import { getDb } from "./db/client";
import { readBrandCatalog, readCatalog, readSiteCatalogs } from "./db/read";
import { minPriceUsd } from "./model-utils";
import type { Brand, Model } from "./types";

const seedModels = modelsJson as unknown as Model[];

export { isAvailable, minPriceUsd, modelId } from "./model-utils";

export class Catalog {
  readonly brands: Brand[];
  readonly models: Model[];
  readonly source: "database" | "snapshot";
  readonly syncedAt: string | null;
  private readonly bySlug: Map<string, Brand>;
  private readonly byId: Map<string, Brand>;
  private readonly media: Map<string, CatalogIndexRow>;

  constructor(
    data: { brands: Brand[]; source: "database" | "snapshot"; syncedAt: string | null },
    models: Model[] = seedModels,
    media?: CatalogIndex,
    siteCatalogs: BrandCatalog[] = [],
  ) {
    this.media = new Map((media?.brands ?? []).map((r) => [r.brandId, r]));
    this.source = data.source;
    this.syncedAt = data.syncedAt;
    // Copies, because the price fields below are adjusted per catalog.
    this.brands = data.brands.map((b) => ({ ...b }));
    this.byId = new Map(this.brands.map((b) => [b.brandId!, b]));
    // Watches crawled from a brand's own site replace that brand's older sample models.
    this.models = [];
    const crawled = new Set<string>();
    for (const c of siteCatalogs) {
      const b = this.byId.get(c.brandId.toUpperCase());
      if (!b) continue;
      const list = siteModelsFor(c, b, imagesVisible(b, "lugworthy", "watch"));
      if (!list.length) continue;
      crawled.add(b.brandId!);
      for (const m of list) this.models.push({ ...m, brand: { name: b.name, country: b.country, styleTags: b.styleTags } });
    }
    // Models are tied to the brand's permanent ID, so a renamed brand keeps its models.
    for (const m of models) {
      const b = (m.brandId && this.byId.get(m.brandId)) || this.brands.find((x) => x.slug === m.brandSlug);
      if (!b || crawled.has(b.brandId!)) continue;
      this.models.push({ ...m, origin: "seed", brandSlug: b.slug, brandId: b.brandId, brand: { name: b.name, country: b.country, styleTags: b.styleTags } });
    }
    // Brands with imported models: live variant prices beat the sheet estimate.
    for (const b of this.brands) {
      const prices = this.models.filter((m) => m.brandId === b.brandId).flatMap((m) => m.variants.map((v) => v.priceUsd));
      if (!prices.length) continue;
      const first = this.models.find((m) => m.brandId === b.brandId)!;
      b.platform = first.origin === "seed" ? "shopify" : b.platform;
      b.lastSyncedAt = first.importedAt;
      b.priceMin = Math.min(...prices);
      b.priceMax = Math.max(...prices);
      b.priceBand = bandFor(b.priceMin);
    }
    this.bySlug = new Map(this.brands.map((b) => [b.slug, b]));
  }

  /** Crawl summary for the brand's own site (brand image, watch count), if crawled. Callers check imagesVisible(). */
  mediaFor(brandId: string | undefined): CatalogIndexRow | null {
    return (brandId && this.media.get(brandId)) || null;
  }

  /** Logo taken from the brand's own site, when one was found and brand images may be shown. */
  logoFor(b: Brand): string | null {
    const row = this.mediaFor(b.brandId);
    const url = row?.brandImageStoredUrl ?? row?.brandImageUrl ?? null;
    return url && imagesVisible(b, "lugworthy", "brand") ? url : null;
  }

  /** Brands visible to the public (doc 08: draft and hidden stay private). */
  publishedBrands(): Brand[] {
    return this.brands.filter((b) => b.status === "published");
  }

  getBrand(slug: string): Brand | undefined {
    const b = this.bySlug.get(slug);
    return b && b.status === "published" ? b : undefined;
  }

  /** Any brand by BRD ID, regardless of status. Callers decide what's visible. */
  brandById(id: string): Brand | undefined {
    return this.byId.get(id.toUpperCase());
  }

  publishedModels(): Model[] {
    return this.models.filter((m) => m.published && this.bySlug.get(m.brandSlug)?.status === "published");
  }

  modelsForBrand(slug: string): Model[] {
    return this.publishedModels().filter((m) => m.brandSlug === slug);
  }

  getModel(brandSlug: string, modelSlug: string): Model | undefined {
    return this.publishedModels().find((m) => m.brandSlug === brandSlug && m.slug === modelSlug);
  }

  getModelById(id: string): Model | undefined {
    const [brandSlug, modelSlug] = id.split("~");
    return this.getModel(brandSlug, modelSlug);
  }

  findVariant(variantId: string) {
    for (const m of this.publishedModels()) {
      const v = m.variants.find((x) => x.id === variantId);
      if (v) return { model: m, variant: v, brand: this.bySlug.get(m.brandSlug)! };
    }
    return undefined;
  }

  brandOf(m: Model): Brand {
    return this.bySlug.get(m.brandSlug)!;
  }

  /** Spec-similarity for "Similar models": style overlap, then size and price distance. */
  similarModels(m: Model, limit = 4): Model[] {
    const d0 = m.specs.caseDiameterMm ?? 40;
    const p0 = minPriceUsd(m);
    return this.publishedModels()
      .filter((x) => x.brandSlug !== m.brandSlug)
      .map((x) => {
        const overlap = x.styles.filter((s) => m.styles.includes(s) && s !== "other").length;
        const dd = Math.abs((x.specs.caseDiameterMm ?? d0) - d0);
        const dp = Math.abs(minPriceUsd(x) - p0) / Math.max(p0, 1);
        const move = x.specs.movementType === m.specs.movementType ? 0 : 1;
        return { x, score: overlap * 3 - dd * 0.5 - dp * 2 - move };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.x);
  }

  brandStats() {
    const brands = this.publishedBrands();
    return {
      brands: brands.length,
      countries: new Set(brands.map((b) => b.country).filter(Boolean)).size,
      models: this.publishedModels().length,
    };
  }
}

/** The snapshot catalog: the master-list rows checked into the repo. */
export function snapshotCatalog(media?: CatalogIndex, siteCatalogs?: BrandCatalog[]): Catalog {
  const rows = snapshotRows();
  return new Catalog({ brands: buildBrands(rows.rows), source: "snapshot", syncedAt: rows.syncedAt }, undefined, media, siteCatalogs);
}

async function localCatalog(): Promise<Catalog> {
  return snapshotCatalog(await loadCatalogIndex(), await loadAllBrandCatalogs());
}

// Each server instance keeps the catalog for a minute. Pages are also cached (ISR) and the sync
// job revalidates them, so a sync shows up within about a minute.
const TTL_MS = 60_000;
let memo: { at: number; catalog: Catalog } | null = null;

async function loadCatalog(): Promise<Catalog> {
  const db = getDb();
  if (!db) return localCatalog();
  try {
    const snap = await readCatalog(db);
    if (!snap.brands.length) {
      console.error("[catalog] database has no brands yet (run the sync); using the snapshot");
      return localCatalog();
    }
    const site = await readSiteCatalogs(db);
    return new Catalog({ brands: snap.brands, source: "database", syncedAt: snap.syncedAt }, undefined, snap.index, site);
  } catch (e) {
    console.error("[catalog] database read failed; using the snapshot:", (e as Error).message);
    return localCatalog();
  }
}

/** The current catalog, shared by the site and the API. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (!memo || Date.now() - memo.at > TTL_MS) memo = { at: Date.now(), catalog: await loadCatalog() };
  return memo.catalog;
});

/** One brand's crawled watches and images. */
export async function getBrandSiteCatalog(code: string): Promise<BrandCatalog | null> {
  const db = getDb();
  if (db) {
    try {
      return await readBrandCatalog(db, code);
    } catch (e) {
      console.error("[catalog] database read failed:", (e as Error).message);
    }
  }
  return loadBrandCatalog(code);
}

/** Forget the in-memory catalog (after a sync on this instance). */
export function clearCatalogMemo() {
  memo = null;
}
