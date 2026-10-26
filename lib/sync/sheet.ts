// Sheet -> database. Turns master-list rows (public columns A-L only) into brands with the
// shared rules in lib/brands/build.ts and upserts them on their permanent BRD ID.
//
// Fields that the site or brands manage later (claim, image license, En Punto, colours) are set on
// insert and never overwritten. Brands that disappear from the sheet are hidden, not deleted.

import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { buildBrands } from "@/lib/brands/build";
import type { MasterRows } from "@/lib/brands/source";
import { MIN_ROWS, countValidRows } from "@/lib/brands/source";
import type { Db } from "@/lib/db/client";
import type { Brand } from "@/lib/types";

const CHUNK = 200;

export function brandToRow(b: Brand, syncedAt: Date) {
  return {
    brandCode: b.brandId!,
    slug: b.slug,
    name: b.name,
    websiteUrl: b.websiteUrl,
    country: b.country,
    countryLabel: b.countryLabel,
    city: b.city,
    foundedYear: b.founded ?? null,
    story: b.story ? { en: b.story } : null,
    priceMin: b.priceMin,
    priceMax: b.priceMax,
    priceBand: b.priceBand,
    currency: b.currency,
    socials: b.instagram ? { instagram: b.instagram } : null,
    styleTags: b.styleTags,
    isMicrobrandClass: b.brandClass,
    status: b.status,
    ownership: b.ownership ?? null,
    lugworthyFit: b.lugworthyFit ?? null,
    siteCheck: b.siteCheck ?? null,
    facts: (b.facts ?? null) as Record<string, unknown> | null,
    sources: b.sources,
    inSheet: true,
    sheetSyncedAt: syncedAt,
    updatedAt: syncedAt,
  };
}

const SHEET_FIELDS = [
  "slug", "name", "websiteUrl", "country", "countryLabel", "city", "foundedYear", "story", "priceMin", "priceMax",
  "priceBand", "currency", "socials", "styleTags", "isMicrobrandClass", "status", "ownership", "lugworthyFit",
  "siteCheck", "facts", "sources", "inSheet", "sheetSyncedAt", "updatedAt",
] as const;

// Drizzle names the excluded row's columns by their SQL names.
const excludedSet = Object.fromEntries(
  SHEET_FIELDS.map((k) => [k, sql.raw(`excluded."${(s.brands[k] as { name: string }).name}"`)]),
);

export interface SheetSyncResult {
  brands: number;
  published: number;
  removed: number;
}

export async function syncBrandsFromRows(db: Db, rows: MasterRows): Promise<SheetSyncResult> {
  const valid = countValidRows(rows.rows);
  if (valid < MIN_ROWS) throw new Error(`Only ${valid} brand rows; refusing to sync`);
  const brands = buildBrands(rows.rows);
  const syncedAt = new Date(rows.syncedAt);
  const codes = brands.map((b) => b.brandId!);

  return db.transaction(async (tx) => {
    // Free every slug first so renames and swaps can't collide with the unique index.
    await tx.update(s.brands).set({ slug: sql`${s.brands.slug} || '~' || ${s.brands.id}` }).where(isNotNull(s.brands.brandCode));
    for (let i = 0; i < brands.length; i += CHUNK) {
      const chunk = brands.slice(i, i + CHUNK).map((b) => brandToRow(b, syncedAt));
      await tx.insert(s.brands).values(chunk).onConflictDoUpdate({ target: s.brands.brandCode, set: excludedSet });
    }
    // Rows gone from the sheet: hide them and park the slug on their code.
    const removed = await tx
      .update(s.brands)
      .set({ status: "hidden", inSheet: false, slug: sql`lower(${s.brands.brandCode})`, updatedAt: syncedAt })
      .where(and(isNotNull(s.brands.brandCode), notInArray(s.brands.brandCode, codes)))
      .returning({ id: s.brands.id });
    return { brands: brands.length, published: brands.filter((b) => b.status === "published").length, removed: removed.length };
  });
}

/** Runs a sync and records it in data_syncs. */
export async function recordSync<T>(db: Db, kind: "sheet" | "catalog", run: () => Promise<T>): Promise<T> {
  const [row] = await db.insert(s.dataSyncs).values({ kind, status: "running" }).returning({ id: s.dataSyncs.id });
  try {
    const result = await run();
    await db.update(s.dataSyncs).set({ status: "ok", finishedAt: new Date(), counts: result as object }).where(eq(s.dataSyncs.id, row.id));
    return result;
  } catch (e) {
    await db.update(s.dataSyncs).set({ status: "error", finishedAt: new Date(), error: (e as Error).message.slice(0, 2000) }).where(eq(s.dataSyncs.id, row.id));
    throw e;
  }
}
