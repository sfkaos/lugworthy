// Database -> the shapes the site and API use (Brand, CatalogIndex, BrandCatalog).

import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Availability, BrandCatalog, CatalogCollection, CatalogImage, CatalogIndex, CatalogWatch } from "@/lib/brands/media";
import type { Brand, BrandFacts } from "@/lib/types";
import type { Db } from "./client";

type BrandRow = typeof s.brands.$inferSelect;

export function rowToBrand(r: BrandRow): Brand {
  return {
    slug: r.slug,
    brandId: r.brandCode!,
    name: r.name,
    websiteUrl: r.websiteUrl,
    platform: r.platform,
    country: r.country,
    countryLabel: r.countryLabel,
    city: r.city,
    story: r.story?.en ?? null,
    styleTags: r.styleTags,
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    priceBand: (r.priceBand as Brand["priceBand"]) ?? null,
    currency: r.currency,
    instagram: r.socials?.instagram ?? null,
    brandClass: r.isMicrobrandClass,
    enPuntoExhibitor: r.enPuntoExhibitor,
    status: r.status,
    claimStatus: r.claimStatus,
    imageLicenseStatus: r.imageLicenseStatus,
    colorPrimary: r.colorPrimary,
    colorSecondary: r.colorSecondary,
    shipsTo: r.shipsTo,
    affiliate: r.affiliateProgram ? { network: r.affiliateProgram.network, urlTemplate: r.affiliateProgram.url_template } : null,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    sources: r.sources,
    founded: r.foundedYear,
    facts: (r.facts as unknown as BrandFacts | null) ?? null,
    ownership: r.ownership,
    lugworthyFit: r.lugworthyFit,
    siteCheck: r.siteCheck,
  };
}

export interface DbSnapshot {
  brands: Brand[];
  index: CatalogIndex;
  syncedAt: string | null;
}

export async function readCatalog(db: Db): Promise<DbSnapshot> {
  const rows = await db.select().from(s.brands).where(isNotNull(s.brands.brandCode)).orderBy(asc(s.brands.name));
  const crawls = await db
    .select({
      code: s.brands.brandCode,
      status: s.brandCrawls.status,
      url: s.brandCrawls.brandImageUrl,
      stored: s.brandCrawls.brandImageStoredUrl,
      crawledAt: s.brandCrawls.crawledAt,
      watchCount: sql<number>`(select count(*)::int from ${s.siteWatches} where ${s.siteWatches.brandId} = ${s.brandCrawls.brandId})`,
      soldOutCount: sql<number>`(select count(*)::int from ${s.siteWatches} where ${s.siteWatches.brandId} = ${s.brandCrawls.brandId} and ${s.siteWatches.soldOut})`,
      checkedAt: sql<string | null>`(select max(${s.siteWatches.availabilityCheckedAt}) from ${s.siteWatches} where ${s.siteWatches.brandId} = ${s.brandCrawls.brandId})`,
    })
    .from(s.brandCrawls)
    .innerJoin(s.brands, eq(s.brands.id, s.brandCrawls.brandId));
  const [last] = await db
    .select({ at: s.dataSyncs.finishedAt })
    .from(s.dataSyncs)
    .where(eq(s.dataSyncs.status, "ok"))
    .orderBy(desc(s.dataSyncs.finishedAt))
    .limit(1);
  const crawledTimes = crawls.map((c) => c.crawledAt.getTime());
  return {
    brands: rows.map(rowToBrand).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    index: {
      generatedAt: crawledTimes.length ? new Date(Math.max(...crawledTimes)).toISOString() : null,
      brands: crawls.map((c) => ({
        brandId: c.code!,
        status: c.status as CatalogIndex["brands"][number]["status"],
        brandImageUrl: c.url,
        brandImageStoredUrl: c.stored,
        watchCount: Number(c.watchCount),
        soldOutCount: Number(c.soldOutCount),
        availabilityCheckedAt: c.checkedAt ? new Date(c.checkedAt).toISOString() : null,
        crawledAt: c.crawledAt.toISOString(),
      })),
    },
    syncedAt: last?.at?.toISOString() ?? null,
  };
}

/** Crawls, watches and images in the crawler's file format: all brands, or only `code`. */
/**
 * `lite` is for the site-wide catalog that every page loads: at most 4 images per watch and no
 * sold-out history, so tens of thousands of watches stay cheap. Brand detail reads use the full form.
 */
