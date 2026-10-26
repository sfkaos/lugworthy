// Crawler files -> database. The "Collect brand and watch images" crawler writes
// data/catalog/index.json and data/catalog/BRD-####.json (format in lib/brands/media.ts).
// This replaces each crawled brand's watches and images with the latest crawl.

import { refreshBrand, reorderBrands } from "@/lib/catalog/index-build";
import { eq, inArray } from "drizzle-orm";
import * as s from "@/db/schema";
import { loadBrandCatalog, loadCatalogIndex, type BrandCatalog } from "@/lib/brands/media";
import type { Db } from "@/lib/db/client";

const CHUNK = 500;

export interface CatalogImportResult {
  brands: number;
  watches: number;
  images: number;
  collections?: number;
  skipped: string[]; // brand IDs with a file but no brand in the database
}

export async function importBrandCatalogs(db: Db, catalogs: BrandCatalog[]): Promise<CatalogImportResult> {
  const result: CatalogImportResult = { brands: 0, watches: 0, images: 0, skipped: [] };
  if (!catalogs.length) return result;
  const known = await db
    .select({ id: s.brands.id, code: s.brands.brandCode })
    .from(s.brands)
    .where(inArray(s.brands.brandCode, catalogs.map((c) => c.brandId.toUpperCase())));
  const idByCode = new Map(known.map((k) => [k.code!, k.id]));

  for (const c of catalogs) {
    const brandId = idByCode.get(c.brandId.toUpperCase());
    if (!brandId) {
      result.skipped.push(c.brandId);
      continue;
    }
    const crawledAt = new Date(c.crawledAt);
    const img = c.brandImage;
    const crawl = {
      brandId, website: c.website, crawledAt, status: c.status, platform: c.platform,
      brandImageUrl: img?.url ?? null, brandImageStoredUrl: img?.storedUrl ?? null, brandImageKind: img?.kind ?? null, brandImageSourcePage: img?.sourcePage ?? null,
      brandImageWidth: img?.width ?? null, brandImageHeight: img?.height ?? null,
      attribution: c.attribution, imageRights: c.imageRights ?? "unknown", importedAt: new Date(),
    };
    const watches = c.watches.map((w, i) => ({
      id: w.id, brandId, name: w.name, url: w.url, priceMinor: w.priceMinor, currency: w.currency, available: w.available,
      specs: w.specs ?? {}, hash: w.hash ?? null, position: i, crawledAt,
      availability: w.availability ?? null,
      soldOut: w.soldOut ?? (w.available == null ? null : !w.available),
      availabilityCheckedAt: w.availabilityCheckedAt ? new Date(w.availabilityCheckedAt) : null,
      description: w.description ?? null, productType: w.productType ?? null, tags: w.tags ?? [], options: w.options ?? [],
      variants: (w.variants ?? []) as Record<string, unknown>[], specsRaw: w.specsRaw ?? {},
    }));
    // History is append-only: events already stored are kept, new ones added.
    const events = c.watches.flatMap((w) =>
      (w.availabilityHistory ?? []).map((e) => ({ watchId: w.id, brandId, at: new Date(e.at), availability: e.availability })),
    );
    const images = c.watches.flatMap((w) => {
      const list = w.images.length ? w.images : w.image ? [w.image] : [];
      return list.map((im, position) => ({ watchId: w.id, position, url: im.url, storedUrl: im.storedUrl ?? null, width: im.width, height: im.height }));
    });
    const watchIds = new Set(watches.map((w) => w.id));
    const collections = (c.collections ?? []).map((col, i) => ({
      id: col.id, brandId, name: col.name, url: col.url, description: col.description,
      imageUrl: col.image?.url ?? null, imageStoredUrl: col.image?.storedUrl ?? null, position: i, crawledAt,
    }));
    const collectionIds = new Set(collections.map((col) => col.id));
    const links = c.watches.flatMap((w) => [...new Set(w.collectionIds ?? [])].filter((id) => collectionIds.has(id) && watchIds.has(w.id)).map((collectionId) => ({ watchId: w.id, collectionId })));
    await db.transaction(async (tx) => {
      const { brandId: _pk, ...update } = crawl;
      await tx.insert(s.brandCrawls).values(crawl).onConflictDoUpdate({ target: s.brandCrawls.brandId, set: update });
      await tx.delete(s.siteWatches).where(eq(s.siteWatches.brandId, brandId)); // images and collection links cascade
      await tx.delete(s.siteCollections).where(eq(s.siteCollections.brandId, brandId));
      for (let i = 0; i < collections.length; i += CHUNK) await tx.insert(s.siteCollections).values(collections.slice(i, i + CHUNK));
      for (let i = 0; i < watches.length; i += CHUNK) await tx.insert(s.siteWatches).values(watches.slice(i, i + CHUNK));
      for (let i = 0; i < images.length; i += CHUNK) await tx.insert(s.siteWatchImages).values(images.slice(i, i + CHUNK));
      for (let i = 0; i < links.length; i += CHUNK) await tx.insert(s.siteWatchCollections).values(links.slice(i, i + CHUNK)).onConflictDoNothing();
      for (let i = 0; i < events.length; i += CHUNK) await tx.insert(s.siteWatchAvailabilityEvents).values(events.slice(i, i + CHUNK)).onConflictDoNothing();
    });
    // Keep the site's read model in step with this brand's new crawl.
    await refreshBrand(db, c.brandId);
    result.brands++;
    result.watches += watches.length;
    result.images += images.length;
    result.collections = (result.collections ?? 0) + collections.length;
  }
  if (result.brands) await reorderBrands(db);
  return result;
}

/** Imports every brand listed in data/catalog/index.json. */
export async function importCatalogDir(db: Db, dir?: string): Promise<CatalogImportResult> {
  const index = await loadCatalogIndex(dir);
  const files = await Promise.all(index.brands.map((r) => loadBrandCatalog(r.brandId, dir)));
  return importBrandCatalogs(db, files.filter((f): f is BrandCatalog => f !== null));
}
