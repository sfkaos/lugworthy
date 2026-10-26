// Read-side repository.
//   getDbCatalog(): the database, which the sync job fills from the master sheet and the brand-site
//     crawl (lib/sync). The /api/v1 routes read this.
//   getCatalog(): what the site's pages read. With LUGWORTHY_API_URL set it comes from the API
//     (api.lugworthy.com), so the site runs on the same API other services use. Without it, or if
//     the API can't be reached, it reads the database directly.
// Without DATABASE_URL (local dev, tests) the checked-in snapshot and data/catalog files are used.

import { cache } from "react";
import modelsJson from "@/data/seed/models.json";
import { bandFor, buildBrands } from "./brands/build";
import { imagesVisible, loadAllBrandCatalogs, loadBrandCatalog, loadCatalogIndex, type BrandCatalog, type CatalogIndex, type CatalogIndexRow } from "./brands/media";
import { apiSourceFromEnv, fetchCatalogParts } from "./catalog/from-api";
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
  readonly source: "api" | "database" | "snapshot";
  readonly syncedAt: string | null;
  private readonly bySlug: Map<string, Brand>;
  private readonly byId: Map<string, Brand>;
  private readonly media: Map<string, CatalogIndexRow>;

  constructor(
    data: { brands: Brand[]; source: "api" | "database" | "snapshot"; syncedAt: string | null },
    models: Model[] = seedModels,
    media?: CatalogIndex,
    siteCatalogs: BrandCatalog[] = [],
    /** Keep every crawled photo whatever the image settings (the site read model decides per request). */
    opts: { allImages?: boolean } = {},
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
      const list = siteModelsFor(c, b, opts.allImages || imagesVisible(b, "lugworthy", "watch"));
      if (!list.length) continue;
      crawled.add(b.brandId!);
      for (const m of list) this.models.push({ ...m, brand: { name: b.name, country: b.country, styleTags: b.styleTags } });
    }
    // Models are tied to the brand's permanent ID, so a renamed brand keeps its models.
    for (const m of models) {
      const b = (m.brandId && this.byId.get(m.brandId)) || this.brands.find((x) => x.slug === m.brandSlug);
      if (!b || crawled.has(b.brandId!)) continue;
      this.models.push({ ...m, origin: m.origin ?? "seed", brandSlug: b.slug, brandId: b.brandId, brand: { name: b.name, country: b.country, styleTags: b.styleTags } });
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

  // Built once per catalog: with tens of thousands of crawled watches, rescanning the list on every
  // call made pages like /brands (one call per brand) take seconds.
  private published?: Model[];
  private byBrand?: Map<string, Model[]>;
  private byKey?: Map<string, Model>;
  private byVariant?: Map<string, Model>;

  /** Treat the result as read-only; it's shared. */
  publishedModels(): Model[] {
    this.published ??= this.models.filter((m) => m.published && this.bySlug.get(m.brandSlug)?.status === "published");
    return this.published;
  }

  modelsForBrand(slug: string): Model[] {
    if (!this.byBrand) {
      this.byBrand = new Map();
      for (const m of this.publishedModels()) {
        const list = this.byBrand.get(m.brandSlug);
        if (list) list.push(m);
        else this.byBrand.set(m.brandSlug, [m]);
      }
    }
    return this.byBrand.get(slug) ?? [];
  }

  getModel(brandSlug: string, modelSlug: string): Model | undefined {
    if (!this.byKey) {
      this.byKey = new Map();
      for (const m of this.publishedModels()) {
        const k = `${m.brandSlug}/${m.slug}`;
        if (!this.byKey.has(k)) this.byKey.set(k, m);
      }
    }
    return this.byKey.get(`${brandSlug}/${modelSlug}`);
  }

  getModelById(id: string): Model | undefined {
    const [brandSlug, modelSlug] = id.split("~");
    return this.getModel(brandSlug, modelSlug);
  }

  findVariant(variantId: string) {
    if (!this.byVariant) {
      this.byVariant = new Map();
      for (const m of this.publishedModels()) for (const v of m.variants) if (!this.byVariant.has(v.id)) this.byVariant.set(v.id, m);
    }
    const model = this.byVariant.get(variantId);
    const variant = model?.variants.find((x) => x.id === variantId);
    return model && variant ? { model, variant, brand: this.bySlug.get(model.brandSlug)! } : undefined;
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

// Each server instance keeps the catalog in memory. Loading it reads every brand and crawled
// watch, so it's done rarely: once per worker during `next build`, and every CATALOG_TTL_SECONDS
// (default 10 minutes) at runtime. The sync job clears it on its instance and revalidates pages.
// Concurrent requests share one load.
function ttlMs(): number {
  if (process.env.NEXT_PHASE === "phase-production-build") return Infinity;
  const s = Number(process.env.CATALOG_TTL_SECONDS);
  return (Number.isFinite(s) && s > 0 ? s : 600) * 1000;
}
type Memo = { at: number; catalog: Promise<Catalog> } | null;
let dbMemo: Memo = null;
let siteMemo: Memo = null;

function remember(memo: Memo, load: () => Promise<Catalog>, set: (m: Memo) => void): Promise<Catalog> {
  if (memo && Date.now() - memo.at <= ttlMs()) return memo.catalog;
  const next = { at: Date.now(), catalog: load() };
  set(next);
  // A failed load is not kept.
  next.catalog.catch(() => set(null));
  return next.catalog;
}

async function loadDbCatalog(): Promise<Catalog> {
  const db = getDb();
  if (!db) return localCatalog();
  try {
    const snap = await readCatalog(db);
    if (!snap.brands.length) {
      console.error("[catalog] database has no brands yet (run the sync); using the snapshot");
      return localCatalog();
    }
    const site = await readSiteCatalogs(db, undefined, { lite: true });
    return new Catalog({ brands: snap.brands, source: "database", syncedAt: snap.syncedAt }, undefined, snap.index, site);
  } catch (e) {
    console.error("[catalog] database read failed; using the snapshot:", (e as Error).message);
    return localCatalog();
  }
}

/** The database catalog. The API routes read this (never the API itself). */
export const getDbCatalog = cache(async (): Promise<Catalog> => {
  return remember(dbMemo, loadDbCatalog, (m) => (dbMemo = m));
});

async function loadSiteCatalog(): Promise<Catalog> {
  const src = apiSourceFromEnv();
  if (!src) return getDbCatalog();
  try {
    const parts = await fetchCatalogParts(src);
    return new Catalog({ brands: parts.brands, source: "api", syncedAt: parts.syncedAt }, parts.models, parts.media);
  } catch (e) {
    console.error(`[catalog] API ${src.baseUrl} failed; reading the database instead:`, (e as Error).message);
    return getDbCatalog();
  }
}

/** The catalog the site's pages read: from the API when LUGWORTHY_API_URL is set, else the database. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  return remember(siteMemo, loadSiteCatalog, (m) => (siteMemo = m));
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

/** Forget the in-memory catalogs (after a sync on this instance). */
export function clearCatalogMemo() {
  dbMemo = null;
  siteMemo = null;
}

/**
 * One watch with everything its page shows. The site-wide catalog keeps only a few photos per
 * crawled watch and no stock history, so the watch page reads that brand's full crawl here.
 */
export const getModelDetail = cache(async (brandSlug: string, modelSlug: string): Promise<Model | undefined> => {
  const catalog = await getCatalog();
  const m = catalog.getModel(brandSlug, modelSlug);
  const b = catalog.getBrand(brandSlug);
  if (!m || !b || m.origin !== "site" || !b.brandId) return m;
  try {
    const full = await getBrandSiteCatalog(b.brandId);
    const detail = full && siteModelsFor(full, b, imagesVisible(b, "lugworthy", "watch")).find((x) => x.slug === m.slug);
    return detail ? { ...m, ...detail, brandSlug: m.brandSlug, brandId: m.brandId, brand: m.brand } : m;
  } catch (e) {
    console.error("[catalog] watch detail read failed:", (e as Error).message);
    return m;
  }
});