export async function readSiteCatalogs(db: Db, code?: string, opts: { lite?: boolean } = {}): Promise<BrandCatalog[]> {
  const rows = await db
    .select({ brand: s.brands, crawl: s.brandCrawls })
    .from(s.brandCrawls)
    .innerJoin(s.brands, eq(s.brands.id, s.brandCrawls.brandId))
    .where(code ? eq(s.brands.brandCode, code.toUpperCase()) : undefined);
  if (!rows.length) return [];
  const brandIds = rows.map((r) => r.brand.id);
  const watches = await db.select().from(s.siteWatches).where(inArray(s.siteWatches.brandId, brandIds)).orderBy(asc(s.siteWatches.position));
  const watchIds = watches.map((w) => w.id);
  // Joined on brand rather than listing every watch id, which can exceed Postgres' parameter limit.
  const images = watchIds.length
    ? (await db
        .select({ img: s.siteWatchImages })
        .from(s.siteWatchImages)
        .innerJoin(s.siteWatches, eq(s.siteWatches.id, s.siteWatchImages.watchId))
        .where(opts.lite
          ? and(inArray(s.siteWatches.brandId, brandIds), lt(s.siteWatchImages.position, 4))
          : inArray(s.siteWatches.brandId, brandIds))
        .orderBy(asc(s.siteWatchImages.position))).map((r) => r.img)
    : [];
  const events = watchIds.length && !opts.lite
    ? await db.select().from(s.siteWatchAvailabilityEvents).where(inArray(s.siteWatchAvailabilityEvents.brandId, brandIds)).orderBy(asc(s.siteWatchAvailabilityEvents.at))
    : [];
  const cols = await db.select().from(s.siteCollections).where(inArray(s.siteCollections.brandId, brandIds)).orderBy(asc(s.siteCollections.position));
  const links = cols.length
    ? (await db
        .select({ l: s.siteWatchCollections })
        .from(s.siteWatchCollections)
        .innerJoin(s.siteCollections, eq(s.siteCollections.id, s.siteWatchCollections.collectionId))
        .where(inArray(s.siteCollections.brandId, brandIds))).map((r) => r.l)
    : [];
  const collectionIdsFor = new Map<string, string[]>();
  for (const l of links) collectionIdsFor.set(l.watchId, [...(collectionIdsFor.get(l.watchId) ?? []), l.collectionId]);
  const collectionsFor = new Map<string, CatalogCollection[]>();
  for (const c of cols) {
    const list = collectionsFor.get(c.brandId) ?? [];
    list.push({ id: c.id, name: c.name, url: c.url, description: c.description, image: c.imageUrl ? { url: c.imageUrl, storedUrl: c.imageStoredUrl, width: null, height: null } : null });
    collectionsFor.set(c.brandId, list);
  }
  const historyFor = new Map<string, { at: string; availability: Availability }[]>();
  for (const e of events) {
    const list = historyFor.get(e.watchId) ?? [];
    list.push({ at: e.at.toISOString(), availability: e.availability as Availability });
    historyFor.set(e.watchId, list);
  }
  const imagesFor = new Map<string, CatalogImage[]>();
  for (const im of images) {
    const list = imagesFor.get(im.watchId) ?? [];
    list.push({ url: im.url, storedUrl: im.storedUrl, width: im.width, height: im.height });
    imagesFor.set(im.watchId, list);
  }
  const watchesFor = new Map<string, CatalogWatch[]>();
  for (const w of watches) {
    const imgs = imagesFor.get(w.id) ?? [];
    const list = watchesFor.get(w.brandId) ?? [];
    list.push({
      id: w.id, name: w.name, url: w.url, image: imgs[0] ?? null, images: imgs, priceMinor: w.priceMinor,
      currency: w.currency, available: w.available, specs: w.specs, hash: w.hash ?? undefined,
      availability: (w.availability as Availability | null) ?? null, soldOut: w.soldOut,
      availabilityCheckedAt: w.availabilityCheckedAt?.toISOString() ?? null, availabilityHistory: historyFor.get(w.id) ?? [],
      description: w.description, productType: w.productType, tags: w.tags, options: w.options,
      variants: w.variants as NonNullable<CatalogWatch["variants"]>, specsRaw: w.specsRaw,
      collectionIds: collectionIdsFor.get(w.id) ?? [],
    });
    watchesFor.set(w.brandId, list);
  }
  return rows.map(({ brand, crawl: c }) => ({
    brandId: brand.brandCode!,
    brandName: brand.name,
    website: c.website,
    crawledAt: c.crawledAt.toISOString(),
    status: c.status as BrandCatalog["status"],
    platform: c.platform,
    brandImage: c.brandImageUrl
      ? { url: c.brandImageUrl, storedUrl: c.brandImageStoredUrl, kind: c.brandImageKind ?? "logo", sourcePage: c.brandImageSourcePage, width: c.brandImageWidth, height: c.brandImageHeight }
      : null,
    attribution: c.attribution,
    imageRights: c.imageRights,
    collections: collectionsFor.get(brand.id) ?? [],
    watches: watchesFor.get(brand.id) ?? [],
  }));
}

/** One brand's crawl, watches and images, in the crawler's file format. */
export async function readBrandCatalog(db: Db, code: string): Promise<BrandCatalog | null> {
  return (await readSiteCatalogs(db, code))[0] ?? null;
}
