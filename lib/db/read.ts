// Database -> the shapes the site and API use (Brand, CatalogIndex, BrandCatalog).

import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Availability, BrandCatalog, CatalogImage, CatalogIndex, CatalogWatch } from "@/lib/brands/media";
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

/** One brand's crawl, watches and images, in the crawler's file format. */
export async function readBrandCatalog(db: Db, code: string): Promise<BrandCatalog | null> {
  const [row] = await db
    .select({ brand: s.brands, crawl: s.brandCrawls })
    .from(s.brandCrawls)
    .innerJoin(s.brands, eq(s.brands.id, s.brandCrawls.brandId))
    .where(eq(s.brands.brandCode, code.toUpperCase()));
  if (!row) return null;
  const watches = await db.select().from(s.siteWatches).where(eq(s.siteWatches.brandId, row.brand.id)).orderBy(asc(s.siteWatches.position));
  const images = watches.length
    ? await db.select().from(s.siteWatchImages).where(inArray(s.siteWatchImages.watchId, watches.map((w) => w.id))).orderBy(asc(s.siteWatchImages.position))
    : [];
  const events = watches.length
    ? await db.select().from(s.siteWatchAvailabilityEvents).where(inArray(s.siteWatchAvailabilityEvents.watchId, watches.map((w) => w.id))).orderBy(asc(s.siteWatchAvailabilityEvents.at))
    : [];
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
  const c = row.crawl;
  return {
    brandId: row.brand.brandCode!,
    brandName: row.brand.name,
    website: c.website,
    crawledAt: c.crawledAt.toISOString(),
    status: c.status as BrandCatalog["status"],
    platform: c.platform,
    brandImage: c.brandImageUrl
      ? { url: c.brandImageUrl, storedUrl: c.brandImageStoredUrl, kind: c.brandImageKind ?? "logo", sourcePage: c.brandImageSourcePage, width: c.brandImageWidth, height: c.brandImageHeight }
      : null,
    attribution: c.attribution,
    imageRights: c.imageRights,
    watches: watches.map((w) => {
      const imgs = imagesFor.get(w.id) ?? [];
      return {
        id: w.id, name: w.name, url: w.url, image: imgs[0] ?? null, images: imgs, priceMinor: w.priceMinor,
        currency: w.currency, available: w.available, specs: w.specs, hash: w.hash ?? undefined,
        availability: (w.availability as Availability | null) ?? null, soldOut: w.soldOut,
        availabilityCheckedAt: w.availabilityCheckedAt?.toISOString() ?? null, availabilityHistory: historyFor.get(w.id) ?? [],
        description: w.description, productType: w.productType, tags: w.tags, options: w.options,
        variants: w.variants as NonNullable<CatalogWatch["variants"]>, specsRaw: w.specsRaw,
      };
    }),
  };
}
